import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// No AWS invocation or provider calls: the container has networking disabled.
const directory = await mkdtemp(join(tmpdir(), 'huntinwabbit-package-'));
try {
  execFileSync('unzip', [
    '-q',
    resolve('.serverless/huntinwabbit.zip'),
    '-d',
    directory,
  ]);
  await access(
    join(
      directory,
      'node_modules/@httpcloak/linux-x64/libhttpcloak-linux-amd64.so',
    ),
  );
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
const { default: httpcloak } = await import('httpcloak');
const nativeSession = new httpcloak.Session({ preset: 'chrome-143' });
nativeSession.close();
process.env.SUPABASE_URL = 'https://auth.example.test';
process.env.JOB_PARSING_ENABLED = 'true';
process.env.REDPILL_API_KEY = 'synthetic-package-test-key';
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
const event = {
  version: '2.0', routeKey: '$default', rawPath: '/job-postings/parse', rawQueryString: '',
  headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
  requestContext: { http: { method: 'POST', path: '/job-postings/parse', sourceIp: '127.0.0.1', protocol: 'HTTP/1.1' } },
  isBase64Encoded: false, body: JSON.stringify({ url: 'http://127.0.0.1/job' }),
};
const result = await handler(event, {});
assert.equal(result.statusCode, 422);
assert.equal(JSON.parse(result.body).code, 'SOURCE_UNAVAILABLE');
const unauthenticated = await handler({ ...event, headers: { 'content-type': 'application/json' } }, {});
assert.equal(unauthenticated.statusCode, 401);
console.log('Linux Lambda package: authentication, parser route, IPC, and native agent-fetch passed.');
`,
  );
  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '--platform',
      'linux/amd64',
      '--network',
      'none',
      '--mount',
      `type=bind,source=${directory},target=/var/task,readonly`,
      '-w',
      '/var/task',
      '--entrypoint',
      '/var/lang/bin/node',
      'public.ecr.aws/lambda/nodejs:24',
      'package-smoke.mjs',
    ],
    { stdio: 'inherit', timeout: 300_000 },
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
