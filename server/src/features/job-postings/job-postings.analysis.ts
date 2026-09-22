import { QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import type { CompanyStore } from '../companies/companies.index.ts';
import {
  analysisInvalidation,
  type ReadInputs,
  type Source,
} from '../company-analysis/company-analysis.index.ts';
import { type DynamoTransport, readRecord } from './job-postings.dynamodb.ts';
import { noteSchema } from './job-postings.notes.schemas.ts';
import { readRow } from './job-postings.operations.ts';
import {
  type SavedPosting,
  storedPostingSchema,
} from './job-postings.schemas.ts';
import { effectiveFields } from './job-postings.updates.logic.ts';
import { updateDataSchema } from './job-postings.updates.schemas.ts';

// All posting mutations already transact the parent row, including note/history changes.
// Add one atomic source revision per company at this posting persistence boundary.
export function withCompanyAnalysisInvalidation(
  send: DynamoTransport,
  now = Date.now,
): DynamoTransport {
  return async (command, signal) => {
    if (!(command instanceof TransactWriteCommand))
      return send(command, signal);
    const writes = command.input.TransactItems ?? [];
    const affected = new Map<
      string,
      { table: string; pk: string; id: string; hidden: boolean }
    >();
    const hiddenNotes = writes.some((write) =>
      String(write.Delete?.Key?.sk ?? '').startsWith('NOTE#'),
    );
    function add(
      table: string | undefined,
      pk: unknown,
      id: string | undefined,
      hidden: boolean,
    ) {
      if (!table || typeof pk !== 'string' || !id) return;
      const key = `${table}:${pk}:${id}`;
      affected.set(key, {
        table,
        pk,
        id,
        hidden: hidden || affected.get(key)?.hidden || false,
      });
    }
    for (const write of writes) {
      const put = write.Put;
      if (put && String(put.Item?.sk).startsWith('COMPANY#')) {
        const company = z.object({ id: z.uuid() }).parse(put.Item?.company);
        add(put.TableName, put.Item?.pk, company.id, false);
      }
      const operation = put ?? write.Delete;
      const key = put?.Item ?? write.Delete?.Key;
      if (!operation || !String(key?.sk).startsWith('POSTING#')) continue;
      const oldData = operation.ExpressionAttributeValues?.[':previous'];
      const old: SavedPosting | undefined =
        typeof oldData === 'string'
          ? storedPostingSchema.parse(JSON.parse(oldData))
          : undefined;
      const next: SavedPosting | undefined =
        typeof put?.Item?.data === 'string'
          ? storedPostingSchema.parse(JSON.parse(put.Item.data))
          : undefined;
      const before = old?.companyAssociation?.company?.id;
      const after = next?.companyAssociation?.company?.id;
      // Extraction state transitions alone do not change source information.
      if (
        old &&
        next &&
        JSON.stringify({
          parsed: old.parsedPosting,
          application: old.application,
          edits: old.edits,
          association: old.companyAssociation,
          url: old.sourceUrl,
        }) ===
          JSON.stringify({
            parsed: next.parsedPosting,
            application: next.application,
            edits: next.edits,
            association: next.companyAssociation,
            url: next.sourceUrl,
          }) &&
        !writes.some(
          (w) =>
            String(w.Put?.Item?.sk).startsWith('NOTE#') ||
            String(w.Put?.Item?.sk).startsWith('JOB#UPDATE#'),
        ) &&
        !hiddenNotes
      )
        continue;
      add(
        operation.TableName,
        key?.pk,
        before,
        before !== after || hiddenNotes,
      );
      add(operation.TableName, key?.pk, after, hiddenNotes);
    }
    if (!affected.size) return send(command, signal);
    return send(
      new TransactWriteCommand({
        ...command.input,
        TransactItems: [
          ...writes,
          ...[...affected.values()].map((value) =>
            analysisInvalidation(
              value.table,
              value.pk,
              value.id,
              value.hidden,
              now(),
            ),
          ),
        ],
      }),
      signal,
    );
  };
}
const cursorSchema = z.object({
  phase: z.enum(['company-notes', 'role', 'notes', 'history']),
  membership: z.string().nullable(),
  roleId: z.uuid().optional(),
  recordKey: z.string().optional(),
  after: z.string().optional(),
  usable: z.boolean().default(false),
});
export function createCompanyAnalysisInputs(
  table: string,
  send: DynamoTransport,
  companies: CompanyStore,
): ReadInputs {
  return async (pk, companyId, rawCursor, signal) => {
    const cursor = rawCursor
      ? cursorSchema.parse(JSON.parse(rawCursor))
      : { phase: 'company-notes' as const, membership: null, usable: false };
    const company = await companies.get(pk, companyId, signal);
    if (cursor.phase === 'company-notes') {
      const prefix = `COMPANY-NOTE#${companyId}#ENTRY#`;
      const page = z
        .object({
          Items: z
            .array(
              z.object({
                pk: z.string(),
                sk: z.string(),
                recordKey: z.string(),
                data: z.string(),
              }),
            )
            .default([]),
          LastEvaluatedKey: z
            .object({ pk: z.string(), sk: z.string() })
            .optional(),
        })
        .parse(
          await send(
            new QueryCommand({
              TableName: table,
              ConsistentRead: true,
              KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
              ExpressionAttributeValues: { ':pk': pk, ':prefix': prefix },
              Limit: 1,
              ...(cursor.after
                ? { ExclusiveStartKey: { pk, sk: cursor.after } }
                : {}),
            }),
            signal,
          ),
        );
      const sources: Source[] = page.Items.map((row) => {
        const note = noteSchema.parse(JSON.parse(row.data));
        if (
          row.pk !== pk ||
          row.recordKey !== `COMPANY#${companyId}` ||
          row.sk !== `${prefix}${note.createdAt}#${note.id}` ||
          note.updatedAt < note.createdAt
        )
          throw new Error('Invalid company comment source');
        return {
          source: 'company-comment',
          companyId,
          noteId: note.id,
          text: note.body,
        };
      });
      const last = page.LastEvaluatedKey;
      if (last && (last.pk !== pk || !last.sk.startsWith(prefix)))
        throw new Error('Invalid company comment cursor');
      return {
        sources,
        roles: 0,
        usable: 0,
        cursor: JSON.stringify(
          last
            ? { ...cursor, after: last.sk }
            : { phase: 'role', membership: null, usable: false },
        ),
      };
    }
    let roleId = cursor.roleId,
      recordKey = cursor.recordKey,
      membership = cursor.membership;
    if (cursor.phase === 'role') {
      const members = await companies.roles(
        pk,
        companyId,
        { limit: 1, ...(membership ? { cursor: membership } : {}) },
        signal,
      );
      const member = members.items[0];
      if (!member) return { sources: [], cursor: null, roles: 0, usable: 0 };
      roleId = member.roleId;
      recordKey = member.recordKey;
      membership = members.nextCursor;
    }
    if (!roleId || !recordKey) throw new Error('Invalid analysis input cursor');
    const row = await readRow(table, send, pk, recordKey, signal);
    if (!row) throw new Error('Analysis source changed');
    const posting = readRecord(row, pk, recordKey);
    if (
      posting.id !== roleId ||
      posting.companyAssociation?.company?.id !== companyId
    )
      throw new Error('Analysis source changed');
    const fields = effectiveFields(posting);
    const roleTitle = fields.title ?? 'Untitled role';
    const source = (
      kind: Exclude<Source['source'], 'company-comment'>,
      text: string,
    ): Source => ({
      roleId,
      roleTitle,
      source: kind,
      text,
    });
    if (cursor.phase === 'role') {
      const facts = JSON.stringify({
        company: { name: company.name, website: company.website },
        sourceUrl: posting.sourceUrl,
        currentFacts: fields,
      });
      const personal = JSON.stringify(posting.application);
      const usable =
        !!posting.parsedPosting ||
        !!Object.keys(posting.edits?.overrides ?? {}).length ||
        !!posting.application.notes.trim();
      return {
        sources: [
          source(
            Object.keys(posting.edits?.overrides ?? {}).length
              ? 'correction'
              : 'posting',
            facts,
          ),
          source('personal', personal),
          ...(posting.parsedPosting &&
          Object.keys(posting.edits?.overrides ?? {}).length
            ? [
                source(
                  'history',
                  `Original extraction before corrections; superseded fields are not current facts: ${JSON.stringify(posting.parsedPosting)}`,
                ),
              ]
            : []),
        ],
        cursor: JSON.stringify({
          phase: 'notes',
          roleId,
          recordKey,
          membership,
          usable,
        }),
        roles: 1,
        usable: 0,
      };
    }
    const prefix =
      cursor.phase === 'notes'
        ? `NOTE#${roleId}#ENTRY#`
        : `JOB#UPDATE#${roleId}#`;
    const result = z
      .object({
        Items: z
          .array(
            z.object({
              pk: z.string(),
              sk: z.string(),
              recordKey: z.string(),
              data: z.string(),
            }),
          )
          .default([]),
        LastEvaluatedKey: z
          .object({ pk: z.string(), sk: z.string() })
          .optional(),
      })
      .parse(
        await send(
          new QueryCommand({
            TableName: table,
            ConsistentRead: true,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: { ':pk': pk, ':prefix': prefix },
            Limit: 1,
            ...(cursor.after
              ? { ExclusiveStartKey: { pk, sk: cursor.after } }
              : {}),
          }),
          signal,
        ),
      );
    const sources = result.Items.map((item) => {
      if (
        item.pk !== pk ||
        item.recordKey !== recordKey ||
        !item.sk.startsWith(prefix)
      )
        throw new Error('Invalid analysis source');
      if (cursor.phase === 'notes')
        return source('personal', noteSchema.parse(JSON.parse(item.data)).body);
      const data = updateDataSchema.parse(JSON.parse(item.data));
      return source(
        'history',
        JSON.stringify({
          message: data.entry.text,
          status: data.entry.status,
          undoneAt: data.entry.undoneAt,
          changes: data.entry.changes,
        }),
      );
    });
    const usable = cursor.usable || sources.length > 0;
    if (result.LastEvaluatedKey) {
      if (
        result.LastEvaluatedKey.pk !== pk ||
        !result.LastEvaluatedKey.sk.startsWith(prefix)
      )
        throw new Error('Invalid analysis pagination');
      return {
        sources,
        cursor: JSON.stringify({
          ...cursor,
          usable,
          after: result.LastEvaluatedKey.sk,
        }),
        roles: 0,
        usable: 0,
      };
    }
    if (cursor.phase === 'notes')
      return {
        sources,
        cursor: JSON.stringify({
          phase: 'history',
          roleId,
          recordKey,
          membership,
          usable,
        }),
        roles: 0,
        usable: 0,
      };
    return {
      sources,
      cursor: membership
        ? JSON.stringify({ phase: 'role', membership, usable: false })
        : null,
      roles: 0,
      usable: usable ? 1 : 0,
    };
  };
}
