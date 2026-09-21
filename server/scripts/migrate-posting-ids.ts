import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { readRecord } from '../src/features/job-postings/job-postings.dynamodb.ts';

// Explicit operator tool, never part of runtime IAM. No content is printed.
const table = process.env.JOB_POSTINGS_TABLE;
if (table !== 'huntinwabbit-dev-job-postings')
  throw new Error('Migration requires the explicit dev table');
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: 'us-east-1', maxAttempts: 3 }),
);
let cursor: Record<string, unknown> | undefined;
let count = 0;
do {
  const page = await client.send(
    new ScanCommand({
      TableName: table,
      ConsistentRead: true,
      ExclusiveStartKey: cursor,
      FilterExpression: 'begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'POSTING#' },
    }),
  );
  for (const value of page.Items ?? []) {
    const row = z.object({ pk: z.string(), sk: z.string() }).parse(value);
    const item = readRecord(value, row.pk, row.sk);
    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: table,
              Item: { pk: row.pk, sk: `ID#${item.id}`, recordKey: row.sk },
              ConditionExpression:
                'attribute_not_exists(pk) OR recordKey = :key',
              ExpressionAttributeValues: { ':key': row.sk },
            },
          },
        ],
      }),
    );
    count++;
  }
  cursor = page.LastEvaluatedKey;
} while (cursor);
console.log(JSON.stringify({ event: 'posting-id-migration.complete', count }));
