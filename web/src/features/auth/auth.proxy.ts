import type { CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from './auth.client';
import { authConfig } from './auth.config';
import { readIdentity } from './auth.identity';
import { safeReturnPath } from './auth.validation';

export async function refreshAuth(request: NextRequest) {
  let response = NextResponse.next({ request });
  const writes = new Map<
    string,
    { name: string; value: string; options: CookieOptions }
  >();
  let destination: string | undefined;
  let origin = request.nextUrl.origin;
  try {
    origin = authConfig().origin;
    const client = createAuthClient({
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) {
          request.cookies.set(name, value);
          writes.set(name, { name, value, options });
        }
        response = NextResponse.next({ request });
      },
    });
    const identity = await readIdentity(client);
    const path = request.nextUrl.pathname;
    if (identity.status === 'unavailable')
      destination = `/auth/unavailable?next=${encodeURIComponent(path)}`;
    else if (
      (path === '/app' || path.startsWith('/app/')) &&
      identity.status === 'anonymous'
    ) {
      destination = `/login?next=${encodeURIComponent(safeReturnPath(`${path}${request.nextUrl.search}`))}`;
    }
  } catch {
    destination = `/auth/unavailable?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  }
  // Next can normalize loopback request URLs. Use the deployment's configured
  // origin for absolute redirects so the SDK cookies retain their intended scope.
  if (destination)
    response = NextResponse.redirect(new URL(destination, origin));
  for (const { name, value, options } of writes.values())
    response.cookies.set(name, value, options);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
