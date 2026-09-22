import { afterEach, expect, it, vi } from 'vitest';
import { type ParsingErrorCode, parsingError } from './job-parsing.errors.ts';
import { exampleJob } from './job-parsing.fixtures.ts';
import type { Extraction } from './job-parsing.schemas.ts';
import { createParsePosting } from './job-parsing.service.ts';

afterEach(() => vi.restoreAllMocks());
const signal = () => AbortSignal.timeout(5_000);
const fetched = async () => ({
  content: 'Fictional fetched posting',
  fetchedAt: '2026-09-22T00:00:00.000Z',
});
it.each([undefined, 'Fictional pasted job'])(
  'learns a fetch block even when pasted text succeeds: %s',
  async (paste) => {
    const observeSource = vi.fn(async () => {});
    const parse = createParsePosting({
      fetchPosting: async () => {
        throw parsingError('SOURCE_BLOCKED');
      },
      extractPosting: async () => ({ pageType: 'job', job: exampleJob() }),
      observeSource,
    });
    const result = parse(
      'jobs.example.test/private?token=secret',
      signal(),
      undefined,
      paste,
    );
    if (paste) expect((await result).source.inputs).toEqual(['pasted-text']);
    else await expect(result).rejects.toMatchObject({ code: 'SOURCE_BLOCKED' });
    expect(observeSource).toHaveBeenCalledExactlyOnceWith({
      hostname: 'jobs.example.test',
      outcome: 'blocked',
      order: expect.any(String),
    });
  },
);
it.each<ParsingErrorCode>([
  'SOURCE_EXPIRED',
  'SOURCE_UNAVAILABLE',
  'SOURCE_TOO_LARGE',
  'RATE_LIMITED',
  'FETCH_FAILED',
  'PARSE_TIMEOUT',
])('does not learn from %s', async (code) => {
  const observeSource = vi.fn(async () => {});
  const parse = createParsePosting({
    fetchPosting: async () => {
      throw parsingError(code);
    },
    extractPosting: async () => ({ pageType: 'job', job: exampleJob() }),
    observeSource,
  });
  await parse(
    'jobs.example.test/role',
    signal(),
    undefined,
    'Fictional pasted job',
  );
  expect(observeSource).not.toHaveBeenCalled();
});
it.each(['job', 'blocked', 'expired', 'not-job'] as const)(
  'uses fetched classification independently of pasted success: %s',
  async (fetchedPageType) => {
    const observeSource = vi.fn(async () => {});
    const parse = createParsePosting({
      fetchPosting: fetched,
      extractPosting: async () => ({
        pageType: 'job',
        job: exampleJob(),
        fetchedPageType,
      }),
      observeSource,
    });
    await parse(
      'jobs.example.test/role',
      signal(),
      undefined,
      'Fictional pasted job',
    );
    if (fetchedPageType === 'job' || fetchedPageType === 'blocked')
      expect(observeSource).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          outcome: fetchedPageType === 'job' ? 'usable' : 'blocked',
        }),
      );
    else expect(observeSource).not.toHaveBeenCalled();
  },
);
it.each(['job', 'blocked', 'expired', 'not-job'] as const)(
  'observes URL-only results: %s',
  async (pageType) => {
    const observeSource = vi.fn(async () => {});
    const parse = createParsePosting({
      fetchPosting: fetched,
      extractPosting: async (): Promise<Extraction> => ({
        pageType,
        job: pageType === 'job' ? exampleJob() : null,
      }),
      observeSource,
    });
    const result = parse('jobs.example.test/role', signal());
    if (pageType === 'job') await result;
    else await expect(result).rejects.toThrow();
    expect(observeSource).toHaveBeenCalledTimes(
      pageType === 'job' || pageType === 'blocked' ? 1 : 0,
    );
  },
);
it('does not interpret invalid model output, provider failures or cancellation as host evidence', async () => {
  const observeSource = vi.fn(async () => {});
  for (const code of [
    'INVALID_MODEL_OUTPUT',
    'MODEL_UNAVAILABLE',
    'RATE_LIMITED',
  ] as const) {
    const parse = createParsePosting({
      fetchPosting: fetched,
      extractPosting: async () => {
        throw parsingError(code);
      },
      observeSource,
    });
    await expect(
      parse('jobs.example.test/role', signal()),
    ).rejects.toMatchObject({ code });
  }
  const controller = new AbortController();
  const parse = createParsePosting({
    fetchPosting: async () => {
      controller.abort();
      throw parsingError('SOURCE_BLOCKED');
    },
    extractPosting: async () => ({ pageType: 'blocked', job: null }),
    observeSource,
  });
  await expect(
    parse('jobs.example.test/role', controller.signal),
  ).rejects.toThrow();
  expect(observeSource).not.toHaveBeenCalled();
});
it('preserves success when the advisory observer rejects', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const parse = createParsePosting({
    fetchPosting: fetched,
    extractPosting: async () => ({ pageType: 'job', job: exampleJob() }),
    observeSource: async () => {
      throw new Error('private data');
    },
  });
  expect((await parse('jobs.example.test/role', signal())).job).toEqual(
    exampleJob(),
  );
  expect(warning).toHaveBeenCalledExactlyOnceWith(
    '{"event":"source_guidance.observation_failed"}',
  );
});
