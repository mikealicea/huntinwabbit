import { createHash } from 'node:crypto';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { companyMembershipWrites } from '../companies/companies.index.ts';
import {
  type DynamoTransport,
  readRecord,
  recordKey,
  storageOperation,
} from './job-postings.dynamodb.ts';
import { postingError } from './job-postings.errors.ts';
import {
  MAX_RECORD_BYTES,
  type PostingOperations,
  type SavedPosting,
  savedPostingSchema,
} from './job-postings.schemas.ts';
import {
  requestSourceExtraction,
  sourceResponse,
} from './job-postings.source.ts';

export function jobRow(pk: string, item: SavedPosting) {
  return {
    pk,
    sk: `JOB#${item.extraction.generation}`,
    recordKey: recordKey(item),
    generation: item.extraction.generation,
    status: 'queued',
    dueGroup: 'PENDING',
    dueAt: Date.parse(item.updatedAt) + 15 * 60_000,
  };
}
export function postingPut(
  table: string,
  pk: string,
  item: SavedPosting,
  previous: string,
) {
  const data = JSON.stringify(savedPostingSchema.parse(item));
  if (Buffer.byteLength(data) > MAX_RECORD_BYTES)
    throw postingError('POSTING_TOO_LARGE');
  return {
    Put: {
      TableName: table,
      Item: { pk, sk: recordKey(item), data },
      ConditionExpression: '#data = :previous',
      ExpressionAttributeNames: { '#data': 'data' },
      ExpressionAttributeValues: { ':previous': previous },
    },
  };
}
export async function readRow(
  table: string,
  send: DynamoTransport,
  pk: string,
  sk: string,
  signal: AbortSignal,
) {
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
  return result.Item;
}
export function createPostingOperations(
  table: string,
  send: DynamoTransport,
): PostingOperations {
  async function lookup(userId: string, id: string, signal: AbortSignal) {
    const pk = `USER#${userId}`;
    const pointer = await readRow(table, send, pk, `ID#${id}`, signal);
    if (!pointer) throw postingError('NOT_FOUND');
    if (
      pointer.pk !== pk ||
      pointer.sk !== `ID#${id}` ||
      typeof pointer.recordKey !== 'string'
    )
      throw postingError('INVALID_STORED_POSTING');
    const row = await readRow(table, send, pk, pointer.recordKey, signal);
    if (!row) throw postingError('NOT_FOUND');
    const item = readRecord(row, pk, pointer.recordKey);
    if (item.id !== id || typeof row?.data !== 'string')
      throw postingError('INVALID_STORED_POSTING');
    return { pk, item, previous: row.data };
  }
  return {
    delete: (user, id, expectedApplicationVersion, signal) =>
      storageOperation(signal, async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          // Missing IDs (including another owner's IDs) are idempotent success.
          if (!(await readRow(table, send, `USER#${user}`, `ID#${id}`, signal)))
            return;
          let found: Awaited<ReturnType<typeof lookup>>;
          try {
            found = await lookup(user, id, signal);
          } catch (cause) {
            if (
              !(await readRow(table, send, `USER#${user}`, `ID#${id}`, signal))
            )
              return;
            throw cause;
          }
          const { pk, item, previous } = found;
          if (item.applicationVersion !== expectedApplicationVersion)
            throw postingError('CONFLICT');
          const key = recordKey(item);
          const pointerDelete = (sk: string) => ({
            Delete: {
              TableName: table,
              Key: { pk, sk },
              ConditionExpression: 'recordKey = :key',
              ExpressionAttributeValues: { ':key': key },
            },
          });
          try {
            await send(
              new TransactWriteCommand({
                TransactItems: [
                  ...companyMembershipWrites(
                    table,
                    pk,
                    item,
                    item.companyAssociation,
                    undefined,
                  ),
                  {
                    Delete: {
                      TableName: table,
                      Key: { pk, sk: key },
                      ConditionExpression: '#data = :previous',
                      ExpressionAttributeNames: { '#data': 'data' },
                      ExpressionAttributeValues: { ':previous': previous },
                    },
                  },
                  {
                    Delete: {
                      TableName: table,
                      Key: { pk, sk: `SOURCE#${id}` },
                      ConditionExpression:
                        'attribute_not_exists(pk) OR recordKey = :key',
                      ExpressionAttributeValues: { ':key': key },
                    },
                  },
                  pointerDelete(`ID#${id}`),
                  pointerDelete(
                    `URL#${createHash('sha256').update(item.sourceUrl).digest('hex')}`,
                  ),
                  ...(item.extraction.generation
                    ? [
                        {
                          Delete: {
                            TableName: table,
                            Key: {
                              pk,
                              sk: `JOB#${item.extraction.generation}`,
                            },
                            ConditionExpression:
                              'attribute_not_exists(pk) OR recordKey = :key',
                            ExpressionAttributeValues: { ':key': key },
                          },
                        },
                      ]
                    : []),
                  {
                    Put: {
                      TableName: table,
                      Item: {
                        pk,
                        sk: `DELETE#${id}`,
                        recordKey: key,
                        dueGroup: 'PENDING',
                        dueAt: Date.now(),
                        revision: 0,
                      },
                      ConditionExpression: 'attribute_not_exists(pk)',
                    },
                  },
                ],
              }),
              signal,
            );
            return;
          } catch (cause) {
            // A strong read also recovers a committed delete whose reply was lost.
            if (!(await readRow(table, send, pk, `ID#${id}`, signal))) return;
            try {
              const current = await lookup(user, id, signal);
              if (current.previous === previous) throw cause;
            } catch (readCause) {
              if (!(await readRow(table, send, pk, `ID#${id}`, signal))) return;
              throw readCause;
            }
          }
        }
        throw postingError('CONFLICT');
      }),
    get: (user, id, signal) =>
      storageOperation(
        signal,
        async () => (await lookup(user, id, signal)).item,
      ),
    update: (user, id, input, signal) =>
      storageOperation(signal, async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const { pk, item, previous } = await lookup(user, id, signal);
          if (item.applicationVersion !== input.expectedApplicationVersion)
            throw postingError('CONFLICT');
          const next = {
            ...item,
            application: { ...item.application, ...input.changes },
            edits: {
              overrides: item.edits?.overrides ?? {},
              pending: item.edits?.pending ?? null,
              revisions: {
                ...item.edits?.revisions,
                ...Object.fromEntries(
                  Object.keys(input.changes).map((key) => [
                    key,
                    item.recordVersion + 1,
                  ]),
                ),
              },
            },
            applicationVersion: item.applicationVersion + 1,
            recordVersion: item.recordVersion + 1,
            updatedAt: new Date().toISOString(),
          };
          try {
            await send(
              new TransactWriteCommand({
                TransactItems: [postingPut(table, pk, next, previous)],
              }),
              signal,
            );
            return next;
          } catch (cause) {
            const current = (await lookup(user, id, signal)).item;
            // An acknowledged read can recover our exact committed write after a lost reply.
            if (
              current.applicationVersion === next.applicationVersion &&
              JSON.stringify(current.application) ===
                JSON.stringify(next.application)
            )
              return current;
            if (current.recordVersion === item.recordVersion) throw cause;
          }
        }
        throw postingError('CONFLICT');
      }),
    sourceText: (user, id, signal) =>
      storageOperation(signal, async () => {
        const { pk, item } = await lookup(user, id, signal);
        return sourceResponse(table, send, pk, item, signal);
      }),
    extract: (user, id, expectedGeneration, signal, input, enabled = true) =>
      storageOperation(signal, () =>
        requestSourceExtraction(
          table,
          send,
          lookup,
          user,
          id,
          input ?? { expectedGeneration },
          signal,
          enabled,
        ),
      ),
  };
}
