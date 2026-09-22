import { parsingError } from './job-parsing.errors.ts';
import {
  type ExtractPosting,
  type FetchPosting,
  type ParsePosting,
  type ParseResponse,
  parseResponseSchema,
} from './job-parsing.schemas.ts';
import { normalizeJobUrl } from './job-parsing.url.ts';

export function createParsePosting(dependencies: {
  fetchPosting: FetchPosting;
  extractPosting: ExtractPosting;
}): ParsePosting {
  return async (input, signal, companyContext) => {
    const normalizedUrl = normalizeJobUrl(input);
    signal.throwIfAborted();
    const fetched = await dependencies.fetchPosting(normalizedUrl, signal);
    signal.throwIfAborted();
    const candidates = await companyContext?.candidates(
      fetched.content,
      signal,
    );
    const extraction = await dependencies.extractPosting(
      fetched.content,
      signal,
      candidates,
    );
    signal.throwIfAborted();
    if (extraction.pageType === 'blocked') throw parsingError('SOURCE_BLOCKED');
    if (extraction.pageType === 'expired') throw parsingError('SOURCE_EXPIRED');
    if (extraction.pageType === 'not-job') throw parsingError('NOT_A_JOB');
    const job = extraction.job;
    if (!job || (!job.title && !job.description))
      throw parsingError('INVALID_MODEL_OUTPUT');
    if (
      extraction.selectedCompanyId &&
      candidates?.some((c) => c.id === extraction.selectedCompanyId)
    )
      companyContext?.matched(extraction.selectedCompanyId);
    const warnings: ParseResponse['warnings'] = [];
    if (!job.title) warnings.push('MISSING_TITLE');
    if (!job.company.name) warnings.push('MISSING_COMPANY');
    if (!job.description) warnings.push('MISSING_DESCRIPTION');
    if (!job.compensation.length) warnings.push('MISSING_COMPENSATION');
    return parseResponseSchema.parse({
      schemaVersion: 1,
      source: { normalizedUrl, fetchedAt: fetched.fetchedAt },
      job,
      warnings,
    });
  };
}
