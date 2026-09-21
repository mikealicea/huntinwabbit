import { AppError } from '../../shared/shared.errors.ts';

const failures = {
  INVALID_URL: [
    400,
    'Enter a valid HTTP or HTTPS job link without embedded credentials.',
  ],
  INVALID_REQUEST: [400, 'Provide one job link in the url field.'],
  PARSING_DISABLED: [503, 'Job parsing is not enabled.'],
  SOURCE_UNAVAILABLE: [422, 'The job posting could not be retrieved.'],
  SOURCE_TOO_LARGE: [422, 'The posting is too large to parse.'],
  SOURCE_BLOCKED: [422, 'The website blocked access to this posting.'],
  SOURCE_EXPIRED: [422, 'This job posting is no longer available.'],
  NOT_A_JOB: [422, 'The link did not contain a single job posting.'],
  RATE_LIMITED: [429, 'The provider is busy. Try again later.'],
  FETCH_FAILED: [502, 'The posting fetcher is temporarily unavailable.'],
  MODEL_UNAVAILABLE: [502, 'The parsing provider is temporarily unavailable.'],
  INVALID_MODEL_OUTPUT: [
    502,
    'The posting could not be parsed into valid job details.',
  ],
  PARSE_TIMEOUT: [504, 'Job parsing took too long. Try again later.'],
} as const;

export type ParsingErrorCode = keyof typeof failures;

export function parsingError(
  code: ParsingErrorCode,
  cause?: unknown,
): AppError {
  const [status, message] = failures[code];
  return new AppError(status, message, { code, cause });
}
