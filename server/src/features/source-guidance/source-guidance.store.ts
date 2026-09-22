import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { AppError } from '../../shared/shared.errors.ts';
import {
  normalizeSourceHostname,
  type SourceGuidance,
} from './source-guidance.schemas.ts';

export type GuidanceTransport = (
  command: GetCommand | TransactWriteCommand,
  signal: AbortSignal,
) => Promise<unknown>;
const storedSchema = z.strictObject({
  pk: z.string(),
  sk: z.literal('GUIDANCE'),
  hostname: z.string(),
  blocked: z.boolean(),
  order: z.string().regex(/^\d{13}#[0-9a-f-]{36}$/),
});
const seeds = new Set(['indeed.com']);

// Bound credential resolution as well as SDK retries; late writes remain ordered.
async function bounded<T>(
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Guidance storage timeout'));
        }, 2_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function createSourceGuidance(
  table?: string,
  transport?: GuidanceTransport,
): SourceGuidance {
  const client =
    table && !transport
      ? DynamoDBDocumentClient.from(new DynamoDBClient({ maxAttempts: 3 }))
      : undefined;
  const send: GuidanceTransport =
    transport ??
    ((command, signal) => {
      if (!client) throw new Error('Guidance storage unavailable');
      if (command instanceof GetCommand)
        return client.send(command, { abortSignal: signal });
      return client.send(command, { abortSignal: signal });
    });
  return {
    async lookup(input) {
      const hostname = normalizeSourceHostname(input);
      if (seeds.has(hostname)) return { hostname, recommendSourceText: true };
      try {
        if (!table) throw new Error('Guidance storage unavailable');
        const key = { pk: `SOURCE-GUIDANCE#${hostname}`, sk: 'GUIDANCE' };
        const result = z.object({ Item: z.unknown().optional() }).parse(
          await bounded((signal) =>
            send(
              new GetCommand({
                TableName: table,
                Key: key,
                ConsistentRead: true,
              }),
              signal,
            ),
          ),
        );
        if (result.Item === undefined)
          return { hostname, recommendSourceText: false };
        const row = storedSchema.parse(result.Item);
        if (row.pk !== key.pk || row.hostname !== hostname)
          throw new Error('Invalid guidance record');
        return { hostname, recommendSourceText: row.blocked };
      } catch (cause) {
        throw new AppError(503, 'Source guidance is temporarily unavailable.', {
          code: 'GUIDANCE_UNAVAILABLE',
          cause,
        });
      }
    },
    async observe(observation) {
      try {
        const hostname = normalizeSourceHostname(observation.hostname);
        if (seeds.has(hostname) || !table) return;
        const row = storedSchema.parse({
          pk: `SOURCE-GUIDANCE#${hostname}`,
          sk: 'GUIDANCE',
          hostname,
          blocked: observation.outcome === 'blocked',
          order: observation.order,
        });
        await bounded((signal) =>
          send(
            new TransactWriteCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: table,
                    Item: row,
                    // Keep inactive records: deleting them would let delayed older blocks return.
                    ConditionExpression:
                      'attribute_not_exists(pk) OR #order < :order',
                    ExpressionAttributeNames: { '#order': 'order' },
                    ExpressionAttributeValues: { ':order': row.order },
                  },
                },
              ],
            }),
            signal,
          ),
        );
      } catch (cause) {
        const error = z
          .object({
            name: z.string(),
            CancellationReasons: z
              .array(z.object({ Code: z.string().optional() }))
              .optional(),
          })
          .safeParse(cause);
        if (
          error.success &&
          error.data.name === 'TransactionCanceledException' &&
          error.data.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed'
        )
          return;
        // Advisory updates never revoke extraction. Do not expose hostname or raw causes.
        console.warn(
          JSON.stringify({ event: 'source_guidance.observation_failed' }),
        );
      }
    },
  };
}
