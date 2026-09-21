import { afterEach, expect, it, vi } from 'vitest';
import { createHelloBridge } from './hello.bridge';
import { apiConfig } from './hello.config';
import { helloRequest } from './hello.server';

vi.mock('server-only', () => ({}));
const session = vi.hoisted(() => vi.fn());
vi.mock('@/features/auth/auth.server.index', () => ({
  backendSession: session,
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it('forwards only verified credentials to the fixed target and sanitizes output', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ message: 'Hello, world!', private: 'not forwarded' }),
    );
  const response = await createHelloBridge({
    origin: 'https://api.example.test',
    session: async () => ({
      status: 'authenticated',
      accessToken: 'fictional',
    }),
    fetch,
  })();
  expect(await response.json()).toEqual({ message: 'Hello, world!' });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(fetch).toHaveBeenCalledWith(
    new URL('https://api.example.test/'),
    expect.objectContaining({
      headers: { Authorization: 'Bearer fictional' },
      redirect: 'error',
      cache: 'no-store',
    }),
  );
});
it.each(['anonymous', 'unavailable'] as const)(
  'does not contact the API for %s sessions',
  async (status) => {
    const fetch = vi.fn();
    const response = await createHelloBridge({
      origin: 'https://api.example.test',
      session: async () => ({ status }),
      fetch,
    })();
    expect(response.status).toBe(status === 'anonymous' ? 401 : 503);
    expect(fetch).not.toHaveBeenCalled();
  },
);
it.each([401, 403, 500])(
  'maps backend %s without exposing its body',
  async (status) => {
    const response = await createHelloBridge({
      origin: 'https://api.example.test',
      session: async () => ({
        status: 'authenticated',
        accessToken: 'fictional',
      }),
      fetch: vi
        .fn()
        .mockResolvedValue(new Response('private provider error', { status })),
    })();
    expect(response.status).toBe(status === 401 ? 401 : 502);
    expect(await response.text()).not.toContain('private provider error');
  },
);
it.each([null, {}, { message: 'wrong' }, 'invalid-json'])(
  'handles malformed API responses: %j',
  async (data) => {
    const response = await createHelloBridge({
      origin: 'https://api.example.test',
      session: async () => ({
        status: 'authenticated',
        accessToken: 'fictional',
      }),
      fetch: vi
        .fn()
        .mockResolvedValue(
          typeof data === 'string' ? new Response(data) : Response.json(data),
        ),
    })();
    expect(response.status).toBeGreaterThanOrEqual(500);
  },
);
it('handles network and session exceptions without logging causes', async () => {
  for (const sessionFails of [false, true]) {
    const response = await createHelloBridge({
      origin: 'https://api.example.test',
      session: async () => {
        if (sessionFails) throw Error('secret');
        return { status: 'authenticated', accessToken: 'fictional' };
      },
      fetch: vi.fn().mockRejectedValue(Error('secret')),
    })();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret');
  }
});
it.each([
  {},
  { APP_STAGE: 'other' },
  { APP_STAGE: 'prod' },
  { APP_STAGE: 'dev', API_BASE_URL_DEV: 'https://user:pass@api.example.test' },
  { APP_STAGE: 'dev', API_BASE_URL_DEV: 'http://remote.example.test' },
  { APP_STAGE: 'prod', API_BASE_URL_PROD: 'http://localhost:3001' },
  { APP_STAGE: 'dev', API_BASE_URL_DEV: 'https://api.example.test/path' },
])(
  'rejects missing/unsafe stage configuration without a fallback: %j',
  (env) => {
    expect(() => apiConfig(env)).toThrow();
  },
);
it('selects explicit stages and permits dev loopback', () => {
  expect(
    apiConfig({
      NODE_ENV: 'development',
      API_BASE_URL_DEV: 'http://localhost:3001',
    }).origin,
  ).toBe('http://localhost:3001');
  expect(
    apiConfig({
      APP_STAGE: 'prod',
      API_BASE_URL_PROD: 'https://api.example.test',
    }).stage,
  ).toBe('prod');
});
it('composes the server boundary and reports missing API config safely', async () => {
  vi.stubEnv('APP_STAGE', 'dev');
  vi.stubEnv('API_BASE_URL_DEV', '');
  expect((await helloRequest()).status).toBe(503);
  expect(session).not.toHaveBeenCalled();
  vi.stubEnv('API_BASE_URL_DEV', 'https://api.example.test');
  session.mockResolvedValue({
    status: 'authenticated',
    accessToken: 'fictional',
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ message: 'Hello, world!' })),
  );
  expect((await helloRequest()).status).toBe(200);
});
