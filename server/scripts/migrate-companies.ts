import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { createCompanyStore } from '../src/features/companies/companies.index.ts';
import { createPostingCompanies } from '../src/features/job-postings/job-postings.companies.ts';
import {
  createDynamoPostingStore,
  type DynamoTransport,
} from '../src/features/job-postings/job-postings.dynamodb.ts';
import { withCompanyAnalysisInvalidation } from '../src/features/job-postings/job-postings.index.ts';

// Operator-only, no direct inference or deployment. Membership writes can schedule enabled company analysis.
// Credentials come from the ordinary AWS chain.
const { values } = parseArgs({
  options: {
    table: { type: 'string' },
    region: { type: 'string' },
    account: { type: 'string' },
    checkpoint: { type: 'string' },
    apply: { type: 'boolean', default: false },
  },
});
const input = z
  .object({
    table: z.string().min(3),
    region: z.string().min(1),
    account: z.string().regex(/^\d{12}$/),
    checkpoint: z.string().min(1),
    apply: z.boolean(),
  })
  .parse(values);
const user = z.string().min(1).parse(process.env.COMPANY_MIGRATION_USER_ID);
const actual = String(
  execFileSync(
    'aws',
    [
      'sts',
      'get-caller-identity',
      '--query',
      'Account',
      '--output',
      'text',
      '--region',
      input.region,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ),
).trim();
if (actual !== input.account) throw new Error('Migration AWS account mismatch');
const target = createHash('sha256')
  .update(
    JSON.stringify([
      input.table,
      input.region,
      input.account,
      user,
      input.apply,
    ]),
  )
  .digest('hex');
const checkpointSchema = z.strictObject({
  target: z.string(),
  cursor: z.string().optional(),
  complete: z.boolean(),
  count: z.number().int().nonnegative(),
});
const checkpoint = existsSync(input.checkpoint)
  ? checkpointSchema.parse(JSON.parse(readFileSync(input.checkpoint, 'utf8')))
  : { target, cursor: undefined, complete: false, count: 0 };
if (checkpoint.target !== target)
  throw new Error('Checkpoint target or mode mismatch');
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: input.region, maxAttempts: 3 }),
);
const send: DynamoTransport = withCompanyAnalysisInvalidation(
  (command, signal) =>
    command instanceof GetCommand
      ? client.send(command, { abortSignal: signal })
      : command instanceof QueryCommand
        ? client.send(command, { abortSignal: signal })
        : client.send(command, { abortSignal: signal }),
);
const companies = createCompanyStore(input.table, send);
const postingCompanies = createPostingCompanies(input.table, send, companies);
const postings = createDynamoPostingStore(input.table, send);
try {
  while (!checkpoint.complete) {
    const page = await postings.list(
      user,
      { limit: 50, cursor: checkpoint.cursor },
      AbortSignal.timeout(30_000),
    );
    for (const item of page.items)
      if (
        await postingCompanies.backfill(
          user,
          item.id,
          AbortSignal.timeout(30_000),
          !input.apply,
        )
      )
        checkpoint.count++;
    checkpoint.cursor = page.nextCursor ?? undefined;
    checkpoint.complete = !page.nextCursor;
    writeFileSync(`${input.checkpoint}.tmp`, JSON.stringify(checkpoint), {
      mode: 0o600,
    });
    renameSync(`${input.checkpoint}.tmp`, input.checkpoint);
  }
  console.log(
    JSON.stringify({
      event: 'company-backfill.complete',
      dryRun: !input.apply,
      count: checkpoint.count,
    }),
  );
} catch {
  console.error(JSON.stringify({ event: 'company-backfill.failed' }));
  process.exitCode = 1;
} finally {
  client.destroy();
}
