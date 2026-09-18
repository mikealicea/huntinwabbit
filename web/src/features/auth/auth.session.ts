import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAuthClient } from './auth.client';
import { authConfig, authCookieName } from './auth.config';
import { type AuthIdentity, readIdentity } from './auth.identity';
import { safeReturnPath } from './auth.validation';

export async function serverAuthClient(writable = false) {
  const store = await cookies();
  return createAuthClient({
    getAll: () => store.getAll(),
    setAll: (values) => {
      // Proxy persists refreshes for Server Components; Actions can write directly.
      if (writable)
        for (const { name, value, options } of values)
          store.set(name, value, options);
    },
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  const { secure } = authConfig();
  for (const { name } of store.getAll()) {
    if (
      name === authCookieName ||
      name.startsWith(`${authCookieName}.`) ||
      name.startsWith(`${authCookieName}-`)
    ) {
      store.set(name, '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        sameSite: 'lax',
        secure,
      });
    }
  }
}

export async function serverIdentity(): Promise<AuthIdentity> {
  try {
    return await readIdentity(await serverAuthClient());
  } catch {
    return { status: 'unavailable' };
  }
}

export async function requireUser(next = '/app') {
  const identity = await serverIdentity();
  if (identity.status === 'unavailable')
    redirect(
      `/auth/unavailable?next=${encodeURIComponent(safeReturnPath(next))}`,
    );
  if (identity.status === 'anonymous')
    redirect(`/login?next=${encodeURIComponent(safeReturnPath(next))}`);
  return identity;
}
