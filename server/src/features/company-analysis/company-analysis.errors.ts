import { z } from 'zod';
import { AppError } from '../../shared/shared.errors.ts';

export function analysisError(code: string, status = 503, cause?: unknown) {
  return new AppError(status, 'Company analysis could not be completed.', {
    code,
    cause,
  });
}

// Only fixed codes cross the persistence/logging boundary. Error messages,
// validation issues and provider/SDK causes can contain private source data.
const publicCodes = new Set([
  'INVALID_ANALYSIS_OUTPUT',
  'INVALID_ANALYSIS_EVIDENCE',
  'INVALID_STORED_ANALYSIS',
  'ANALYSIS_TOO_LARGE',
  'ANALYSIS_DISABLED',
  'SOURCE_TOO_LARGE',
  'RATE_LIMITED',
  'MODEL_UNAVAILABLE',
  'INVALID_MODEL_OUTPUT',
  'PARSE_TIMEOUT',
]);
const storageErrors = new Set([
  'AccessDeniedException',
  'ResourceNotFoundException',
  'ValidationException',
  'TransactionCanceledException',
  'TransactionConflictException',
  'ProvisionedThroughputExceededException',
  'ThrottlingException',
  'RequestLimitExceeded',
  'InternalServerError',
]);
const diagnosticFields = new Set([
  'findings',
  'category',
  'label',
  'qualifier',
  'explanation',
  'evidence',
  'reference',
  'excerpt',
  'members',
]);
function safeField(value: unknown) {
  return typeof value === 'string' && diagnosticFields.has(value)
    ? value
    : '[unknown]';
}

export function analysisFailure(cause: unknown) {
  if (cause instanceof AppError && cause.code && publicCodes.has(cause.code))
    return {
      code: cause.code,
      reason: cause.code,
      ...(cause.code === 'INVALID_ANALYSIS_OUTPUT' &&
      cause.cause instanceof z.ZodError
        ? {
            validation: cause.cause.issues.slice(0, 8).map((issue) => ({
              code: issue.code,
              path: issue.path.map(safeField),
              ...(issue.code === 'unrecognized_keys'
                ? { keys: issue.keys.map(safeField).slice(0, 8) }
                : {}),
            })),
          }
        : {}),
    };
  if (cause instanceof z.ZodError)
    return {
      code: 'INVALID_STORED_ANALYSIS',
      reason: 'INVALID_STORED_ANALYSIS',
    };
  if (cause instanceof Error && storageErrors.has(cause.name))
    return { code: 'ANALYSIS_STORAGE_FAILED', reason: cause.name };
  if (
    cause instanceof Error &&
    ['AbortError', 'TimeoutError'].includes(cause.name)
  )
    return { code: 'ANALYSIS_TIMEOUT', reason: cause.name };
  return { code: 'ANALYSIS_FAILED', reason: 'ANALYSIS_FAILED' };
}
