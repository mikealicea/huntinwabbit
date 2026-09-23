import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import {
  type CompanyStore,
  createCompanyStore,
} from '../src/features/companies/companies.index.ts';
import {
  createPostingCompanies,
  type PostingCompanies,
} from '../src/features/job-postings/job-postings.companies.ts';
import {
  createDynamoPostingStore,
  type DynamoTransport,
} from '../src/features/job-postings/job-postings.dynamodb.ts';
import { withCompanyAnalysisInvalidation } from '../src/features/job-postings/job-postings.index.ts';
import type { PostingStore } from '../src/features/job-postings/job-postings.schemas.ts';

export const reassignmentSchema = z
  .strictObject({
    account: z.string().regex(/^\d{12}$/),
    role: z.uuid(),
    from: z.uuid(),
    to: z.uuid(),
    version: z.coerce.number().int().nonnegative(),
    apply: z.boolean().default(false),
  })
  .refine((input) => input.from !== input.to, 'Choose distinct companies');

// One explicitly reviewed role, using the same conditional writes as the picker.
export async function reassignCompany(
  input: z.infer<typeof reassignmentSchema>,
  actualAccount: string,
  user: string,
  dependencies: {
    companies: Pick<CompanyStore, 'get'>;
    postings: Pick<PostingStore, 'get'>;
    associations: Pick<PostingCompanies, 'select'>;
  },
  signal: AbortSignal,
) {
  if (actualAccount !== input.account) throw new Error('AWS account mismatch');
  await dependencies.companies.get(`USER#${user}`, input.from, signal);
  await dependencies.companies.get(`USER#${user}`, input.to, signal);
  const item = await dependencies.postings.get(user, input.role, signal);
  if (item.companyAssociation?.company?.id === input.to)
    return 'already-assigned';
  if (
    item.companyAssociation?.company?.id !== input.from ||
    item.recordVersion !== input.version
  )
    throw new Error('Role association or version changed');
  if (!input.apply) return 'eligible';
  await dependencies.associations.select(
    user,
    input.role,
    {
      expectedRecordVersion: input.version,
      selection: { id: input.to },
    },
    signal,
  );
  const current = await dependencies.postings.get(user, input.role, signal);
  if (current.companyAssociation?.company?.id !== input.to)
    throw new Error('Reassignment readback failed');
  return 'reassigned';
}

async function main() {
  const { values } = parseArgs({
    options: {
      table: { type: 'string' },
      region: { type: 'string' },
      account: { type: 'string' },
      role: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      version: { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
  });
  const { table, region, ...args } = values;
  const target = z
    .object({
      table: z.string().min(3),
      region: z.string().min(1),
      user: z.string().min(1),
    })
    .parse({ table, region, user: process.env.COMPANY_MIGRATION_USER_ID });
  const input = reassignmentSchema.parse(args);
  const actualAccount = execFileSync(
    'aws',
    [
      'sts',
      'get-caller-identity',
      '--query',
      'Account',
      '--output',
      'text',
      '--region',
      target.region,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ).trim();
  if (actualAccount !== input.account) throw new Error('AWS account mismatch');
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: target.region, maxAttempts: 3 }),
  );
  const send: DynamoTransport = withCompanyAnalysisInvalidation(
    (command, signal) =>
      command instanceof GetCommand
        ? client.send(command, { abortSignal: signal })
        : command instanceof QueryCommand
          ? client.send(command, { abortSignal: signal })
          : client.send(command, { abortSignal: signal }),
  );
  try {
    const companies = createCompanyStore(target.table, send);
    const status = await reassignCompany(
      input,
      actualAccount,
      target.user,
      {
        companies,
        postings: createDynamoPostingStore(target.table, send),
        associations: createPostingCompanies(target.table, send, companies),
      },
      AbortSignal.timeout(30_000),
    );
    console.log(
      JSON.stringify({
        event: 'company-reassignment.complete',
        dryRun: !input.apply,
        status,
      }),
    );
  } finally {
    client.destroy();
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch {
    console.error(JSON.stringify({ event: 'company-reassignment.failed' }));
    process.exitCode = 1;
  }
}
