import 'server-only';

export function authConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, APP_ORIGIN } = env;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !APP_ORIGIN)
    throw new Error('Authentication configuration is incomplete.');
  const origin = new URL(APP_ORIGIN);
  const supabase = new URL(SUPABASE_URL);
  for (const url of [origin, supabase]) {
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error(
        'Authentication URLs must be HTTPS origins, or local HTTP origins.',
      );
  }
  if (!SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'))
    throw new Error('Use a Supabase publishable key.');
  return {
    url: supabase.origin,
    key: SUPABASE_PUBLISHABLE_KEY,
    origin: origin.origin,
    secure: origin.protocol === 'https:',
  };
}

export const authCookieName = 'huntinwabbit-boilerplate-auth';
