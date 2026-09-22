import { buildApp } from './app.ts';
import {
  authConfig,
  createAccessTokenVerifier,
} from './features/auth/auth.index.ts';
import { createCompanyStore } from './features/companies/companies.index.ts';
import {
  companyAnalysisConfig,
  createCompanyAnalysis,
} from './features/company-analysis/company-analysis.index.ts';
import {
  createFetchPosting,
  createParsePosting,
  createRedpillExtractor,
  jobParsingConfig,
} from './features/job-parsing/job-parsing.index.ts';
import {
  createDynamoPostingStore,
  createDynamoTransport,
  createJobPostings,
  createPostingCompanies,
  createRoleNotes,
  createRoleUpdates,
  jobPostingsTable,
  withCompanyAnalysisInvalidation,
} from './features/job-postings/job-postings.index.ts';

export function buildRuntimeApp(
  env: Record<string, string | undefined> = process.env,
) {
  const verifyAccessToken = createAccessTokenVerifier(authConfig(env));
  const config = jobParsingConfig(env);
  const parsePosting = config.enabled
    ? createParsePosting({
        fetchPosting: createFetchPosting(),
        extractPosting: createRedpillExtractor(config.apiKey),
      })
    : undefined;
  const table = jobPostingsTable(env);
  const send = withCompanyAnalysisInvalidation(createDynamoTransport());
  const analysisConfig = companyAnalysisConfig(env);
  const companies = table ? createCompanyStore(table, send) : undefined;
  const postingCompanies =
    table && companies
      ? createPostingCompanies(table, send, companies)
      : undefined;
  const jobPostings = table
    ? createJobPostings(
        createDynamoPostingStore(table, send, companies),
        undefined,
        undefined,
        config.enabled,
      )
    : undefined;
  const roleUpdates = table
    ? createRoleUpdates(
        table,
        send,
        config.enabled,
        undefined,
        undefined,
        companies,
      )
    : undefined;
  return buildApp({
    companyAnalysis:
      table && companies
        ? createCompanyAnalysis({
            table,
            send,
            enabled: analysisConfig.enabled,
            company: companies.get,
          })
        : undefined,
    verifyAccessToken,
    parsePosting,
    jobPostings,
    roleUpdates,
    companies,
    postingCompanies,
    roleNotes: table ? createRoleNotes(table, send) : undefined,
  });
}
