import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../app.ts';
import { unauthorized } from '../../shared/shared.errors.ts';
import { jobParsingConfig } from './job-parsing.config.ts';
import { parsingError } from './job-parsing.errors.ts';
import { exampleJob } from './job-parsing.fixtures.ts';
import { type Extraction, parseResponseSchema } from './job-parsing.schemas.ts';
import { createParsePosting } from './job-parsing.service.ts';
import { normalizeJobUrl } from './job-parsing.url.ts';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function fixture(
  extraction: Extraction = { pageType: 'job', job: exampleJob() },
) {
  const fetchPosting = vi.fn(async () => ({
    content: 'fictional page',
    fetchedAt: '2026-09-19T12:00:00.000Z',
  }));
  const extractPosting = vi.fn(async () => extraction);
  const parsePosting = createParsePosting({ fetchPosting, extractPosting });
  const verifyAccessToken = vi.fn(async (token: string) => {
    if (token !== 'fixture-token')
      throw unauthorized('Invalid or missing credentials.');
    return { userId: 'fixture-user' };
  });
  return {
    fetchPosting,
    extractPosting,
    parsePosting,
    app: buildApp({ parsePosting, verifyAccessToken }),
  };
}

describe('URL normalization', () => {
  it.each([
    [
      ' https://jobs.example.com/role?id=123&from=share ',
      'https://jobs.example.com/role?id=123&from=share',
    ],
    ['www.example.com/jobs/123', 'https://www.example.com/jobs/123'],
    ['jobs.example.com/role', 'https://jobs.example.com/role'],
    ['//jobs.example.com/role', 'https://jobs.example.com/role'],
    ['http://jobs.example.com/role#apply', 'http://jobs.example.com/role'],
    [
      'https://www.indeed.com/viewjob?jk=6e4040455f842cbd&from=shareddesktop_copy',
      'https://www.indeed.com/viewjob?jk=6e4040455f842cbd&from=shareddesktop_copy',
    ],
  ])('normalizes %s', (input, expected) =>
    expect(normalizeJobUrl(input)).toBe(expected),
  );
  it.each([
    '',
    'role',
    'not a link.com',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'ftp://example.com/job',
    'https://secret@example.com/job',
    'https://user:password@example.com/job',
    'https://example.com\\@other.com',
    `https://example.com/${'a'.repeat(8192)}`,
  ])('rejects unsupported input', (input) => {
    expect(() => normalizeJobUrl(input)).toThrow(
      expect.objectContaining({ code: 'INVALID_URL' }),
    );
  });
});

describe('configuration', () => {
  it('requires explicit enablement and ignores an unused key when disabled', () => {
    expect(jobParsingConfig({})).toEqual({ enabled: false });
    expect(
      jobParsingConfig({
        JOB_PARSING_ENABLED: 'false',
        REDPILL_API_KEY: 'unused',
      }),
    ).toEqual({ enabled: false });
    expect(
      jobParsingConfig({
        JOB_PARSING_ENABLED: 'true',
        REDPILL_API_KEY: ' fixture-key ',
      }),
    ).toEqual({ enabled: true, apiKey: 'fixture-key' });
  });
  it.each([
    { JOB_PARSING_ENABLED: 'yes' },
    { JOB_PARSING_ENABLED: 'true' },
    { JOB_PARSING_ENABLED: 'true', REDPILL_API_KEY: ' ' },
    { JOB_PARSING_ENABLED: 'true', REDPILL_API_KEY: 'private key' },
  ])(
    'fails configured-but-broken construction without leaking the value',
    (env) => {
      expect(() => jobParsingConfig(env)).toThrow();
      try {
        jobParsingConfig(env);
      } catch (error) {
        expect(String(error)).not.toContain('private key');
      }
    },
  );
});

describe('parse endpoint', () => {
  it('propagates the overall deadline and returns a safe timeout response', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(
      (callback, delay, ...args) =>
        originalSetTimeout(callback, delay === 60_000 ? 10 : delay, ...args),
    );
    let cancelled = false;
    const app = buildApp({
      verifyAccessToken: async () => ({ userId: 'fixture-user' }),
      parsePosting: (_url, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              cancelled = true;
              reject(new Error('cancelled'));
            },
            { once: true },
          );
        }),
    });
    const response = await request(app)
      .post('/job-postings/parse')
      .auth('fixture-token', { type: 'bearer' })
      .send({ url: 'example.com' });
    expect(response.status).toBe(504);
    expect(response.body.code).toBe('PARSE_TIMEOUT');
    expect(cancelled).toBe(true);
  });
  it('returns consistent validated facts and preserves source query parameters', async () => {
    const { app, fetchPosting, extractPosting } = fixture();
    const response = await request(app)
      .post('/job-postings/parse')
      .auth('fixture-token', { type: 'bearer' })
      .send({ url: ' jobs.example.com/role?jk=123 ' });
    expect(response.status).toBe(200);
    expect(parseResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.source).toEqual({
      normalizedUrl: 'https://jobs.example.com/role?jk=123',
      fetchedAt: '2026-09-19T12:00:00.000Z',
    });
    expect(response.body.job).toEqual(exampleJob());
    expect(response.body.warnings).toEqual(['MISSING_COMPENSATION']);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(fetchPosting).toHaveBeenCalledOnce();
    expect(extractPosting).toHaveBeenCalledOnce();
  });

  it('authenticates before parsing bodies or calling external providers', async () => {
    const { app, fetchPosting } = fixture();
    const response = await request(app)
      .post('/job-postings/parse')
      .type('json')
      .send('{broken');
    expect(response.status).toBe(401);
    expect(fetchPosting).not.toHaveBeenCalled();
  });

  it.each([
    [{ url: 'file:///private' }, 400, 'INVALID_URL'],
    [{ url: 'www.example.com', extra: true }, 400, 'INVALID_REQUEST'],
    [{ url: 123 }, 400, 'INVALID_REQUEST'],
    [{}, 400, 'INVALID_REQUEST'],
    [{ url: 'x'.repeat(17_000) }, 413, 'REQUEST_TOO_LARGE'],
  ])('rejects invalid request before fetching', async (body, status, code) => {
    const { app, fetchPosting } = fixture();
    const response = await request(app)
      .post('/job-postings/parse')
      .auth('fixture-token', { type: 'bearer' })
      .send(body);
    expect(response.status).toBe(status);
    expect(response.body.code).toBe(code);
    expect(fetchPosting).not.toHaveBeenCalled();
  });

  it('maps malformed JSON and unsupported media types safely', async () => {
    const { app } = fixture();
    const broken = await request(app)
      .post('/job-postings/parse')
      .auth('fixture-token', { type: 'bearer' })
      .type('json')
      .send('{"secret-marker":');
    expect(broken.status).toBe(400);
    expect(broken.body.code).toBe('INVALID_JSON');
    const text = await request(app)
      .post('/job-postings/parse')
      .auth('fixture-token', { type: 'bearer' })
      .type('text')
      .send('private-marker');
    expect(text.status).toBe(415);
    expect(
      JSON.stringify([
        broken.body,
        text.body,
        vi.mocked(console.log).mock.calls,
        vi.mocked(console.error).mock.calls,
      ]),
    ).not.toMatch(/secret-marker|private-marker/);
  });

  it('returns an explicit disabled state', async () => {
    const app = buildApp({
      verifyAccessToken: async () => ({ userId: 'fixture-user' }),
    });
    const response = await request(app)
      .post('/job-postings/parse')
      .auth('fixture-token', { type: 'bearer' })
      .send({ url: 'example.com/job' });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('PARSING_DISABLED');
  });

  it('does not retry model failures or log URLs, payloads, or causes', async () => {
    const { app, extractPosting } = fixture();
    extractPosting.mockRejectedValue(
      parsingError('MODEL_UNAVAILABLE', new Error('private-provider-response')),
    );
    const response = await request(app)
      .post('/job-postings/parse')
      .auth('fixture-token', { type: 'bearer' })
      .send({ url: 'example.com/private-job' });
    expect(response.status).toBe(502);
    expect(extractPosting).toHaveBeenCalledOnce();
    expect(
      JSON.stringify([
        response.body,
        vi.mocked(console.log).mock.calls,
        vi.mocked(console.error).mock.calls,
      ]),
    ).not.toMatch(/private-provider|private-job|fixture-token/);
  });
});

describe('orchestration', () => {
  it.each([
    ['blocked', 'SOURCE_BLOCKED'],
    ['expired', 'SOURCE_EXPIRED'],
    ['not-job', 'NOT_A_JOB'],
  ] as const)('rejects %s pages', async (pageType, code) => {
    const { parsePosting } = fixture({ pageType, job: null });
    await expect(
      parsePosting('example.com', new AbortController().signal),
    ).rejects.toMatchObject({ code });
  });

  it('reports absent facts and retains multiple unconverted compensation entries', async () => {
    const job = {
      ...exampleJob(),
      title: null,
      company: { name: null, website: null },
      compensation: [
        {
          minimum: 50,
          maximum: null,
          currency: null,
          period: 'hour' as const,
          kind: 'base' as const,
          location: 'Region A',
          originalText: '$50+ hourly',
        },
        {
          minimum: 80_000,
          maximum: 100_000,
          currency: 'EUR',
          period: 'year' as const,
          kind: 'base' as const,
          location: 'Region B',
          originalText: 'EUR 80,000–100,000 per year',
        },
      ],
    };
    const { parsePosting } = fixture({ pageType: 'job', job });
    const response = await parsePosting(
      'example.com/job',
      new AbortController().signal,
    );
    expect(response.job.compensation).toEqual(job.compensation);
    expect(response.warnings).toEqual(['MISSING_TITLE', 'MISSING_COMPANY']);
  });

  it('accepts a title-only posting with an honest missing-description warning', async () => {
    const { parsePosting } = fixture({
      pageType: 'job',
      job: { ...exampleJob(), description: null },
    });
    expect(
      (await parsePosting('example.com', new AbortController().signal))
        .warnings,
    ).toContain('MISSING_DESCRIPTION');
  });
  it.each([null, { ...exampleJob(), title: null, description: null }])(
    'rejects an empty claimed job',
    async (job) => {
      const { parsePosting } = fixture({ pageType: 'job', job });
      await expect(
        parsePosting('example.com', new AbortController().signal),
      ).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
    },
  );

  it('never calls the model after a failed or cancelled fetch', async () => {
    const { parsePosting, fetchPosting, extractPosting } = fixture();
    fetchPosting.mockRejectedValueOnce(parsingError('SOURCE_UNAVAILABLE'));
    await expect(
      parsePosting('example.com', new AbortController().signal),
    ).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
    const controller = new AbortController();
    fetchPosting.mockImplementationOnce(async () => {
      controller.abort();
      return { content: 'unused', fetchedAt: '' };
    });
    await expect(
      parsePosting('example.com', controller.signal),
    ).rejects.toThrow();
    expect(extractPosting).not.toHaveBeenCalled();
  });
  it('keeps repeat calls and results independent', async () => {
    const { parsePosting, fetchPosting, extractPosting } = fixture();
    await Promise.all([
      parsePosting('example.com', new AbortController().signal),
      parsePosting('example.com', new AbortController().signal),
    ]);
    expect(fetchPosting).toHaveBeenCalledTimes(2);
    expect(extractPosting).toHaveBeenCalledTimes(2);
  });
});
