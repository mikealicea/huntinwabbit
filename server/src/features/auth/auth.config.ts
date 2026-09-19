export function authConfig(env: Record<string, string | undefined>) {
  const value = env.SUPABASE_URL;
  if (!value) throw new Error('SUPABASE_URL is required.');

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SUPABASE_URL must be an HTTPS origin.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('SUPABASE_URL must be an HTTPS origin.');
  }

  const issuer = `${url.origin}/auth/v1`;
  return { issuer, jwksUrl: new URL(`${issuer}/.well-known/jwks.json`) };
}
