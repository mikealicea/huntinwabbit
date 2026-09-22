import { buildApp } from './app.ts';
import {
  authConfig,
  createAccessTokenVerifier,
} from './features/auth/auth.index.ts';
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
  createRoleNotes,
  createRoleUpdates,
  jobPostingsTable,
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
  const jobPostings = table
    ? createJobPostings(
        createDynamoPostingStore(table),
        undefined,
        undefined,
        config.enabled,
      )
    : undefined;
  const roleUpdates = table
    ? createRoleUpdates(table, createDynamoTransport(), config.enabled)
    : undefined;
  return buildApp({
    verifyAccessToken,
    parsePosting,
    jobPostings,
    roleUpdates,
    roleNotes: table
      ? createRoleNotes(table, createDynamoTransport())
      : undefined,
  });
}
