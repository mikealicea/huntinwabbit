import { createHash, randomUUID } from 'node:crypto';
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { AppError } from '../../shared/shared.errors.ts';
import { companyNameKey, matchCompany } from './companies.matching.ts';
import {
  type Company,
  type CompanyAssociation,
  companySchema,
} from './companies.schemas.ts';

type Send = (
  command: GetCommand | QueryCommand | TransactWriteCommand,
  signal: AbortSignal,
) => Promise<unknown>;
export type CompanyWrites = NonNullable<
  TransactWriteCommandInput['TransactItems']
>;
export function companyError(
  code: 'NOT_FOUND' | 'INVALID_REQUEST' | 'CONFLICT' | 'STORAGE_UNAVAILABLE',
) {
  return new AppError(
    code === 'NOT_FOUND'
      ? 404
      : code === 'INVALID_REQUEST'
        ? 400
        : code === 'CONFLICT'
          ? 409
          : 503,
    'The company request could not be completed.',
    { code },
  );
}
function ownerHash(pk: string) {
  return createHash('sha256').update(pk).digest('hex');
}
export function createCompanyStore(table: string, send: Send) {
  async function row(pk: string, sk: string, signal: AbortSignal) {
    const result = z
      .object({ Item: z.record(z.string(), z.unknown()).optional() })
      .parse(
        await send(
          new GetCommand({
            TableName: table,
            Key: { pk, sk },
            ConsistentRead: true,
          }),
          signal,
        ),
      );
    if (result.Item && (result.Item.pk !== pk || result.Item.sk !== sk))
      throw companyError('STORAGE_UNAVAILABLE');
    return result.Item;
  }
  async function get(pk: string, id: string, signal: AbortSignal) {
    const value = await row(pk, `COMPANY#${id}`, signal);
    if (!value) throw companyError('NOT_FOUND');
    const result = companySchema.parse(value.company);
    if (result.id !== id) throw companyError('STORAGE_UNAVAILABLE');
    return result;
  }
  async function page(
    pk: string,
    prefix: string,
    input: { cursor?: string; limit: number; q?: string },
    signal: AbortSignal,
  ) {
    let after: { pk: string; sk: string } | undefined;
    if (input.cursor) {
      try {
        const cursor = z
          .strictObject({
            owner: z.string(),
            prefix: z.string(),
            q: z.string(),
            after: z.string(),
          })
          .parse(
            JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')),
          );
        if (
          cursor.owner !== ownerHash(pk) ||
          cursor.prefix !== prefix ||
          cursor.q !== (input.q ?? '') ||
          !cursor.after.startsWith(prefix)
        )
          throw new Error();
        after = { pk, sk: cursor.after };
      } catch {
        throw companyError('INVALID_REQUEST');
      }
    }
    const result = z
      .object({
        Items: z.array(z.record(z.string(), z.unknown())).default([]),
        LastEvaluatedKey: z
          .object({ pk: z.string(), sk: z.string() })
          .optional(),
      })
      .parse(
        await send(
          new QueryCommand({
            TableName: table,
            KeyConditionExpression: 'pk = :owner AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: { ':owner': pk, ':prefix': prefix },
            ConsistentRead: true,
            ScanIndexForward: false,
            Limit: input.limit,
            ExclusiveStartKey: after,
          }),
          signal,
        ),
      );
    for (const item of result.Items)
      if (
        item.pk !== pk ||
        typeof item.sk !== 'string' ||
        !item.sk.startsWith(prefix)
      )
        throw companyError('STORAGE_UNAVAILABLE');
    const last = result.LastEvaluatedKey;
    if (last && (last.pk !== pk || !last.sk.startsWith(prefix)))
      throw companyError('STORAGE_UNAVAILABLE');
    return {
      items: result.Items,
      nextCursor: last
        ? Buffer.from(
            JSON.stringify({
              owner: ownerHash(pk),
              prefix,
              q: input.q ?? '',
              after: last.sk,
            }),
          ).toString('base64url')
        : null,
    };
  }
  async function list(
    pk: string,
    input: { cursor?: string; limit: number; q?: string },
    signal: AbortSignal,
  ) {
    const result = await page(pk, 'COMPANY#', input, signal);
    return {
      ...result,
      items: result.items
        .map((value) => {
          const company = companySchema.parse(value.company);
          if (value.sk !== `COMPANY#${company.id}`)
            throw companyError('STORAGE_UNAVAILABLE');
          return company;
        })
        .filter(
          (company) =>
            !input.q ||
            companyNameKey(company.name).includes(companyNameKey(input.q)) ||
            company.website?.toLowerCase().includes(input.q.toLowerCase()),
        ),
    };
  }
  async function all(pk: string, signal: AbortSignal) {
    const items: Company[] = [];
    let cursor: string | undefined;
    do {
      const result = await list(pk, { limit: 50, cursor }, signal);
      items.push(...result.items);
      cursor = result.nextCursor ?? undefined;
    } while (cursor);
    return items;
  }
  async function resolve(
    pk: string,
    name: string | null,
    website: string | null,
    signal: AbortSignal,
    suggested?: string,
  ) {
    if (!name?.trim()) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const registry = await row(pk, 'COMPANY-REGISTRY', signal);
      const revision = z
        .number()
        .int()
        .nonnegative()
        .parse(registry?.revision ?? 0);
      const companies = await all(pk, signal);
      const match =
        companies.find((c) => c.id === suggested) ??
        matchCompany(companies, name, website);
      if (match) return match;
      const timestamp = new Date().toISOString();
      const company = companySchema.parse({
        id: randomUUID(),
        name,
        website,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      try {
        await send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: table,
                  Item: { pk, sk: `COMPANY#${company.id}`, company },
                  ConditionExpression: 'attribute_not_exists(pk)',
                },
              },
              {
                Put: {
                  TableName: table,
                  Item: { pk, sk: 'COMPANY-REGISTRY', revision: revision + 1 },
                  ConditionExpression: registry
                    ? 'revision = :revision'
                    : 'attribute_not_exists(pk)',
                  ...(registry
                    ? { ExpressionAttributeValues: { ':revision': revision } }
                    : {}),
                },
              },
            ],
          }),
          signal,
        );
        return company;
      } catch (cause) {
        // Recover a committed creation without repeating it after a lost response.
        const recovered = await row(pk, `COMPANY#${company.id}`, signal);
        if (recovered) return companySchema.parse(recovered.company);
        const current = await row(pk, 'COMPANY-REGISTRY', signal);
        if ((current?.revision ?? 0) === revision) throw cause;
      }
    }
    throw companyError('CONFLICT');
  }
  return {
    get,
    list,
    all,
    resolve,
    async roles(
      pk: string,
      id: string,
      input: { cursor?: string; limit: number },
      signal: AbortSignal,
    ) {
      await get(pk, id, signal);
      const result = await page(pk, `COMPANY-ROLE#${id}#`, input, signal);
      return {
        ...result,
        items: result.items.map((v) =>
          z.object({ roleId: z.uuid(), recordKey: z.string() }).parse(v),
        ),
      };
    },
  };
}
export type CompanyStore = ReturnType<typeof createCompanyStore>;
export function companySummary(company: Company | null) {
  return (
    company && { id: company.id, name: company.name, website: company.website }
  );
}
export function companyMembershipWrites(
  table: string,
  pk: string,
  role: { id: string; createdAt: string },
  before: CompanyAssociation | undefined,
  after: CompanyAssociation | undefined,
): CompanyWrites {
  const oldId = before?.company?.id,
    newId = after?.company?.id;
  if (oldId === newId) return [];
  const key = (id: string) => ({
    pk,
    sk: `COMPANY-ROLE#${id}#${role.createdAt}#${role.id}`,
  });
  return [
    ...(oldId ? [{ Delete: { TableName: table, Key: key(oldId) } }] : []),
    ...(newId
      ? [
          {
            Put: {
              TableName: table,
              Item: {
                ...key(newId),
                roleId: role.id,
                recordKey: `POSTING#${role.createdAt}#${role.id}`,
              },
            },
          },
        ]
      : []),
  ];
}
