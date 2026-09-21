import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  cookies: vi.fn(),
  getUser: vi.fn(),
  perform: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock('server-only', () => ({}));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.create }));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('./auth.operations', () => ({ performAuth: mocks.perform }));

import { submitAuth } from './auth.actions';
import { createAuthClient } from './auth.client';
import { authConfig, authCookieName } from './auth.config';
import { refreshAuth } from './auth.proxy';
import {
  backendSession,
  clearAuthCookies,
  requireUser,
  serverAuthClient,
  serverIdentity,
} from './auth.session';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fictional',
  APP_ORIGIN: 'http://localhost:3000',
};
const store = {
  getAll: vi.fn(() => [{ name: authCookieName, value: 'fictional' }]),
  set: vi.fn(),
};
beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  mocks.create.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.cookies.mockResolvedValue(store);
  store.getAll.mockReturnValue([{ name: authCookieName, value: 'fictional' }]);
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'fictional' } },
    error: null,
  });
  mocks.redirect.mockImplementation((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  });
});

describe('server configuration and cookies', () => {
  it('reads runtime configuration and accepts localhost, loopback and HTTPS', () => {
    expect(authConfig()).toMatchObject({
      origin: 'http://localhost:3000',
      secure: false,
    });
    expect(
      authConfig({
        ...env,
        APP_ORIGIN: 'http://127.0.0.1:3100',
        SUPABASE_URL: 'http://127.0.0.1:3101',
      }).secure,
    ).toBe(false);
    expect(
      authConfig({ ...env, APP_ORIGIN: 'https://app.example.test' }).secure,
    ).toBe(true);
  });
  it.each(['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'APP_ORIGIN'])(
    'requires %s',
    (key) => {
      expect(() => authConfig({ ...env, [key]: '' })).toThrow('incomplete');
    },
  );
  it.each([
    'not-url',
    'http://external.test',
    'ftp://localhost',
    'https://user@example.test',
    'https://:password@example.test',
    'https://example.test/path',
    'https://example.test?query=1',
    'https://example.test#hash',
  ])('rejects unsafe URL %s', (url) => {
    expect(() => authConfig({ ...env, APP_ORIGIN: url })).toThrow();
    expect(() => authConfig({ ...env, SUPABASE_URL: url })).toThrow();
  });
  it('rejects secret and legacy keys', () =>
    expect(() =>
      authConfig({ ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fictional' }),
    ).toThrow('publishable'));
  it('creates a fresh server client with HTTP-only cookies', () => {
    const adapter = { getAll: () => [] };
    createAuthClient(adapter);
    expect(mocks.create).toHaveBeenCalledWith(
      env.SUPABASE_URL,
      env.SUPABASE_PUBLISHABLE_KEY,
      expect.objectContaining({
        cookies: adapter,
        cookieOptions: expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
        }),
      }),
    );
  });
  it('writes cookies in actions and leaves persistence to Proxy in Server Components', async () => {
    await serverAuthClient();
    let adapter = mocks.create.mock.calls[0][2].cookies;
    expect(adapter.getAll()).toEqual(store.getAll());
    adapter.setAll([
      { name: authCookieName, value: 'new', options: { path: '/' } },
    ]);
    expect(store.set).not.toHaveBeenCalled();
    await serverAuthClient(true);
    adapter = mocks.create.mock.calls[1][2].cookies;
    adapter.setAll([
      { name: authCookieName, value: 'new', options: { path: '/' } },
    ]);
    expect(store.set).toHaveBeenCalledWith(authCookieName, 'new', {
      path: '/',
    });
  });
  it('clears only this application’s auth cookie and chunks/verifiers', async () => {
    store.getAll.mockReturnValue(
      [
        authCookieName,
        `${authCookieName}.0`,
        `${authCookieName}-code-verifier`,
        'theme',
        'another-auth',
      ].map((name) => ({ name, value: 'fictional' })),
    );
    await clearAuthCookies();
    expect(store.set.mock.calls.map(([name]) => name)).toEqual([
      authCookieName,
      `${authCookieName}.0`,
      `${authCookieName}-code-verifier`,
    ]);
    expect(store.set).toHaveBeenCalledWith(
      authCookieName,
      '',
      expect.objectContaining({ maxAge: 0, httpOnly: true }),
    );
  });
  it('requires verified identity at server entry points', async () => {
    expect(await requireUser()).toEqual({
      status: 'authenticated',
      userId: 'fictional',
    });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireUser('/app/roles/example')).rejects.toThrow(
      'REDIRECT:/login?next=%2Fapp%2Froles%2Fexample',
    );
    mocks.create.mockImplementation(() => {
      throw new Error('private detail');
    });
    expect(await serverIdentity()).toEqual({ status: 'unavailable' });
    await expect(requireUser('//evil.test')).rejects.toThrow(
      'REDIRECT:/auth/unavailable?next=%2Fapp',
    );
  });
});

describe('Proxy refresh and protection', () => {
  it('uses configured origin when Next normalizes a loopback request hostname', async () => {
    vi.stubEnv('APP_ORIGIN', 'http://127.0.0.1:3100');
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await refreshAuth(
      new NextRequest('http://localhost:3100/app'),
    );
    expect(response.headers.get('location')).toBe(
      'http://127.0.0.1:3100/login?next=%2Fapp',
    );
  });
  it('still reaches the independent error page if configuration is missing', async () => {
    vi.stubEnv('APP_ORIGIN', '');
    const response = await refreshAuth(
      new NextRequest('http://localhost:3000/app'),
    );
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/unavailable?next=%2Fapp',
    );
  });

  it('forwards refreshed cookies to downstream rendering and browser responses', async () => {
    mocks.create.mockImplementation((_url, _key, options) => ({
      auth: {
        getUser: async () => {
          expect(options.cookies.getAll()).toEqual([
            { name: authCookieName, value: 'old' },
          ]);
          options.cookies.setAll([
            {
              name: authCookieName,
              value: 'refreshed',
              options: { httpOnly: true, path: '/' },
            },
          ]);
          options.cookies.setAll([
            {
              name: `${authCookieName}.0`,
              value: 'chunk',
              options: { httpOnly: true, path: '/' },
            },
          ]);
          return { data: { user: { id: 'fictional' } }, error: null };
        },
      },
    }));
    const request = new NextRequest('http://localhost:3000/app', {
      headers: { cookie: `${authCookieName}=old` },
    });
    const response = await refreshAuth(request);
    expect(request.cookies.get(authCookieName)?.value).toBe('refreshed');
    expect(response.cookies.get(authCookieName)?.value).toBe('refreshed');
    expect(response.cookies.get(`${authCookieName}.0`)?.value).toBe('chunk');
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      'refreshed',
    );
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it.each(['/app', '/app/roles/example?tab=notes'])(
    'redirects anonymous deep link %s',
    async (path) => {
      mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
      const response = await refreshAuth(
        new NextRequest(`http://localhost:3000${path}`),
      );
      const location = new URL(
        response.headers.get('location') as string,
        'http://localhost:3000',
      );
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('next')).toBe(path);
    },
  );
  it.each([
    '/login',
    '/signup',
    '/forgot-password',
    '/auth/confirm',
    '/reset-password',
  ])('allows anonymous auth entry %s', async (path) => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(
      (await refreshAuth(new NextRequest(`http://localhost:3000${path}`)))
        .status,
    ).toBe(200);
  });
  it('preserves cookie removal even when refresh leads to a redirect', async () => {
    mocks.create.mockImplementation((_url, _key, options) => ({
      auth: {
        getUser: async () => {
          options.cookies.setAll([
            { name: authCookieName, value: '', options: { maxAge: 0 } },
          ]);
          return { data: { user: null }, error: { status: 401 } };
        },
      },
    }));
    const response = await refreshAuth(
      new NextRequest('http://localhost:3000/app'),
    );
    expect(response.status).toBe(307);
    expect(response.cookies.get(authCookieName)?.maxAge).toBe(0);
    expect(response.headers.get('cache-control')).toContain('private');
  });
  it('fails closed without sending token query parameters to the error page', async () => {
    mocks.getUser.mockRejectedValue(new Error('outage'));
    const request = new NextRequest(
      'http://localhost:3000/auth/confirm?token_hash=private',
    );
    expect((await refreshAuth(request)).headers.get('location')).toBe(
      'http://localhost:3000/auth/unavailable?next=%2Fauth%2Fconfirm',
    );
    mocks.create.mockImplementation(() => {
      throw new Error('configuration');
    });
    expect((await refreshAuth(request)).headers.get('location')).not.toContain(
      'private',
    );
  });
});

describe('Server Action boundary', () => {
  it('returns form state and wires writable cookies plus configured origin', async () => {
    const state = { status: 'error', message: 'Try again' };
    mocks.perform.mockImplementation(async (_operation, _form, deps) => {
      await deps.client();
      expect(deps.origin()).toBe('http://localhost:3000');
      await deps.clearSession();
      return { state };
    });
    expect(
      await submitAuth(
        'login',
        { status: 'idle', message: '' },
        new FormData(),
      ),
    ).toEqual(state);
    expect(store.set).toHaveBeenCalled();
  });
  it('does not swallow framework redirects as provider errors', async () => {
    mocks.perform.mockResolvedValue({
      state: { status: 'success', message: '' },
      redirect: '/app',
    });
    await expect(
      submitAuth('login', { status: 'idle', message: '' }, new FormData()),
    ).rejects.toThrow('REDIRECT:/app');
  });
});

describe('backend token boundary', () => {
  it('returns a token only after remote verification of the same user', async () => {
    const getSession = vi.fn(async () => ({
      data: {
        session: { user: { id: 'fictional' }, access_token: 'synthetic-token' },
      },
      error: null,
    }));
    mocks.create.mockReturnValue({
      auth: { getUser: mocks.getUser, getSession },
    });
    expect(await backendSession()).toEqual({
      status: 'authenticated',
      accessToken: 'synthetic-token',
    });
    expect(mocks.getUser.mock.invocationCallOrder[0]).toBeLessThan(
      getSession.mock.invocationCallOrder[0],
    );
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await backendSession()).toEqual({ status: 'anonymous' });
    expect(getSession).toHaveBeenCalledTimes(1);
  });
  it.each([
    { data: { session: null }, error: null },
    {
      data: { session: { user: { id: 'another' }, access_token: 'synthetic' } },
      error: null,
    },
    { data: { session: null }, error: { message: 'private' } },
  ])('rejects unavailable or mismatched sessions', async (value) => {
    mocks.create.mockReturnValue({
      auth: {
        getUser: mocks.getUser,
        getSession: vi.fn().mockResolvedValue(value),
      },
    });
    expect(await backendSession()).toEqual({ status: 'anonymous' });
  });
  it('maps provider exceptions to unavailable without exposing them', async () => {
    mocks.create.mockImplementation(() => {
      throw new Error('private');
    });
    expect(await backendSession()).toEqual({ status: 'unavailable' });
  });
});
