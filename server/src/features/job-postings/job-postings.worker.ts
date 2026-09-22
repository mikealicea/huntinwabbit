import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { AppError } from '../../shared/shared.errors.ts';
import {
  type CompanyStore,
  companyMembershipWrites,
  companySummary,
  createCompanyStore,
  shortlistCompanies,
} from '../companies/companies.index.ts';
import {
  createFetchPosting,
  createParsePosting,
  createRedpillExtractor,
  jobParsingConfig,
  type ParsePosting,
  type ParseResponse,
} from '../job-parsing/job-parsing.index.ts';
import { cleanupDeletedPosting } from './job-postings.cleanup.ts';
import { jobPostingsTable } from './job-postings.config.ts';
import { type DynamoTransport, readRecord } from './job-postings.dynamodb.ts';
import { postingPut, readRow } from './job-postings.operations.ts';
import type { SavedPosting } from './job-postings.schemas.ts';
import { readSource } from './job-postings.source.ts';
import { effectiveFields } from './job-postings.updates.logic.ts';
import { createRoleUpdateParser } from './job-postings.updates.redpill.ts';
import type { ParseUpdates } from './job-postings.updates.schemas.ts';
import { createRoleUpdates } from './job-postings.updates.ts';

const jobSchema = z.object({
  pk: z.string().startsWith('USER#'),
  sk: z.string().startsWith('JOB#'),
  recordKey: z.string(),
  generation: z.uuid(),
  sourceRevision: z.uuid().optional(),
  status: z.enum(['queued', 'processing', 'complete', 'failed']),
  dueAt: z.number().optional(),
  dueGroup: z.literal('PENDING').optional(),
  expiresAt: z.number().optional(),
});
type Job = z.infer<typeof jobSchema>;
export function createExtractionWorker(
  table: string,
  send: DynamoTransport,
  parse: ParsePosting | undefined,
  now = Date.now,
  parseUpdates?: ParseUpdates,
  companies?: CompanyStore,
) {
  const updates = createRoleUpdates(
    table,
    send,
    !!parseUpdates,
    parseUpdates,
    now,
    companies,
  );
  async function transition(
    job: Job,
    status: Job['status'],
    result?: ParseResponse,
    error: string | null = null,
    suggestedCompany?: string,
  ) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const signal = AbortSignal.timeout(10_000);
      const currentValue = await readRow(table, send, job.pk, job.sk, signal);
      if (!currentValue) return false;
      const currentJob = jobSchema.parse(currentValue);
      if (currentJob.status !== job.status) return false;
      const row = await readRow(table, send, job.pk, job.recordKey, signal);
      if (!row) return false;
      const posting = readRecord(row, job.pk, job.recordKey);
      if (posting.extraction.generation !== job.generation) return false;
      if (typeof row?.data !== 'string')
        throw new Error('Invalid stored posting');
      const next: SavedPosting = {
        ...posting,
        parsedPosting: result ?? posting.parsedPosting,
        updatedAt: new Date(now()).toISOString(),
        recordVersion: posting.recordVersion + 1,
        extraction: { status, generation: job.generation, error },
      };
      if (
        result &&
        companies &&
        posting.companyAssociation?.mode !== 'manual'
      ) {
        const fields = effectiveFields(next);
        const company = await companies.resolve(
          job.pk,
          fields.companyName,
          fields.companyWebsite,
          signal,
          posting.edits?.overrides.companyName === undefined &&
            posting.edits?.overrides.companyWebsite === undefined
            ? suggestedCompany
            : undefined,
        );
        next.companyAssociation = {
          company: companySummary(company),
          mode: 'automatic',
          revision: (posting.companyAssociation?.revision ?? 0) + 1,
        };
      }
      const nextJob =
        status === 'processing'
          ? { ...job, status, dueAt: now() + 180_000, dueGroup: 'PENDING' }
          : {
              pk: job.pk,
              sk: job.sk,
              recordKey: job.recordKey,
              generation: job.generation,
              status,
              expiresAt: Math.floor(now() / 1000) + 7 * 86400,
            };
      try {
        await send(
          new TransactWriteCommand({
            TransactItems: [
              postingPut(table, job.pk, next, row.data),
              ...companyMembershipWrites(
                table,
                job.pk,
                next,
                posting.companyAssociation,
                next.companyAssociation,
              ),
              {
                Put: {
                  TableName: table,
                  Item: nextJob,
                  ConditionExpression: '#status = :status',
                  ExpressionAttributeNames: { '#status': 'status' },
                  ExpressionAttributeValues: { ':status': job.status },
                },
              },
            ],
          }),
          signal,
        );
        return true;
      } catch (cause) {
        const latestValue = await readRow(table, send, job.pk, job.sk, signal);
        if (!latestValue) return false;
        const latest = jobSchema.parse(latestValue);
        // Never infer ownership of an uncertain claim: recovery will mark it failed.
        if (latest.status !== job.status) return false;
        const latestRow = await readRow(
          table,
          send,
          job.pk,
          job.recordKey,
          signal,
        );
        if (latestRow?.data === row.data) throw cause;
      }
    }
    throw new Error('Posting contention');
  }
  return {
    async run(pk: string, sk: string) {
      if (sk.startsWith('JOB#UPDATE-ID#') || sk.startsWith('JOB#SOURCE-ID#'))
        return;
      if (sk.startsWith('JOB#UPDATE#')) return updates.run(pk, sk);
      const value = await readRow(
        table,
        send,
        pk,
        sk,
        AbortSignal.timeout(10_000),
      );
      if (!value) return;
      const job = jobSchema.parse(value);
      if (job.pk !== pk || job.sk !== sk || sk !== `JOB#${job.generation}`)
        throw new Error('Invalid job');
      if (job.status !== 'queued') return;
      if (!parse) {
        await transition(job, 'failed', undefined, 'PARSING_DISABLED');
        return;
      }
      if (!(await transition(job, 'processing'))) return;
      const claimed: Job = { ...job, status: 'processing' };
      let result: ParseResponse;
      let suggestedCompany: string | undefined;
      try {
        const row = await readRow(
          table,
          send,
          pk,
          job.recordKey,
          AbortSignal.timeout(10_000),
        );
        if (!row) return;
        const posting = readRecord(row, pk, job.recordKey);
        if (
          posting.extraction.generation !== job.generation ||
          posting.extraction.status !== 'processing'
        )
          return;
        const parseSignal = AbortSignal.timeout(60_000);
        const source = job.sourceRevision
          ? await readSource(
              table,
              send,
              pk,
              posting,
              AbortSignal.any([parseSignal, AbortSignal.timeout(10_000)]),
            )
          : null;
        if (
          job.sourceRevision &&
          (!source ||
            source.revision !== job.sourceRevision ||
            source.sourceUrl !== posting.sourceUrl)
        )
          throw new Error('Posting source changed');
        result = await parse(
          posting.sourceUrl,
          parseSignal,
          companies && posting.companyAssociation?.mode !== 'manual'
            ? {
                candidates: async (text, signal) =>
                  shortlistCompanies(await companies.all(pk, signal), text),
                matched: (id) => {
                  suggestedCompany = id;
                },
              }
            : undefined,
          source?.text,
        );
      } catch (cause) {
        await transition(
          claimed,
          'failed',
          undefined,
          cause instanceof AppError
            ? (cause.code ?? 'EXTRACTION_FAILED')
            : 'EXTRACTION_FAILED',
        );
        console.log(JSON.stringify({ event: 'extraction.failed' }));
        return;
      }
      if (await transition(claimed, 'complete', result, null, suggestedCompany))
        console.log(JSON.stringify({ event: 'extraction.completed' }));
    },
    async recover() {
      let cursor: Record<string, unknown> | undefined;
      do {
        const page = z
          .object({
            Items: z.array(z.unknown()).default([]),
            LastEvaluatedKey: z.record(z.string(), z.unknown()).optional(),
          })
          .parse(
            await send(
              new QueryCommand({
                TableName: table,
                IndexName: 'PendingJobs',
                KeyConditionExpression: 'dueGroup = :group AND dueAt <= :now',
                ExpressionAttributeValues: {
                  ':group': 'PENDING',
                  ':now': now(),
                },
                Limit: 50,
                ExclusiveStartKey: cursor,
              }),
              AbortSignal.timeout(10_000),
            ),
          );
        for (const value of page.Items) {
          const key = z.object({ pk: z.string(), sk: z.string() }).parse(value);
          if (key.sk.startsWith('JOB#UPDATE#')) {
            await updates.recover(key.pk, key.sk);
            continue;
          }
          if (key.sk.startsWith('DELETE#')) {
            await cleanupDeletedPosting(table, send, key.pk, key.sk, now());
            continue;
          }
          const job = jobSchema.parse(value);
          // GSI results can be stale; transition checks the current status and generation.
          if (job.status === 'queued' || job.status === 'processing')
            await transition(
              job,
              'failed',
              undefined,
              job.status === 'processing'
                ? 'EXTRACTION_INTERRUPTED'
                : 'EXTRACTION_DELAYED',
            );
        }
        cursor = page.LastEvaluatedKey;
      } while (cursor);
    },
  };
}
function runtime() {
  const table = jobPostingsTable(process.env);
  if (!table) throw new Error('Storage is required');
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({ maxAttempts: 3 }),
  );
  const send: DynamoTransport = (command, signal) => {
    if (command instanceof GetCommand)
      return client.send(command, { abortSignal: signal });
    if (command instanceof QueryCommand)
      return client.send(command, { abortSignal: signal });
    return client.send(command, { abortSignal: signal });
  };
  const config = jobParsingConfig(process.env);
  return createExtractionWorker(
    table,
    send,
    config.enabled
      ? createParsePosting({
          fetchPosting: createFetchPosting(),
          extractPosting: createRedpillExtractor(config.apiKey),
        })
      : undefined,
    Date.now,
    config.enabled ? createRoleUpdateParser(config.apiKey) : undefined,
    createCompanyStore(table, send),
  );
}
const streamSchema = z.object({
  Records: z.array(
    z.object({
      dynamodb: z.object({
        Keys: z.object({
          pk: z.object({ S: z.string() }),
          sk: z.object({ S: z.string() }),
        }),
      }),
    }),
  ),
});
export async function handler(event: unknown) {
  try {
    const input = streamSchema.parse(event);
    const worker = runtime();
    for (const record of input.Records) {
      const { pk, sk } = record.dynamodb.Keys;
      await worker.run(pk.S, sk.S);
    }
  } catch {
    // Lambda logs uncaught errors; replace SDK/model errors with a content-free error.
    throw new Error('Extraction worker failed');
  }
}
export async function recover() {
  try {
    await runtime().recover();
  } catch {
    throw new Error('Extraction recovery failed');
  }
}
