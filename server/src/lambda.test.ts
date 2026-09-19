import { afterEach, expect, it, vi } from 'vitest';

function event(path: string) {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: { host: 'lambda.example.test' },
    requestContext: {
      http: {
        method: 'GET',
        path,
        sourceIp: '127.0.0.1',
        protocol: 'HTTP/1.1',
      },
    },
    isBase64Encoded: false,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

it('constructs auth lazily, retries failed construction, and gates Lambda requests', async () => {
  vi.stubEnv('SUPABASE_URL', undefined);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('no network'));
  const { handler } = await import('./lambda.ts');
  await expect(handler(event('/'), {})).rejects.toThrow(
    'SUPABASE_URL is required.',
  );
  vi.stubEnv('SUPABASE_URL', 'https://auth.example.test');
  await expect(handler(event('/health'), {})).resolves.toMatchObject({
    statusCode: 200,
    body: JSON.stringify({ message: 'ok' }),
  });
  vi.stubEnv('SUPABASE_URL', undefined);
  await expect(handler(event('/'), {})).resolves.toMatchObject({
    statusCode: 401,
    body: JSON.stringify({ message: 'Invalid or missing credentials.' }),
    headers: { 'cache-control': 'no-store', 'www-authenticate': 'Bearer' },
  });
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('accepts a signed Function URL token and rejects comma-joined duplicate credentials', async () => {
  const { exportJWK, generateKeyPair, SignJWT } = await import('jose');
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  vi.stubEnv('SUPABASE_URL', 'https://auth.example.test');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const fetchKeys = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    Response.json({
      keys: [{ ...(await exportJWK(publicKey)), kid: 'test', alg: 'ES256' }],
    }),
  );
  const token = await new SignJWT({
    role: 'authenticated',
    is_anonymous: false,
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test' })
    .setSubject('lambda-test-user')
    .setIssuer('https://auth.example.test/auth/v1')
    .setAudience('authenticated')
    .setExpirationTime('5m')
    .sign(privateKey);
  const { handler } = await import('./lambda.ts');
  const valid = {
    ...event('/'),
    headers: { authorization: `Bearer ${token}` },
  };
  await expect(handler(valid, {})).resolves.toMatchObject({
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello, world!' }),
  });
  expect(fetchKeys).toHaveBeenCalledTimes(1);
  await expect(
    handler(
      {
        ...valid,
        headers: { authorization: `Bearer ${token},Bearer ${token}` },
      },
      {},
    ),
  ).resolves.toMatchObject({ statusCode: 401 });
  expect(fetchKeys).toHaveBeenCalledTimes(1);
});
