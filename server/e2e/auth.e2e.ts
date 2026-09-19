import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  liveConfiguration,
  liveRequest,
  responseObject,
} from './live-client.ts';

describe('deployed hello authentication', () => {
  let config: ReturnType<typeof liveConfiguration>;
  let accessToken = '';
  let refreshToken = '';

  beforeAll(async () => {
    config = liveConfiguration();
    const response = await liveRequest(
      `${config.issuer}/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: config.publishableKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: config.email,
          password: config.password,
        }),
      },
    );
    expect(response.status, 'Dedicated development account sign-in').toBe(200);
    const session = await responseObject(response);
    if (typeof session.access_token === 'string')
      accessToken = session.access_token;
    if (typeof session.refresh_token === 'string')
      refreshToken = session.refresh_token;
    expect(
      Boolean(accessToken && refreshToken),
      'Provider returned a user session',
    ).toBe(true);
  });

  afterAll(async () => {
    if (!accessToken) return;
    try {
      const response = await liveRequest(
        `${config.issuer}/logout?scope=local`,
        {
          method: 'POST',
          headers: {
            apikey: config.publishableKey,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      expect(
        response.status,
        'Revoke only the session created by this suite',
      ).toBe(204);
    } finally {
      accessToken = '';
      refreshToken = '';
    }
  });

  async function checkHello(
    headers: Record<string, string>,
    status: 200 | 401,
    path = '/',
  ) {
    const response = await liveRequest(`${config.api}${path}`, { headers });
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await responseObject(response);
    const expected =
      status === 200 ? 'Hello, world!' : 'Invalid or missing credentials.';
    // Boolean assertions avoid printing an unexpectedly echoed token in a failure diff.
    expect(
      Object.keys(body).length === 1 && body.message === expected,
      'Safe response envelope',
    ).toBe(true);
    if (status === 401) {
      const challenge =
        response.headers.get('www-authenticate') ??
        response.headers.get('x-amzn-remapped-www-authenticate');
      expect(
        challenge === 'Bearer',
        'Bearer challenge (AWS may remap its header)',
      ).toBe(true);
    }
  }

  it('serves public health without credentials', async () => {
    const response = await liveRequest(`${config.api}/health`);
    expect(response.status).toBe(200);
    const body = await responseObject(response);
    expect(Object.keys(body).length === 1 && body.message === 'ok').toBe(true);
  });

  it('returns hello for a real hosted user token', async () => {
    await checkHello({ Authorization: `Bearer ${accessToken}` }, 200);
  });

  it('accepts the case-insensitive bearer scheme', async () => {
    await checkHello({ Authorization: `bearer ${accessToken}` }, 200);
  });

  it('rejects missing credentials', async () => {
    await checkHello({}, 401);
  });

  it('rejects malformed tokens', async () => {
    await checkHello({ Authorization: 'Bearer invalid' }, 401);
  });

  it('rejects a real token with a tampered signature', async () => {
    const parts = accessToken.split('.');
    const signature = Buffer.from(parts[2] ?? '', 'base64url');
    expect(signature.length > 0).toBe(true);
    signature[0] = (signature[0] ?? 0) ^ 1;
    parts[2] = signature.toString('base64url');
    await checkHello({ Authorization: `Bearer ${parts.join('.')}` }, 401);
  });

  it('rejects a publishable API key as a user credential', async () => {
    await checkHello({ Authorization: `Bearer ${config.publishableKey}` }, 401);
  });

  it('rejects a refresh token as an access token', async () => {
    await checkHello({ Authorization: `Bearer ${refreshToken}` }, 401);
  });

  it('rejects a valid token under the wrong scheme', async () => {
    await checkHello({ Authorization: `Basic ${accessToken}` }, 401);
  });

  it('does not authenticate with cookies', async () => {
    await checkHello({ Cookie: `access_token=${accessToken}` }, 401);
  });

  it('does not accept query credentials', async () => {
    // Keep real credentials out of URLs and infrastructure request logs.
    await checkHello({}, 401, '/?access_token=e2e-invalid-token');
  });

  it('rejects comma-joined bearer credentials', async () => {
    await checkHello(
      { Authorization: `Bearer ${accessToken},Bearer ${accessToken}` },
      401,
    );
  });

  it('keeps simultaneous authenticated and unauthenticated requests isolated', async () => {
    await Promise.all([
      checkHello({ Authorization: `Bearer ${accessToken}` }, 200),
      checkHello({}, 401),
      checkHello({ Authorization: `Bearer ${accessToken}` }, 200),
      checkHello({}, 401),
    ]);
  });
});
