import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authConfig } from './features/auth/auth.index.ts';
import { buildRuntimeApp } from './runtime.ts';

afterEach(() => vi.restoreAllMocks());

describe('runtime configuration', () => {
  it('constructs configured storage without contacting AWS and rejects bad table configuration', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const env = {
      SUPABASE_URL: 'https://auth.example.test',
      JOB_POSTINGS_TABLE: 'test-postings',
    };
    const app = buildRuntimeApp(env);
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/job-postings')).status).toBe(401);
    expect(() =>
      buildRuntimeApp({ ...env, JOB_POSTINGS_TABLE: 'invalid table' }),
    ).toThrow(/JOB_POSTINGS_TABLE/);
  });
  it('fails enabled parsing with missing credentials and constructs configured parsing without network calls', async () => {
    const env = {
      SUPABASE_URL: 'https://auth.example.test',
      JOB_PARSING_ENABLED: 'true',
    };
    expect(() => buildRuntimeApp(env)).toThrow(/REDPILL_API_KEY/);
    const http = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('no network'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = buildRuntimeApp({
      ...env,
      REDPILL_API_KEY: 'synthetic-test-key',
    });
    expect((await request(app).get('/health')).status).toBe(200);
    expect(
      (
        await request(app)
          .post('/job-postings/parse')
          .send({ url: 'example.com' })
      ).status,
    ).toBe(401);
    expect(http).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    '',
    'not-a-url',
    'http://auth.example.test',
    'https://user:password@auth.example.test',
    'https://auth.example.test/path',
    'https://auth.example.test?query=value',
    'https://auth.example.test#fragment',
  ])('rejects invalid configuration without echoing its value', (url) => {
    expect(() => buildRuntimeApp({ SUPABASE_URL: url })).toThrow(
      /SUPABASE_URL/,
    );
    try {
      buildRuntimeApp({ SUPABASE_URL: url });
    } catch (error) {
      expect(String(error)).not.toContain('password');
    }
  });

  it('derives trusted issuer and discovery from the configured origin', () => {
    expect(authConfig({ SUPABASE_URL: 'https://auth.example.test/' })).toEqual({
      issuer: 'https://auth.example.test/auth/v1',
      jwksUrl: new URL(
        'https://auth.example.test/auth/v1/.well-known/jwks.json',
      ),
    });
  });

  it('constructs without network calls and requires authentication', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('no network'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = buildRuntimeApp({ SUPABASE_URL: 'https://auth.example.test' });
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/')).status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
