import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authConfig } from './features/auth/auth.index.ts';
import { buildRuntimeApp } from './runtime.ts';

afterEach(() => vi.restoreAllMocks());

describe('runtime configuration', () => {
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
