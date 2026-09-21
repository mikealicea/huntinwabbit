import { expect, it } from 'vitest';

import {
  createFetchPosting,
  createParsePosting,
  createRedpillExtractor,
  jobParsingConfig,
  parseResponseSchema,
} from '../src/features/job-parsing/job-parsing.index.ts';
import { AppError } from '../src/shared/shared.errors.ts';

const config = jobParsingConfig(process.env);
if (!config.enabled)
  throw new Error(
    'Enable JOB_PARSING_ENABLED for this opt-in live, paid suite.',
  );
const parsePosting = createParsePosting({
  fetchPosting: createFetchPosting(),
  extractPosting: createRedpillExtractor(config.apiKey),
});

const sources = [
  [
    'ashby',
    'https://jobs.ashbyhq.com/antimetal/5cd7843d-613b-4497-a46f-40b17bfd09fb',
  ],
  ['greenhouse', 'https://job-boards.greenhouse.io/anthropic/jobs/5383610008'],
  [
    'indeed',
    'https://www.indeed.com/viewjob?jk=6e4040455f842cbd&from=shareddesktop_copy',
  ],
  [
    'google',
    'https://www.google.com/about/careers/applications/jobs/results/92046058892206790-senior-staff-software-engineer-search-platforms-genai-content',
  ],
] as const;

for (const [site, url] of sources) {
  it(`observes ${site} through the production fetch and model adapters`, async () => {
    const started = Date.now();
    let outcome = 'UNEXPECTED_ERROR';
    try {
      const result = await parsePosting(url, AbortSignal.timeout(60_000));
      outcome = parseResponseSchema.safeParse(result).success
        ? 'PARSED'
        : 'INVALID_RESPONSE';
    } catch (error) {
      if (error instanceof AppError && error.code) outcome = error.code;
    }
    // Operational outcomes only: never print URLs, content, responses, or raw errors.
    console.log(
      JSON.stringify({
        event: 'job-parsing.live',
        site,
        outcome,
        durationMs: Date.now() - started,
      }),
    );
    expect([
      'PARSED',
      'SOURCE_BLOCKED',
      'SOURCE_EXPIRED',
      'SOURCE_UNAVAILABLE',
      'SOURCE_TOO_LARGE',
      'NOT_A_JOB',
      'RATE_LIMITED',
      'PARSE_TIMEOUT',
    ]).toContain(outcome);
  });
}
