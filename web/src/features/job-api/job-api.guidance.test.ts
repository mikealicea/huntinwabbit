import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createApiBridge } from './job-api.bridge';

function setup(
  value: unknown = { hostname: 'indeed.com', recommendSourceText: true },
) {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(value));
  const bridge = createApiBridge({
    origin: 'https://api.example.test',
    appOrigin: 'http://localhost:3000',
    session: async () => ({
      status: 'authenticated',
      accessToken: 'fixture-token',
    }),
    fetch: fetcher,
  });
  return { fetcher, bridge };
}
function request(
  body: unknown = { hostname: 'indeed.com' },
  method = 'POST',
  origin = 'http://localhost:3000',
) {
  return new Request('http://localhost:3000/api/job-postings/source-guidance', {
    method,
    headers: { origin, 'Content-Type': 'application/json' },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
  });
}
it('forwards only a validated hostname through the authenticated no-store bridge', async () => {
  const { bridge, fetcher } = setup();
  const response = await bridge(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    hostname: 'indeed.com',
    recommendSourceText: true,
  });
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(fetcher).toHaveBeenCalledWith(
    'https://api.example.test/job-postings/source-guidance',
    expect.objectContaining({
      method: 'POST',
      body: '{"hostname":"indeed.com"}',
      redirect: 'error',
      cache: 'no-store',
    }),
  );
});
it.each([
  { hostname: 'https://indeed.com/private' },
  { hostname: 'indeed.com', blocked: true },
  { url: 'https://indeed.com' },
])('rejects invalid lookup input', async (body) => {
  const { bridge, fetcher } = setup();
  expect((await bridge(request(body))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
it('does not expose enumeration, cross-origin access or malformed upstream responses', async () => {
  const { bridge, fetcher } = setup({
    hostname: 'indeed.com',
    recommendSourceText: 'yes',
    private: 'payload',
  });
  expect((await bridge(request(undefined, 'GET'))).status).toBe(405);
  expect(
    (await bridge(request(undefined, 'POST', 'https://other.test'))).status,
  ).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
  const response = await bridge(request());
  expect(response.status).toBeGreaterThanOrEqual(500);
  expect(await response.text()).not.toContain('payload');
});
