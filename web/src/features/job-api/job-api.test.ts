import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createApiBridge } from './job-api.bridge';
import { apiConfig } from './job-api.config';
import { postingFixtures } from './job-api.test-support';

afterEach(() => vi.unstubAllEnvs());
describe('stage selection', () => {
  it('defaults local development to dev but never supplies an infrastructure endpoint', () => {
    expect(
      apiConfig({
        NODE_ENV: 'development',
        API_BASE_URL_DEV: 'http://127.0.0.1:3102',
      }),
    ).toEqual({ stage: 'dev', origin: 'http://127.0.0.1:3102' });
    expect(() => apiConfig({ NODE_ENV: 'development' })).toThrow();
    expect(() =>
      apiConfig({
        NODE_ENV: 'production',
        API_BASE_URL_DEV: 'https://dev.example.test',
      }),
    ).toThrow();
    expect(
      apiConfig({
        NODE_ENV: 'production',
        APP_STAGE: 'dev',
        API_BASE_URL_DEV: 'https://dev.example.test',
      }).stage,
    ).toBe('dev');
    expect(
      apiConfig({
        APP_STAGE: 'prod',
        API_BASE_URL_PROD: 'https://prod.example.test',
      }).origin,
    ).toBe('https://prod.example.test');
  });
  it.each([
    'https://user:secret@example.test',
    'http://external.test',
    'https://example.test/path',
    'https://example.test?q=x',
    'https://example.test#fragment',
    'not-url',
  ])('rejects invalid origins %s', (origin) =>
    expect(() =>
      apiConfig({ APP_STAGE: 'prod', API_BASE_URL_PROD: origin }),
    ).toThrow(),
  );
  it('rejects missing or unknown stages and production loopback', () => {
    expect(() => apiConfig({ APP_STAGE: 'staging' })).toThrow();
    expect(() => apiConfig({ APP_STAGE: 'prod' })).toThrow();
    expect(() =>
      apiConfig({
        APP_STAGE: 'prod',
        API_BASE_URL_PROD: 'http://localhost:3001',
      }),
    ).toThrow();
    vi.stubEnv('APP_STAGE', 'dev');
    vi.stubEnv('API_BASE_URL_DEV', 'https://dev.example.test');
    expect(apiConfig().stage).toBe('dev');
  });
});
function setup(
  response: unknown = { schemaVersion: 1, items: [], nextCursor: null },
) {
  const session = vi.fn(async () => ({
    status: 'authenticated' as const,
    accessToken: 'synthetic-private-token',
  }));
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(response));
  return {
    session,
    fetcher,
    bridge: createApiBridge({
      origin: 'https://dev.example.test',
      appOrigin: 'http://localhost:3000',
      session,
      fetch: fetcher,
    }),
  };
}
const req = (path = '', method = 'GET', body?: unknown) =>
  new Request(`http://localhost:3000/api/job-postings${path}`, {
    method,
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
describe('authenticated API bridge', () => {
  it('keeps tokens server-side and disables caches and redirects', async () => {
    const s = setup();
    const result = await s.bridge(req('?limit=50&cursor=abc'));
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toContain('no-store');
    expect(s.fetcher).toHaveBeenCalledWith(
      'https://dev.example.test/job-postings?limit=50&cursor=abc',
      expect.objectContaining({
        redirect: 'error',
        cache: 'no-store',
        headers: { Authorization: 'Bearer synthetic-private-token' },
      }),
    );
    expect(await result.text()).not.toContain('synthetic-private-token');
  });
  it('rejects cross-origin writes before accessing a session', async () => {
    const s = setup();
    const result = await s.bridge(
      new Request('http://localhost:3000/api/job-postings', {
        method: 'POST',
        headers: { origin: 'https://foreign.test' },
      }),
    );
    expect(result.status).toBe(403);
    expect(s.session).not.toHaveBeenCalled();
  });
  it.each(['anonymous', 'unavailable'] as const)(
    'fails closed on %s auth',
    async (status) => {
      const fetcher = vi.fn();
      const bridge = createApiBridge({
        origin: 'https://example.test',
        appOrigin: 'http://localhost:3000',
        fetch: fetcher,
        session: async () => ({ status }),
      });
      expect((await bridge(req())).status).toBe(
        status === 'anonymous' ? 401 : 503,
      );
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['?limit=0', 'GET', undefined, 400],
    ['?limit=2&limit=3', 'GET', undefined, 400],
    ['?unknown=x', 'GET', undefined, 400],
    ['/invalid', 'GET', undefined, 404],
    ['', 'DELETE', undefined, 405],
    ['', 'POST', { url: '' }, 400],
  ] as const)(
    'rejects invalid routing and input %s %s',
    async (path, method, body, status) => {
      const s = setup();
      expect((await s.bridge(req(path, method, body))).status).toBe(status);
      expect(s.fetcher).not.toHaveBeenCalled();
    },
  );
  it('validates full save, detail, update and extraction responses', async () => {
    const item = postingFixtures()[0];
    for (const [path, method, body, response] of [
      [
        '',
        'POST',
        { url: item.sourceUrl, extract: true },
        { schemaVersion: 1, item, created: true },
      ],
      [`/${item.id}`, 'GET', undefined, { schemaVersion: 1, item }],
      [
        `/${item.id}`,
        'PATCH',
        { expectedApplicationVersion: 0, changes: { notes: 'Fictional note' } },
        { schemaVersion: 1, item },
      ],
      [
        `/${item.id}/extraction`,
        'POST',
        { expectedGeneration: null },
        { schemaVersion: 1, item },
      ],
    ] as const)
      expect(
        (await setup(response).bridge(req(path, method, body))).status,
      ).toBe(200);
  });
  it('does not return malformed responses or raw provider errors', async () => {
    const malformed = setup({ private: 'sensitive upstream text' });
    expect((await malformed.bridge(req())).status).toBe(503);
    const s = setup();
    s.fetcher.mockResolvedValue(
      Response.json({ message: 'private upstream error' }, { status: 500 }),
    );
    const response = await s.bridge(req());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('private upstream');
    s.fetcher.mockRejectedValue(new Error('private transport failure'));
    expect((await s.bridge(req())).status).toBe(503);
  });
  it('bounds request payloads and rejects non-JSON bodies', async () => {
    const s = setup();
    expect(
      (await s.bridge(req('', 'POST', { url: 'x'.repeat(270000) }))).status,
    ).toBe(400);
    expect(
      (
        await s.bridge(
          new Request('http://localhost:3000/api/job-postings', {
            method: 'POST',
            headers: { origin: 'http://localhost:3000' },
            body: 'text',
          }),
        )
      ).status,
    ).toBe(415);
  });
});

it('forwards versioned deletion and returns a bodyless 204', async () => {
  const s = setup();
  const id = postingFixtures()[0].id;
  s.fetcher.mockResolvedValue(new Response(null, { status: 204 }));
  const response = await s.bridge(
    req(`/${id}`, 'DELETE', { expectedApplicationVersion: 4 }),
  );
  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(s.fetcher).toHaveBeenCalledWith(
    `https://dev.example.test/job-postings/${id}`,
    expect.objectContaining({
      method: 'DELETE',
      body: '{"expectedApplicationVersion":4}',
    }),
  );
});
it('rejects invalid and cross-origin deletion without forwarding', async () => {
  const s = setup();
  const id = postingFixtures()[0].id;
  expect((await s.bridge(req(`/${id}`, 'DELETE', {}))).status).toBe(400);
  expect(
    (
      await s.bridge(
        req(`/${id}/extraction`, 'DELETE', { expectedApplicationVersion: 0 }),
      )
    ).status,
  ).toBe(405);
  expect(
    (
      await s.bridge(
        new Request(`http://localhost:3000/api/job-postings/${id}`, {
          method: 'DELETE',
          headers: { origin: 'http://foreign.test' },
        }),
      )
    ).status,
  ).toBe(403);
  expect(s.fetcher).not.toHaveBeenCalled();
  expect(
    (await s.bridge(req(`/${id}`, 'DELETE', { expectedApplicationVersion: 0 })))
      .status,
  ).toBe(502);
});

it('validates role update requests, history and undo through the authenticated bridge', async () => {
  const id = postingFixtures()[0].id;
  const operationId = '00000000-0000-4000-8000-123456789012';
  const entry = {
    id: operationId,
    text: 'Priority high',
    createdAt: '2026-09-21T00:00:00.000Z',
    status: 'queued',
    changes: [],
    skipped: [],
    error: null,
    undoneAt: null,
  };
  const s = setup({ schemaVersion: 1, entry });
  expect(
    (
      await s.bridge(
        req(`/${id}/updates`, 'POST', {
          operationId,
          text: entry.text,
          timezone: 'UTC',
        }),
      )
    ).status,
  ).toBe(200);
  expect(
    String(s.fetcher.mock.calls[0][0]).endsWith(`/job-postings/${id}/updates`),
  ).toBe(true);
  expect(
    (
      await s.bridge(
        req(`/${id}/updates`, 'POST', {
          operationId,
          text: '',
          timezone: 'invalid',
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (await s.bridge(req(`/${id}/updates/${operationId}/undo`, 'POST', {})))
      .status,
  ).toBe(200);
  s.fetcher.mockResolvedValueOnce(
    Response.json({ schemaVersion: 1, items: [entry], nextCursor: null }),
  );
  expect((await s.bridge(req(`/${id}/updates?cursor=abc`))).status).toBe(200);
  expect((await s.bridge(req(`/${id}/updates?cursor=a&cursor=b`))).status).toBe(
    400,
  );
  expect(
    (
      await s.bridge(
        req(`/${id}/updates/${operationId}/undo`, 'POST', { unexpected: true }),
      )
    ).status,
  ).toBe(400);
});

it('bridges comment routes with bounded contracts and rejects unsupported methods', async () => {
  const id = postingFixtures()[0].id;
  const note = {
    id: '00000000-0000-4000-8000-000000000090',
    body: '**Fictional** note',
    revision: 1,
    createdAt: '2026-09-22T00:00:00.000Z',
    updatedAt: '2026-09-22T00:00:00.000Z',
  };
  const s = setup({ schemaVersion: 1, note });
  const call = (path: string, method: string, body?: unknown) =>
    s.bridge(
      new Request(`http://localhost:3000/api/job-postings/${id}/notes${path}`, {
        method,
        headers: {
          origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  expect(
    (await call('', 'POST', { id: note.id, body: note.body })).status,
  ).toBe(200);
  expect(
    (
      await call(`/${note.id}`, 'PATCH', {
        expectedRevision: 1,
        body: 'Edited',
      })
    ).status,
  ).toBe(200);
  s.fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
  expect(
    (await call(`/${note.id}`, 'DELETE', { expectedRevision: 1 })).status,
  ).toBe(204);
  s.fetcher.mockResolvedValueOnce(
    Response.json({ schemaVersion: 1, items: [note], nextCursor: null }),
  );
  expect((await call('?cursor=fixture', 'GET')).status).toBe(200);
  expect((await call('', 'PATCH', { body: 'Wrong route' })).status).toBe(405);
  expect((await call(`/${note.id}`, 'GET')).status).toBe(405);
  expect((await call('', 'POST', { id: note.id, body: ' ' })).status).toBe(400);
  expect(
    (await call('', 'POST', { id: note.id, body: 'x'.repeat(20001) })).status,
  ).toBe(400);
  expect((await call('?cursor=a&cursor=b', 'GET')).status).toBe(400);
  expect(
    (await call('/not-a-uuid', 'DELETE', { expectedRevision: 1 })).status,
  ).toBe(404);
  s.fetcher.mockResolvedValueOnce(
    Response.json({ schemaVersion: 1, note: { ...note, body: 123 } }),
  );
  expect(
    (await call('', 'POST', { id: note.id, body: note.body })).status,
  ).toBe(503);
});
