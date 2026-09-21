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
  return buildApp({ verifyAccessToken, parsePosting });
}
