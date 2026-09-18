import 'server-only';
import { type CookieMethodsServer, createServerClient } from '@supabase/ssr';
import { authConfig, authCookieName } from './auth.config';

export function createAuthClient(cookies: CookieMethodsServer) {
  const config = authConfig();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      name: authCookieName,
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secure,
      path: '/',
    },
    cookies,
    // Provider errors are mapped to safe UI states; SDK retry diagnostics can include payloads.
    auth: { debug: false },
  });
}
