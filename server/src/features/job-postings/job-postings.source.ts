import { createHash, randomUUID } from 'node:crypto';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import type { DynamoTransport } from './job-postings.dynamodb.ts';
import { recordKey } from './job-postings.dynamodb.ts';
import { postingError } from './job-postings.errors.ts';
import { jobRow, postingPut, readRow } from './job-postings.operations.ts';
import {
  type SavedPosting,
  type SourceExtractionInput,
  sourceTextResponseSchema,
  sourceTextSchema,
} from './job-postings.schemas.ts';

const sourceSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  recordKey: z.string(),
  text: sourceTextSchema,
  sourceUrl: z.url(),
  revision: z.uuid(),
  updatedAt: z.iso.datetime(),
});
export function sourceRow(pk: string, item: SavedPosting, text: string) {
  return {
    pk,
    sk: `SOURCE#${item.id}`,
    recordKey: recordKey(item),
    text,
    sourceUrl: item.sourceUrl,
    revision: randomUUID(),
    updatedAt: item.updatedAt,
  };
}
export async function readSource(
  table: string,
  send: DynamoTransport,
  pk: string,
  item: SavedPosting,
  signal: AbortSignal,
) {
  const value = await readRow(table, send, pk, `SOURCE#${item.id}`, signal);
  if (!value) return null;
  const parsed = sourceSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.pk !== pk ||
    parsed.data.sk !== `SOURCE#${item.id}` ||
    parsed.data.recordKey !== recordKey(item)
  )
    throw postingError('INVALID_STORED_POSTING');
  const { text, sourceUrl, revision, updatedAt } = parsed.data;
  return { text, sourceUrl, revision, updatedAt };
}
export async function sourceResponse(
  table: string,
  send: DynamoTransport,
  pk: string,
  item: SavedPosting,
  signal: AbortSignal,
) {
  return sourceTextResponseSchema.parse({
    schemaVersion: 1,
    source: await readSource(table, send, pk, item, signal),
    applicationVersion: item.applicationVersion,
    generation: item.extraction.generation,
  });
}
const receiptSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  recordKey: z.string(),
  hash: z.string(),
  generation: z.uuid().nullable(),
});
type Lookup = (
  user: string,
  id: string,
  signal: AbortSignal,
) => Promise<{ pk: string; item: SavedPosting; previous: string }>;
export async function requestSourceExtraction(
  table: string,
  send: DynamoTransport,
  lookup: Lookup,
  user: string,
  id: string,
  input: SourceExtractionInput,
  signal: AbortSignal,
  enabled: boolean,
) {
  const changesSource = input.sourceText !== undefined;
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  for (let attempt = 0; attempt < 3; attempt++) {
    const { pk, item, previous } = await lookup(user, id, signal);
    const receiptKey = input.operationId
      ? `JOB#SOURCE-ID#${id}#${input.operationId}`
      : undefined;
    const recoverReceipt = async () => {
      if (!receiptKey) return false;
      const value = await readRow(table, send, pk, receiptKey, signal);
      if (!value) return false;
      const receipt = receiptSchema.safeParse(value);
      if (
        !receipt.success ||
        receipt.data.pk !== pk ||
        receipt.data.sk !== receiptKey ||
        receipt.data.recordKey !== recordKey(item)
      )
        throw postingError('INVALID_STORED_POSTING');
      if (receipt.data.hash !== hash) throw postingError('CONFLICT');
      return true;
    };
    if (await recoverReceipt()) return item;
    if (['queued', 'processing'].includes(item.extraction.status)) {
      if (changesSource || input.operationId) throw postingError('CONFLICT');
      return item;
    }
    if (
      item.extraction.generation !== input.expectedGeneration ||
      (changesSource &&
        item.applicationVersion !== input.expectedApplicationVersion)
    )
      throw postingError('CONFLICT');
    const retained = await readSource(table, send, pk, item, signal);
    const text = changesSource
      ? input.sourceText?.trim()
        ? input.sourceText
        : null
      : (retained?.text ?? null);
    if (!changesSource && retained && retained.sourceUrl !== item.sourceUrl)
      throw postingError('CONFLICT');
    const next: SavedPosting = {
      ...item,
      updatedAt: new Date().toISOString(),
      recordVersion: item.recordVersion + 1,
      applicationVersion: item.applicationVersion + (changesSource ? 1 : 0),
      extraction: {
        status: enabled ? 'queued' : 'disabled',
        generation: enabled ? randomUUID() : null,
        error: null,
      },
    };
    const source = changesSource && text ? sourceRow(pk, next, text) : retained;
    const sourceWrite = changesSource
      ? [
          text && source
            ? {
                Put: {
                  TableName: table,
                  Item: {
                    pk,
                    sk: `SOURCE#${id}`,
                    recordKey: recordKey(next),
                    ...source,
                  },
                },
              }
            : { Delete: { TableName: table, Key: { pk, sk: `SOURCE#${id}` } } },
        ]
      : [];
    try {
      await send(
        new TransactWriteCommand({
          TransactItems: [
            postingPut(table, pk, next, previous),
            ...sourceWrite,
            ...(enabled
              ? [
                  {
                    Put: {
                      TableName: table,
                      Item: {
                        ...jobRow(pk, next),
                        ...(text && source
                          ? { sourceRevision: source.revision }
                          : {}),
                      },
                      ConditionExpression: 'attribute_not_exists(pk)',
                    },
                  },
                ]
              : []),
            ...(receiptKey
              ? [
                  {
                    Put: {
                      TableName: table,
                      Item: {
                        pk,
                        sk: receiptKey,
                        recordKey: recordKey(item),
                        hash,
                        generation: next.extraction.generation,
                      },
                      ConditionExpression: 'attribute_not_exists(pk)',
                    },
                  },
                ]
              : []),
          ],
        }),
        signal,
      );
      return next;
    } catch (cause) {
      // A receipt proves our exact input committed, including after a lost reply.
      if (await recoverReceipt()) return (await lookup(user, id, signal)).item;
      const current = (await lookup(user, id, signal)).item;
      if (
        !changesSource &&
        !input.operationId &&
        ['queued', 'processing'].includes(current.extraction.status)
      )
        return current;
      if (current.recordVersion === item.recordVersion) throw cause;
    }
  }
  throw postingError('CONFLICT');
}
