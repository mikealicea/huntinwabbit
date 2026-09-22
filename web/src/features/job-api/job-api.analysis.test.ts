import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { makeStore } from '@/state/state.store';
import { analysisResponseSchema } from './job-api.analysis.contracts';
import { createApiBridge } from './job-api.bridge';
import { postingApi } from './job-api.client';
import { mockPostingApi } from './job-api.test-support';

const id = '00000000-0000-4000-8000-000000000050';
const response = {
  schemaVersion: 1,
  status: 'complete',
  generation: id,
  stale: false,
  totalRoles: 2,
  analyzedRoles: 2,
  completedAt: '2026-09-22T12:00:00Z',
  progress: 4,
  error: null,
  items: [],
  nextCursor: null,
};
afterEach(() => vi.unstubAllGlobals());
it('validates the shared wire contract and bridges analysis reads and requests', async () => {
  const server = await import(
    '../../../../server/src/features/company-analysis/company-analysis.schemas'
  );
  expect(server.analysisResponseSchema.parse(response)).toEqual(
    analysisResponseSchema.parse(response),
  );
  const scheduled = {
    ...response,
    status: 'scheduled',
    scheduledFor: '2026-09-22T12:01:00.000Z',
  };
  expect(server.analysisResponseSchema.parse(scheduled)).toEqual(
    analysisResponseSchema.parse(scheduled),
  );
  expect(
    analysisResponseSchema.safeParse({ ...scheduled, scheduledFor: 'soon' })
      .success,
  ).toBe(false);
  const http = vi.fn<typeof fetch>(async () => Response.json(response));
  const bridge = createApiBridge({
    origin: 'https://api.example.test',
    appOrigin: 'http://localhost',
    session: async () => ({
      status: 'authenticated',
      accessToken: 'fictional',
    }),
    fetch: http,
  });
  const req = (method: string, body?: unknown, suffix = '') =>
    new Request(
      `http://localhost/api/job-postings/companies/${id}/analysis${suffix}`,
      {
        method,
        headers: {
          origin: 'http://localhost',
          'content-type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
  expect((await bridge(req('GET', undefined, '?cursor=next'))).status).toBe(
    200,
  );
  expect(
    (await bridge(req('POST', { operationId: id, intent: 'refresh' }))).status,
  ).toBe(200);
  expect(http.mock.calls.at(-1)?.[0]).toBe(
    `https://api.example.test/companies/${id}/analysis`,
  );
  expect((await bridge(req('POST', { intent: 'refresh' }))).status).toBe(400);
  expect((await bridge(req('DELETE'))).status).toBe(405);
});
it('initializes once, loads result pages, and drops old pages on refresh', async () => {
  const boundary = mockPostingApi();
  let initialized = false;
  boundary.fetcher.mockImplementation(async (input, init) => {
    const req = new Request(input, init);
    if (req.method === 'POST') {
      initialized = true;
      return Response.json({ ...response, status: 'scheduled' });
    }
    return Response.json({
      ...response,
      status: initialized ? 'complete' : 'not-started',
      nextCursor: new URL(req.url).searchParams.has('cursor') ? null : 'next',
    });
  });
  const store = makeStore();
  await store.dispatch(postingApi.endpoints.companyAnalysis.initiate(id));
  await vi.waitFor(() => expect(initialized).toBe(true));
  await Promise.all(store.dispatch(postingApi.util.getRunningMutationsThunk()));
  await Promise.all(store.dispatch(postingApi.util.getRunningQueriesThunk()));
  const next = await store.dispatch(
    postingApi.endpoints.companyAnalysis.initiate(id, { direction: 'forward' }),
  );
  expect(next.data?.pages).toHaveLength(2);
  const fresh = await store.dispatch(
    postingApi.endpoints.companyAnalysis.initiate(id, { forceRefetch: true }),
  );
  expect(fresh.data?.pages).toHaveLength(1);
  expect(
    boundary.fetcher.mock.calls.filter(
      ([input]) => input instanceof Request && input.method === 'POST',
    ),
  ).toHaveLength(1);
  store.dispatch(postingApi.util.resetApiState());
});
it('keeps initialization failures in shared mutation state without paid auto-retry', async () => {
  const boundary = mockPostingApi();
  boundary.fetcher.mockImplementation(async (input, init) =>
    new Request(input, init).method === 'POST'
      ? Response.json({}, { status: 503 })
      : Response.json({ ...response, status: 'not-started' }),
  );
  const store = makeStore();
  await store.dispatch(postingApi.endpoints.companyAnalysis.initiate(id));
  await vi.waitFor(() =>
    expect(
      postingApi.endpoints.requestCompanyAnalysis.select({
        fixedCacheKey: `company-analysis:${id}`,
        requestId: undefined,
      })(store.getState()).isError,
    ).toBe(true),
  );
  store.dispatch(postingApi.util.resetApiState());
});
it('handles cache teardown before the first query completes', async () => {
  const boundary = mockPostingApi();
  let finish: () => void = () => {};
  boundary.fetcher.mockImplementation(async () => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return Response.json(response);
  });
  const store = makeStore();
  const query = store.dispatch(
    postingApi.endpoints.companyAnalysis.initiate(id),
  );
  await vi.waitFor(() => expect(boundary.fetcher).toHaveBeenCalled());
  store.dispatch(postingApi.util.resetApiState());
  finish();
  await query;
});
