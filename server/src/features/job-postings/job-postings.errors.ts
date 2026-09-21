import { AppError } from '../../shared/shared.errors.ts';

export function postingError(
  code:
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'PARSING_DISABLED'
    | 'INVALID_REQUEST'
    | 'INVALID_CURSOR'
    | 'POSTING_TOO_LARGE'
    | 'STORAGE_DISABLED'
    | 'STORAGE_UNAVAILABLE'
    | 'INVALID_STORED_POSTING',
  cause?: unknown,
): AppError {
  const definitions = {
    NOT_FOUND: [404, 'This saved posting was not found.'],
    CONFLICT: [
      409,
      'This posting changed. Refresh and review your changes before saving again.',
    ],
    PARSING_DISABLED: [503, 'Job extraction is not enabled.'],
    INVALID_REQUEST: [400, 'Provide valid job posting data.'],
    INVALID_CURSOR: [400, 'Provide a valid pagination cursor.'],
    POSTING_TOO_LARGE: [413, 'The saved posting is too large.'],
    STORAGE_DISABLED: [503, 'Saved job postings are not configured.'],
    STORAGE_UNAVAILABLE: [
      503,
      'Saved job postings are temporarily unavailable. Please try again.',
    ],
    INVALID_STORED_POSTING: [500, 'Saved job posting data could not be read.'],
  } as const;
  const [status, message] = definitions[code];
  return new AppError(status, message, { code, cause });
}
