import { QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import type { DynamoTransport } from './job-postings.dynamodb.ts';
import { readRow } from './job-postings.operations.ts';

const keySchema = z.strictObject({ pk: z.string(), sk: z.string() });
const cleanupSchema = z.strictObject({
  pk: z.string().startsWith('USER#'),
  sk: z.string().startsWith('DELETE#'),
  recordKey: z.string().startsWith('POSTING#'),
  dueGroup: z.literal('PENDING'),
  dueAt: z.number(),
  revision: z.number().int().nonnegative(),
  phase: z.enum(['jobs', 'notes']).default('jobs'),
  cursor: keySchema.optional(),
});

// At most one bounded page per phase per scheduled pass. Old markers start at jobs.
export async function cleanupDeletedPosting(
  table: string,
  send: DynamoTransport,
  pk: string,
  sk: string,
  now: number,
) {
  const signal = AbortSignal.timeout(10_000);
  for (let phase = 0; phase < 2; phase++) {
    const value = await readRow(table, send, pk, sk, signal);
    if (!value) return;
    const marker = cleanupSchema.parse(value);
    const id = z.uuid().parse(sk.slice('DELETE#'.length));
    const prefix = marker.phase === 'jobs' ? 'JOB#' : `NOTE#${id}#`;
    if (
      marker.pk !== pk ||
      marker.sk !== sk ||
      !marker.recordKey.endsWith(`#${id}`) ||
      (marker.cursor &&
        (marker.cursor.pk !== pk || !marker.cursor.sk.startsWith(prefix)))
    )
      throw new Error('Invalid deletion cleanup');
    if (marker.dueAt > now) return;
    const page = z
      .object({
        Items: z
          .array(
            z.object({ pk: z.string(), sk: z.string(), recordKey: z.string() }),
          )
          .default([]),
        LastEvaluatedKey: keySchema.optional(),
      })
      .parse(
        await send(
          new QueryCommand({
            TableName: table,
            ConsistentRead: true,
            KeyConditionExpression: 'pk = :owner AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: { ':owner': pk, ':prefix': prefix },
            Limit: 50,
            ExclusiveStartKey: marker.cursor,
          }),
          signal,
        ),
      );
    if (
      page.Items.some((row) => row.pk !== pk || !row.sk.startsWith(prefix)) ||
      (page.LastEvaluatedKey &&
        (page.LastEvaluatedKey.pk !== pk ||
          !page.LastEvaluatedKey.sk.startsWith(prefix)))
    )
      throw new Error('Invalid cleanup page');
    const { cursor: _cursor, ...base } = marker;
    const nextPhase = !page.LastEvaluatedKey && marker.phase === 'jobs';
    const condition = {
      ConditionExpression: 'revision = :revision',
      ExpressionAttributeValues: { ':revision': marker.revision },
    };
    try {
      await send(
        new TransactWriteCommand({
          TransactItems: [
            ...page.Items.filter(
              (row) => row.recordKey === marker.recordKey,
            ).map((row) => ({
              Delete: {
                TableName: table,
                Key: { pk, sk: row.sk },
                ConditionExpression:
                  'attribute_not_exists(pk) OR recordKey = :key',
                ExpressionAttributeValues: { ':key': marker.recordKey },
              },
            })),
            page.LastEvaluatedKey || nextPhase
              ? {
                  Put: {
                    TableName: table,
                    Item: {
                      ...base,
                      phase: nextPhase ? 'notes' : marker.phase,
                      ...(page.LastEvaluatedKey
                        ? { cursor: page.LastEvaluatedKey }
                        : {}),
                      revision: marker.revision + 1,
                      dueAt: nextPhase ? now : now + 60_000,
                    },
                    ...condition,
                  },
                }
              : { Delete: { TableName: table, Key: { pk, sk }, ...condition } },
          ],
        }),
        signal,
      );
    } catch (cause) {
      const latest = await readRow(table, send, pk, sk, signal);
      if (!latest || cleanupSchema.parse(latest).revision !== marker.revision)
        return;
      throw cause;
    }
    if (!nextPhase) return;
  }
}
