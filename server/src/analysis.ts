import { z } from 'zod';
import { createCompanyStore } from './features/companies/companies.index.ts';
import {
  companyAnalysisConfig,
  companyAnalysisEnabled,
  createCompanyAnalysis,
  createCompanyAnalyzer,
} from './features/company-analysis/company-analysis.index.ts';
import {
  createCompanyAnalysisInputs,
  createDynamoTransport,
  jobPostingsTable,
} from './features/job-postings/job-postings.index.ts';

function runtime(inference = true) {
  const enabled = companyAnalysisEnabled(process.env);
  const config = inference
    ? companyAnalysisConfig(process.env)
    : { enabled: false as const };
  const table = jobPostingsTable(process.env);
  if (!table) throw new Error('Analysis storage is required');
  const send = createDynamoTransport(),
    companies = createCompanyStore(table, send);
  return createCompanyAnalysis({
    table,
    send,
    enabled,
    company: companies.get,
    readInputs: createCompanyAnalysisInputs(table, send, companies),
    analyze: config.enabled ? createCompanyAnalyzer(config.apiKey) : undefined,
  });
}
export async function handler(event: unknown) {
  try {
    const input = z
      .object({
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
      })
      .parse(event);
    const worker = runtime();
    for (const record of input.Records)
      await worker.run(record.dynamodb.Keys.pk.S, record.dynamodb.Keys.sk.S);
  } catch {
    throw new Error('Company analysis worker failed');
  }
}
export async function recover() {
  try {
    await runtime(false).recover();
  } catch {
    throw new Error('Company analysis recovery failed');
  }
}
