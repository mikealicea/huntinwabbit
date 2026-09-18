'use server';

import { redirect } from 'next/navigation';
import { authConfig } from './auth.config';
import { performAuth } from './auth.operations';
import { clearAuthCookies, serverAuthClient } from './auth.session';
import type { AuthOperation, AuthState } from './auth.types';

export async function submitAuth(
  operation: AuthOperation,
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const result = await performAuth(operation, form, {
    client: () => serverAuthClient(true),
    origin: () => authConfig().origin,
    clearSession: clearAuthCookies,
  });
  // Next redirects throw; keep them outside the provider error boundary.
  if (result.redirect) redirect(result.redirect);
  return result.state;
}
