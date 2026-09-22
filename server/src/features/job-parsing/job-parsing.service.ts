import { randomUUID } from 'node:crypto';
import { AppError } from '../../shared/shared.errors.ts';
import type { SourceObservation } from '../source-guidance/source-guidance.index.ts';
import { parsingError } from './job-parsing.errors.ts';
import {
  type ExtractPosting,
  type FetchedPosting,
  type FetchPosting,
  type ParsePosting,
  type ParseResponse,
  parseResponseSchema,
} from './job-parsing.schemas.ts';
import { normalizeJobUrl } from './job-parsing.url.ts';

export function createParsePosting(dependencies: {
  fetchPosting: FetchPosting;
  extractPosting: ExtractPosting;
  observeSource?: (observation: SourceObservation) => Promise<void>;
}): ParsePosting {
  return async (input, signal, companyContext, sourceText) => {
    const normalizedUrl = normalizeJobUrl(input);
    signal.throwIfAborted();
    const order = `${Date.now()}#${randomUUID()}`;
    async function observe(outcome: SourceObservation['outcome']) {
      try {
        await dependencies.observeSource?.({
          hostname: new URL(normalizedUrl).hostname,
          outcome,
          order,
        });
      } catch {
        console.warn(
          JSON.stringify({ event: 'source_guidance.observation_failed' }),
        );
      }
    }
    let fetched: FetchedPosting | undefined;
    try {
      fetched = await dependencies.fetchPosting(normalizedUrl, signal);
    } catch (cause) {
      signal.throwIfAborted();
      if (cause instanceof AppError && cause.code === 'SOURCE_BLOCKED')
        await observe('blocked');
      if (!sourceText?.trim()) throw cause;
    }
    signal.throwIfAborted();
    const candidates = await companyContext?.candidates(
      [sourceText, fetched?.content].filter(Boolean).join('\n'),
      signal,
    );
    const extraction = await dependencies.extractPosting(
      fetched?.content ?? '',
      signal,
      candidates,
      sourceText,
    );
    signal.throwIfAborted();
    const fetchedType = sourceText?.trim()
      ? extraction.fetchedPageType
      : extraction.pageType;
    if (
      fetched &&
      (fetchedType === 'blocked' ||
        (fetchedType === 'job' &&
          (extraction.job?.title || extraction.job?.description)))
    )
      await observe(fetchedType === 'blocked' ? 'blocked' : 'usable');
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
      source: {
        normalizedUrl,
        fetchedAt: fetched?.fetchedAt ?? null,
        ...(sourceText?.trim()
          ? {
              extractedAt: new Date().toISOString(),
              inputs: [
                ...(fetched && extraction.fetchedPageUsable !== false
                  ? ['webpage']
                  : []),
                'pasted-text',
              ],
              ...(!fetched
                ? { fetchWarning: 'FETCH_UNAVAILABLE' }
                : extraction.fetchedPageUsable === false
                  ? { fetchWarning: 'FETCHED_PAGE_UNUSABLE' }
                  : {}),
            }
          : {}),
      },
      job,
      warnings,
    });
  };
}
