import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const directory = await mkdtemp(
  join(tmpdir(), 'huntinwabbit-boilerplate-package-'),
);
try {
  execFileSync('unzip', [
    '-q',
    resolve('.serverless/huntinwabbit-boilerplate.zip'),
    '-d',
    directory,
  ]);
  for (const entry of await readdir(directory, { recursive: true })) {
    assert(
      !entry
        .split('/')
        .some((part) => part === '.env' || part.startsWith('.env.')),
      'Package must not contain environment files.',
    );
  }
  await writeFile(
    join(directory, 'package-smoke.mjs'),
    `
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
process.env.SUPABASE_URL = 'https://auth.example.test';
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'package-test', alg: 'ES256' };
globalThis.fetch = async (url) => {
  assert.equal(String(url), 'https://auth.example.test/auth/v1/.well-known/jwks.json');
  return Response.json({ keys: [jwk] });
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const unsigned = encode({ alg: 'ES256', kid: 'package-test' }) + '.' + encode({
  iss: 'https://auth.example.test/auth/v1', aud: 'authenticated', sub: 'package-test-user',
  role: 'authenticated', is_anonymous: false, exp: Math.floor(Date.now()/1000) + 300,
});
const token = unsigned + '.' + sign('sha256', Buffer.from(unsigned), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const { handler } = await import('./src/lambda.js');
function event(path, headers = {}) {
  return { version: '2.0', routeKey: '$default', rawPath: path, rawQueryString: '', headers,
    requestContext: { http: { method: 'GET', path, sourceIp: '127.0.0.1', protocol: 'HTTP/1.1' } },
    isBase64Encoded: false };
}
assert.equal((await handler(event('/health'), {})).statusCode, 200);
assert.equal((await handler(event('/'), {})).statusCode, 401);
const result = await handler(event('/', { authorization: 'Bearer ' + token }), {});
assert.equal(result.statusCode, 200);
assert.deepEqual(JSON.parse(result.body), { message: 'Hello, world!' });
assert.equal(result.headers['cache-control'], 'no-store');
console.log('Packaged Lambda: health, authentication and hello passed.');
`,
  );
  execFileSync(process.execPath, [join(directory, 'package-smoke.mjs')], {
    cwd: directory,
    stdio: 'inherit',
    timeout: 30000,
  });
} finally {
  await rm(directory, { recursive: true, force: true });
}
