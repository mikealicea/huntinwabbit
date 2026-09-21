import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { AppError } from '../../shared/shared.errors.ts';
import { normalizeJobUrl } from '../job-parsing/job-parsing.index.ts';
import { postingError } from './job-postings.errors.ts';
import { createPostingOperations, jobRow } from './job-postings.operations.ts';
import {
  MAX_RECORD_BYTES,
  type PostingStore,
  type SavedPosting,
  storedPostingSchema,
} from './job-postings.schemas.ts';

export type DynamoTransport = (
  command: GetCommand | QueryCommand | TransactWriteCommand,
  signal: AbortSignal,
) => Promise<unknown>;
const recordKeySchema = z
  .string()
  .regex(/^POSTING#\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z#[0-9a-f-]{36}$/);
const rowSchema = z.strictObject({
  pk: z.string(),
  sk: recordKeySchema,
  data: z.string(),
});
const pointerSchema = z.strictObject({
  pk: z.string(),
  sk: z.string(),
  recordKey: recordKeySchema,
});
const cursorSchema = z.strictObject({
  version: z.literal(1),
  owner: z.string(),
  after: recordKeySchema,
});
function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function recordKey(item: SavedPosting): string {
  return `POSTING#${item.createdAt}#${item.id}`;
}
function decodeCursor(
  cursor: string | undefined,
  userId: string,
): string | undefined {
  if (!cursor) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const value = cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    if (value.owner !== hash(userId)) throw new Error();
    return value.after;
  } catch (cause) {
    throw postingError('INVALID_CURSOR', cause);
  }
}
function encodeCursor(after: string, userId: string): string {
  return Buffer.from(
    JSON.stringify({ version: 1, owner: hash(userId), after }),
  ).toString('base64url');
}
export function readRecord(
  value: unknown,
  pk: string,
  expectedKey?: string,
): SavedPosting {
  try {
    const row = rowSchema.parse(value);
    if (
      row.pk !== pk ||
      (expectedKey && row.sk !== expectedKey) ||
      Buffer.byteLength(row.data) > MAX_RECORD_BYTES
    )
      throw new Error();
    const item: SavedPosting = storedPostingSchema.parse(JSON.parse(row.data));
    if (
      recordKey(item) !== row.sk ||
      normalizeJobUrl(item.sourceUrl) !== item.sourceUrl ||
      item.updatedAt < item.createdAt
    )
      throw new Error();
    if (
      item.parsedPosting &&
      (normalizeJobUrl(item.parsedPosting.source.normalizedUrl) !==
        item.parsedPosting.source.normalizedUrl ||
        (item.parsedPosting.source.normalizedUrl !== item.sourceUrl &&
          item.edits?.revisions.sourceUrl === undefined))
    )
      throw new Error();
    return item;
  } catch (cause) {
    throw postingError('INVALID_STORED_POSTING', cause);
  }
}
// Bound credential resolution as well as HTTP/retries. A timed-out write may have committed.
export async function storageOperation<T>(
  signal: AbortSignal,
  work: () => Promise<T>,
): Promise<T> {
  let abort = () => {};
  try {
    signal.throwIfAborted();
    return await Promise.race([
      work(),
      new Promise<never>((_resolve, reject) => {
        abort = () => reject(postingError('STORAGE_UNAVAILABLE'));
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      }),
    ]);
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw postingError('STORAGE_UNAVAILABLE', cause);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

export function createDynamoPostingStore(
  tableName: string,
  transport?: DynamoTransport,
): PostingStore {
  const send = transport ?? createDynamoTransport();
  async function existing(
    pk: string,
    url: string,
    signal: AbortSignal,
  ): Promise<SavedPosting | undefined> {
    const sk = `URL#${hash(url)}`;
    const response = z.object({ Item: z.unknown().optional() }).parse(
      await send(
        new GetCommand({
          TableName: tableName,
          Key: { pk, sk },
          ConsistentRead: true,
        }),
        signal,
      ),
    );
    if (response.Item === undefined) return undefined;
    let pointer: z.infer<typeof pointerSchema>;
    try {
      pointer = pointerSchema.parse(response.Item);
      if (pointer.pk !== pk || pointer.sk !== sk) throw new Error();
    } catch (cause) {
      throw postingError('INVALID_STORED_POSTING', cause);
    }
    const record = z.object({ Item: z.unknown().optional() }).parse(
      await send(
        new GetCommand({
          TableName: tableName,
          Key: { pk, sk: pointer.recordKey },
          ConsistentRead: true,
        }),
        signal,
      ),
    );
    const item = readRecord(record.Item, pk, pointer.recordKey);
    if (item.sourceUrl !== url) throw postingError('INVALID_STORED_POSTING');
    return item;
  }
  return {
    ...createPostingOperations(tableName, send),
    save(userId, item, signal) {
      return storageOperation(signal, async () => {
        const pk = `USER#${userId}`;
        const prior = await existing(pk, item.sourceUrl, signal);
        if (prior) return { item: prior, created: false };
        const data = JSON.stringify(item);
        if (Buffer.byteLength(data) > MAX_RECORD_BYTES)
          throw postingError('POSTING_TOO_LARGE');
        try {
          await send(
            new TransactWriteCommand({
              ClientRequestToken: item.id,
              TransactItems: [
                {
                  Put: {
                    TableName: tableName,
                    Item: {
                      pk,
                      sk: `ID#${item.id}`,
                      recordKey: recordKey(item),
                    },
                    ConditionExpression: 'attribute_not_exists(pk)',
                  },
                },
                ...(item.extraction.status === 'queued'
                  ? [
                      {
                        Put: {
                          TableName: tableName,
                          Item: jobRow(pk, item),
                          ConditionExpression: 'attribute_not_exists(pk)',
                        },
                      },
                    ]
                  : []),
                {
                  Put: {
                    TableName: tableName,
                    Item: {
                      pk,
                      sk: `URL#${hash(item.sourceUrl)}`,
                      recordKey: recordKey(item),
                    },
                    ConditionExpression: 'attribute_not_exists(pk)',
                  },
                },
                // JSON keeps the bounded record size independent of DynamoDB map/list overhead.
                {
                  Put: {
                    TableName: tableName,
                    Item: { pk, sk: recordKey(item), data },
                    ConditionExpression: 'attribute_not_exists(pk)',
                  },
                },
              ],
            }),
            signal,
          );
          return { item, created: true };
        } catch (cause) {
          // Also recover a committed transaction whose acknowledgement was lost.
          if (!signal.aborted) {
            const winner = await existing(pk, item.sourceUrl, signal);
            if (winner) return { item: winner, created: false };
          }
          throw cause;
        }
      });
    },
    list(userId, input, signal) {
      const after = decodeCursor(input.cursor, userId);
      return storageOperation(signal, async () => {
        const pk = `USER#${userId}`;
        const response = await send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'pk = :owner AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: { ':owner': pk, ':prefix': 'POSTING#' },
            ConsistentRead: true,
            ScanIndexForward: false,
            Limit: input.limit,
            ...(after ? { ExclusiveStartKey: { pk, sk: after } } : {}),
          }),
          signal,
        );
        try {
          const page = z
            .object({
              Items: z.array(z.unknown()),
              LastEvaluatedKey: z
                .strictObject({ pk: z.string(), sk: recordKeySchema })
                .optional(),
            })
            .parse(response);
          if (
            page.Items.length > input.limit ||
            (page.LastEvaluatedKey && page.LastEvaluatedKey.pk !== pk)
          )
            throw new Error();
          const items = page.Items.map((row) => readRecord(row, pk));
          return {
            schemaVersion: 1,
            items,
            nextCursor: page.LastEvaluatedKey
              ? encodeCursor(page.LastEvaluatedKey.sk, userId)
              : null,
          };
        } catch (cause) {
          throw postingError('INVALID_STORED_POSTING', cause);
        }
      });
    },
  };
}

export function createDynamoTransport(): DynamoTransport {
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({ maxAttempts: 3 }),
  );
  return (command, signal) => {
    if (command instanceof GetCommand)
      return client.send(command, { abortSignal: signal });
    if (command instanceof QueryCommand)
      return client.send(command, { abortSignal: signal });
    return client.send(command, { abortSignal: signal });
  };
}
