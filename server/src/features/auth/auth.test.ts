import express from 'express';
import { CompactSign, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { buildApp } from '../../app.ts';
import { errorMiddleware } from '../../shared/shared.errors.ts';
import { authConfig } from './auth.config.ts';
import { requireAuthentication } from './auth.middleware.ts';
import type { AuthLocals } from './auth.types.ts';
import { createAccessTokenVerifier } from './auth.verifier.ts';

const config = authConfig({ SUPABASE_URL: 'https://auth.example.test' });
const instant = new Date('2026-09-19T12:00:00Z');
const now = instant.getTime() / 1000;
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let otherPair: Awaited<ReturnType<typeof generateKeyPair>>;
let rsaPair: Awaited<ReturnType<typeof generateKeyPair>>;
let jwks: { keys: Awaited<ReturnType<typeof exportJWK>>[] };

beforeAll(async () => {
  pair = await generateKeyPair('ES256');
  otherPair = await generateKeyPair('ES256');
  rsaPair = await generateKeyPair('RS256');
  jwks = {
    keys: [
      { ...(await exportJWK(pair.publicKey)), kid: 'current', alg: 'ES256' },
    ],
  };
});
beforeEach(() => {
  vi.setSystemTime(instant);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function claims() {
  return {
    iss: config.issuer,
    aud: 'authenticated',
    sub: 'user-one',
    role: 'authenticated',
    exp: now + 3600,
    is_anonymous: false,
  };
}

function sign(
  overrides: Record<string, unknown> = {},
  key = pair.privateKey,
  kid = 'current',
  alg = 'ES256',
) {
  // CompactSign also lets us exercise invalid claim types without JWT-builder validation.
  return new CompactSign(
    new TextEncoder().encode(JSON.stringify({ ...claims(), ...overrides })),
  )
    .setProtectedHeader({ alg, kid })
    .sign(key);
}

function fixture(
  fetchKeys = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json(jwks)),
) {
  const verify = createAccessTokenVerifier(config, fetchKeys);
  return { app: buildApp({ verifyAccessToken: verify }), verify, fetchKeys };
}

function expectUnauthorized(response: request.Response) {
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Invalid or missing credentials.' });
  expect(response.headers['www-authenticate']).toBe('Bearer');
  expect(response.headers['cache-control']).toBe('no-store');
}

describe('protected application', () => {
  it('accepts a signed user token and caches only the public keys', async () => {
    const { app, fetchKeys } = fixture();
    for (const sub of ['user-one', 'user-two']) {
      const response = await request(app)
        .get('/')
        .auth(await sign({ sub }), { type: 'bearer' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Hello, world!' });
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(fetchKeys).toHaveBeenCalledTimes(1);
    expect(fetchKeys.mock.calls[0]?.[0]).toBe(config.jwksUrl.href);
  });

  it('accepts RS256 and case-insensitive Bearer schemes', async () => {
    const keys = {
      keys: [
        { ...(await exportJWK(rsaPair.publicKey)), kid: 'rsa', alg: 'RS256' },
      ],
    };
    const { app } = fixture(
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(keys)),
    );
    const token = await sign({}, rsaPair.privateKey, 'rsa', 'RS256');
    expect(
      (await request(app).get('/').set('Authorization', `bearer ${token}`))
        .status,
    ).toBe(200);
  });

  it('keeps health public, even during an auth outage', async () => {
    const { app, fetchKeys } = fixture(
      vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
    );
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'ok' });
    expect(fetchKeys).not.toHaveBeenCalled();
  });

  it.each([
    '',
    'Basic credential',
    'Bearer',
    'Bearer a b',
    'Bearer a,b',
    'Bearer invalid',
  ])('rejects invalid credentials: %s', async (header) => {
    const { app, fetchKeys } = fixture();
    expectUnauthorized(
      await request(app).get('/').set('Authorization', header),
    );
    expect(fetchKeys).not.toHaveBeenCalled();
  });

  it('does not accept cookie, query, or duplicate-header credentials', async () => {
    const { app, fetchKeys } = fixture();
    const token = await sign();
    expectUnauthorized(
      await request(app)
        .get('/')
        .query({ access_token: token })
        .set('Cookie', `access_token=${token}`),
    );
    expectUnauthorized(
      await request(app)
        .get('/')
        .set({ Authorization: [`Bearer ${token}`, `Bearer ${token}`] }),
    );
    expect(fetchKeys).not.toHaveBeenCalled();
  });

  it.each<[string, Record<string, unknown>]>([
    ['issuer', { iss: 'https://other.example.test/auth/v1' }],
    ['audience', { aud: 'other' }],
    ['service role', { role: 'service_role' }],
    ['anon role', { role: 'anon' }],
    ['expired', { exp: now }],
    ['future not-before', { nbf: now + 60 }],
    ['empty subject', { sub: ' ' }],
    ['non-string subject', { sub: 123 }],
    ['non-numeric expiry', { exp: 'later' }],
    ['anonymous user', { is_anonymous: true }],
    ['invalid anonymous flag', { is_anonymous: 'false' }],
    ...['iss', 'aud', 'sub', 'exp', 'role'].map<
      [string, Record<string, unknown>]
    >((claim) => [`missing ${claim}`, { [claim]: undefined }]),
  ])('rejects %s', async (_name, overrides) => {
    const { app } = fixture();
    expectUnauthorized(
      await request(app)
        .get('/')
        .auth(await sign(overrides), {
          type: 'bearer',
        }),
    );
  });

  it('rejects forged signatures and unknown keys', async () => {
    const { app } = fixture();
    for (const token of [
      await sign({}, otherPair.privateKey),
      await sign({}, otherPair.privateKey, 'unknown'),
    ]) {
      expectUnauthorized(
        await request(app).get('/').auth(token, { type: 'bearer' }),
      );
    }
  });

  it('rejects unsigned and HS256 tokens before key retrieval', async () => {
    const { app, fetchKeys } = fixture();
    const unsigned = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims())).toString('base64url')}.`;
    const symmetric = await new SignJWT(claims())
      .setProtectedHeader({ alg: 'HS256' })
      .sign(new Uint8Array(32));
    for (const token of [unsigned, symmetric])
      expectUnauthorized(
        await request(app).get('/').auth(token, { type: 'bearer' }),
      );
    expect(fetchKeys).not.toHaveBeenCalled();
  });

  it('keeps identities request-local across concurrent users', async () => {
    const { verify } = fixture();
    const app = express();
    app.use(requireAuthentication(verify));
    app.get(
      '/identity',
      async (_req, res: express.Response<unknown, AuthLocals>) => {
        await new Promise((resolve) => setImmediate(resolve));
        res.json(res.locals.identity);
      },
    );
    app.use(errorMiddleware);
    const tokens = await Promise.all(
      ['one', 'two'].map((sub) => sign({ sub })),
    );
    const responses = await Promise.all(
      tokens.map((token) =>
        request(app).get('/identity').auth(token, { type: 'bearer' }),
      ),
    );
    expect(responses.map((response) => response.body)).toEqual([
      { userId: 'one' },
      { userId: 'two' },
    ]);
    expectUnauthorized(await request(app).get('/identity'));
  });

  it('gates implicit HEAD requests and future application routes', async () => {
    const { app } = fixture();
    expect((await request(app).head('/')).status).toBe(401);
    expectUnauthorized(await request(app).get('/future'));
  });
});

describe('key retrieval and failures', () => {
  it('refreshes rotated keys after the cooldown and rechecks expiry on every call', async () => {
    const { verify, fetchKeys } = fixture();
    const token = await sign();
    await verify(token);
    const nextToken = await sign({}, otherPair.privateKey, 'next');
    await expect(verify(nextToken)).rejects.toMatchObject({ statusCode: 401 });
    expect(fetchKeys).toHaveBeenCalledTimes(1);
    fetchKeys.mockImplementation(async () =>
      Response.json({
        keys: [
          ...jwks.keys,
          {
            ...(await exportJWK(otherPair.publicKey)),
            kid: 'next',
            alg: 'ES256',
          },
        ],
      }),
    );
    vi.setSystemTime(instant.getTime() + 30_001);
    await expect(verify(nextToken)).resolves.toEqual({ userId: 'user-one' });
    expect(fetchKeys).toHaveBeenCalledTimes(2);
    vi.setSystemTime(instant.getTime() + 3600_000);
    await expect(verify(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('shares in-flight discovery and fails closed when an expired cache cannot refresh', async () => {
    const { verify, fetchKeys } = fixture();
    const token = await sign();
    await Promise.all([verify(token), verify(token)]);
    expect(fetchKeys).toHaveBeenCalledTimes(1);
    fetchKeys.mockRejectedValue(new Error('offline'));
    vi.setSystemTime(instant.getTime() + 599_999);
    await expect(verify(token)).resolves.toEqual({ userId: 'user-one' });
    vi.setSystemTime(instant.getTime() + 600_000);
    await expect(verify(token)).rejects.toMatchObject({ statusCode: 503 });
    fetchKeys.mockImplementation(async () => Response.json(jwks));
    await expect(verify(token)).resolves.toEqual({ userId: 'user-one' });
  });

  it.each([
    [
      'network failure',
      async () => {
        throw new Error('private-provider-detail');
      },
    ],
    [
      'provider status',
      async () => new Response('private-provider-detail', { status: 500 }),
    ],
    ['malformed JSON', async () => new Response('private-provider-detail')],
    ['invalid key set', async () => Response.json({ keys: 'invalid' })],
  ])(
    'returns a safe 503 for %s without logging credentials or causes',
    async (_name, fetchKeys) => {
      const { app } = fixture(
        vi.fn<typeof fetch>().mockImplementation(fetchKeys),
      );
      const token = await sign({ email: 'private-user@example.test' });
      const response = await request(app)
        .get('/')
        .auth(token, { type: 'bearer' });
      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        message: 'Authentication is temporarily unavailable.',
      });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['www-authenticate']).toBeUndefined();
      const logs = JSON.stringify([
        vi.mocked(console.log).mock.calls,
        vi.mocked(console.error).mock.calls,
      ]);
      for (const privateValue of [
        token,
        'private-provider-detail',
        'private-user@example.test',
      ])
        expect(logs).not.toContain(privateValue);
    },
  );

  it('bounds a stalled key request to five seconds', async () => {
    vi.useRealTimers();
    const fetchKeys = vi.fn<typeof fetch>().mockImplementation(
      async (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(options.signal?.reason),
            { once: true },
          );
        }),
    );
    const { verify } = fixture(fetchKeys);
    const token = await sign({ exp: Math.floor(Date.now() / 1000) + 3600 });
    await expect(verify(token)).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchKeys).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('never logs paths, queries, headers, or request bodies', async () => {
    const { app } = fixture();
    await request(app)
      .post('/private-path')
      .query({ access_token: 'private-query' })
      .set('Authorization', 'Bearer private-header')
      .send({ password: 'private-body' });
    const logs = JSON.stringify([
      vi.mocked(console.log).mock.calls,
      vi.mocked(console.error).mock.calls,
    ]);
    for (const value of [
      'private-path',
      'private-query',
      'private-header',
      'private-body',
    ])
      expect(logs).not.toContain(value);
  });
});
