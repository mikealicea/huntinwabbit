import { afterEach, expect, it, vi } from 'vitest';
import { makeStore } from '@/state/state.store';
import { postingApi } from './job-api.client';
import { mockPostingApi, postingFixtures } from './job-api.test-support';

afterEach(() => vi.unstubAllGlobals());
it('loads cursor pages without replacing already loaded records', async () => {
  const boundary = mockPostingApi();
  const items = postingFixtures();
  boundary.fetcher.mockImplementationOnce(async () =>
    Response.json({ schemaVersion: 1, items: [items[0]], nextCursor: 'next' }),
  );
  boundary.fetcher.mockImplementationOnce(async () =>
    Response.json({ schemaVersion: 1, items: [items[1]], nextCursor: null }),
  );
  const store = makeStore();
  const initial = store.dispatch(postingApi.endpoints.postings.initiate());
  await initial;
  const next = await store.dispatch(
    postingApi.endpoints.postings.initiate(undefined, { direction: 'forward' }),
  );
  expect(next.data?.pages.flatMap((page) => page.items)).toEqual(
    items.slice(0, 2),
  );
  expect(String(new Request(boundary.fetcher.mock.calls[1][0]).url)).toContain(
    'cursor=next',
  );
  initial.unsubscribe();
  store.dispatch(postingApi.util.resetApiState());
});
it('preserves earlier pages when a later page fails', async () => {
  const boundary = mockPostingApi();
  boundary.fetcher.mockImplementationOnce(async () =>
    Response.json({
      schemaVersion: 1,
      items: [postingFixtures()[0]],
      nextCursor: 'next',
    }),
  );
  boundary.fetcher.mockImplementationOnce(async () =>
    Response.json({}, { status: 503 }),
  );
  const store = makeStore();
  await store.dispatch(postingApi.endpoints.postings.initiate());
  const result = await store.dispatch(
    postingApi.endpoints.postings.initiate(undefined, { direction: 'forward' }),
  );
  expect(result.isError).toBe(true);
  expect(result.data?.pages[0].items).toHaveLength(1);
  store.dispatch(postingApi.util.resetApiState());
});
it('requests explicit extraction through the real endpoint and invalidates caches', async () => {
  const boundary = mockPostingApi();
  const item = postingFixtures()[0];
  const store = makeStore();
  await store.dispatch(postingApi.endpoints.posting.initiate(item.id));
  const result = await store
    .dispatch(
      postingApi.endpoints.extractPosting.initiate({
        id: item.id,
        expectedGeneration: null,
      }),
    )
    .unwrap();
  expect(result.extraction.status).toBe('queued');
  expect(boundary.records.get(item.id)?.extraction.status).toBe('queued');
  store.dispatch(postingApi.util.resetApiState());
});
it.each(['malformed', 'transport'] as const)(
  'maps %s responses to safe errors',
  async (kind) => {
    const boundary = mockPostingApi();
    if (kind === 'malformed')
      boundary.fetcher.mockResolvedValue(
        Response.json({ private: 'do not expose' }),
      );
    else
      boundary.fetcher.mockRejectedValue(new Error('private transport detail'));
    const store = makeStore();
    const result = await store.dispatch(
      postingApi.endpoints.postings.initiate(),
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.error)).not.toContain('private');
    store.dispatch(postingApi.util.resetApiState());
  },
);
