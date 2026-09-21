import { readFileSync } from 'node:fs';

import { authConfig } from '../src/features/auth/auth.index.ts';

function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Live E2E requires ${name}; see .env.e2e.example.`);
  }
  return value;
}

export function liveConfiguration() {
  const env = process.env;
  const apiUrl = required(env.E2E_API_URL, 'E2E_API_URL');
  let api: URL;
  try {
    api = new URL(apiUrl);
  } catch {
    throw new Error('E2E_API_URL must be an HTTP(S) origin.');
  }
  if (
    api.username ||
    api.password ||
    api.pathname !== '/' ||
    api.search ||
    api.hash ||
    (api.protocol !== 'https:' &&
      !(
        api.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)
      ))
  ) {
    throw new Error(
      'E2E_API_URL must be an HTTPS origin or loopback HTTP origin.',
    );
  }
  const auth = authConfig(env);
  const publishableKey = required(
    env.SUPABASE_PUBLISHABLE_KEY,
    'SUPABASE_PUBLISHABLE_KEY',
  );
  if (!publishableKey.startsWith('sb_publishable_')) {
    throw new Error('Live E2E requires a publishable key, never an admin key.');
  }

  let account: Record<string, unknown>;
  if (env.E2E_EMAIL !== undefined || env.E2E_PASSWORD !== undefined) {
    account = { email: env.E2E_EMAIL, password: env.E2E_PASSWORD };
  } else {
    try {
      const parsed: unknown = JSON.parse(
        readFileSync(env.E2E_ACCOUNT_FILE ?? '../.env.codex-dev.json', 'utf8'),
      );
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid account file');
      }
      account = parsed as Record<string, unknown>;
    } catch {
      throw new Error('Cannot read the dedicated E2E account file.');
    }
  }
  return {
    api: api.origin,
    issuer: auth.issuer,
    publishableKey,
    email: required(account.email, 'E2E_EMAIL or account email'),
    password: required(account.password, 'E2E_PASSWORD or account password'),
  };
}

// Never surface provider errors or fetch causes: they may contain credentials or URLs.
export async function liveRequest(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('Live request failed, timed out, or attempted a redirect.');
  }
}

export async function responseObject(
  response: Response,
): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Response bodies are deliberately omitted from test failures.
  }
  throw new Error('Live endpoint did not return a JSON object.');
}
