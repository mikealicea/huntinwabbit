import { randomUUID } from 'node:crypto';
import { normalizeJobUrl } from '../job-parsing/job-parsing.index.ts';
import { postingError } from './job-postings.errors.ts';
import {
  type JobPostings,
  MAX_RECORD_BYTES,
  type PostingStore,
  savedPostingSchema,
} from './job-postings.schemas.ts';

export function createJobPostings(
  store: PostingStore,
  now = () => new Date().toISOString(),
  id = randomUUID,
  extractionEnabled = false,
): JobPostings {
  return {
    async save(userId, input, signal) {
      const sourceUrl = normalizeJobUrl(input.url);
      if (
        input.parsedPosting &&
        normalizeJobUrl(input.parsedPosting.source.normalizedUrl) !== sourceUrl
      ) {
        throw postingError('INVALID_REQUEST');
      }
      const timestamp = now();
      const item = savedPostingSchema.parse({
        id: id(),
        sourceUrl,
        parsedPosting: input.parsedPosting,
        application: input.application,
        applicationVersion: 0,
        recordVersion: 0,
        extraction: {
          status: input.parsedPosting
            ? 'complete'
            : input.extract
              ? extractionEnabled
                ? 'queued'
                : 'disabled'
              : 'not-requested',
          generation:
            input.extract && extractionEnabled && !input.parsedPosting
              ? randomUUID()
              : null,
          error: null,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      if (Buffer.byteLength(JSON.stringify(item), 'utf8') > MAX_RECORD_BYTES)
        throw postingError('POSTING_TOO_LARGE');
      return { schemaVersion: 1, ...(await store.save(userId, item, signal)) };
    },
    get: (userId, id, signal) => store.get(userId, id, signal),
    update: (userId, id, input, signal) =>
      store.update(userId, id, input, signal),
    extract: async (userId, id, generation, signal) => {
      if (!extractionEnabled) throw postingError('PARSING_DISABLED');
      return store.extract(userId, id, generation, signal);
    },
    list: (userId, input, signal) => store.list(userId, input, signal),
  };
}
