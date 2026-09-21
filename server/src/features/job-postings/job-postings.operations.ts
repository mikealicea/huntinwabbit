import { randomUUID } from 'node:crypto';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
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
    const item = readRecord(row, pk, pointer.recordKey);
    if (item.id !== id || typeof row?.data !== 'string')
      throw postingError('INVALID_STORED_POSTING');
    return { pk, item, previous: row.data };
  }
  return {
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
    extract: (user, id, expectedGeneration, signal) =>
      storageOperation(signal, async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const { pk, item, previous } = await lookup(user, id, signal);
          if (['queued', 'processing'].includes(item.extraction.status))
            return item;
          if (
            item.extraction.generation !== expectedGeneration ||
            item.extraction.status === 'complete'
          )
            throw postingError('CONFLICT');
          const next: SavedPosting = {
            ...item,
            recordVersion: item.recordVersion + 1,
            updatedAt: new Date().toISOString(),
            extraction: {
              status: 'queued',
              generation: randomUUID(),
              error: null,
            },
          };
          try {
            await send(
              new TransactWriteCommand({
                ClientRequestToken: next.extraction.generation ?? undefined,
                TransactItems: [
                  postingPut(table, pk, next, previous),
                  {
                    Put: {
                      TableName: table,
                      Item: jobRow(pk, next),
                      ConditionExpression: 'attribute_not_exists(pk)',
                    },
                  },
                ],
              }),
              signal,
            );
            return next;
          } catch (cause) {
            const current = (await lookup(user, id, signal)).item;
            if (['queued', 'processing'].includes(current.extraction.status))
              return current;
            if (current.recordVersion === item.recordVersion) throw cause;
          }
        }
        throw postingError('CONFLICT');
      }),
  };
}
