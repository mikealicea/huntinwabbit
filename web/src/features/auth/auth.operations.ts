import type { AuthClient } from './auth.identity';
import { readIdentity } from './auth.identity';
import type { AuthOperation, AuthState } from './auth.types';
import {
  confirmationInput,
  safeReturnPath,
  textField,
  validateAuth,
} from './auth.validation';

type Dependencies = {
  client: () => Promise<AuthClient>;
  origin: () => string;
  clearSession: () => Promise<void>;
};
type Result = { state: AuthState; redirect?: string };
const unavailable =
  'Authentication is temporarily unavailable. Please try again.';
const emailSent =
  'If this address is eligible, you’ll receive an email with the next step. Check your inbox and spam folder.';
const invalidLink =
  'This link is invalid or has expired. Request a new email and try again.';
function failure(message: string): Result {
  return { state: { status: 'error', message } };
}
function destination(redirect: string): Result {
  return { state: { status: 'success', message: '' }, redirect };
}
function providerFailure(
  error: { code?: string; status?: number },
  operation: AuthOperation,
): Result {
  if (
    error.status === 429 ||
    error.code === 'over_email_send_rate_limit' ||
    error.code === 'over_request_rate_limit'
  )
    return failure(
      'Too many attempts. Please wait a few minutes before trying again.',
    );
  if (error.code === 'email_not_confirmed')
    return failure(
      'Confirm your email before logging in. You can resend confirmation below.',
    );
  if (error.code === 'invalid_credentials')
    return failure('Email or password is incorrect.');
  if (error.code === 'weak_password')
    return failure('Choose a stronger password with at least 12 characters.');
  if (error.code === 'same_password')
    return failure('Choose a password different from your current password.');
  if (
    error.code === 'reauthentication_needed' ||
    error.code === 'reauthentication_not_valid'
  )
    return failure(
      'Request a new password reset email to verify your identity again.',
    );
  if (operation === 'confirm' && error.status && error.status < 500)
    return failure(invalidLink);
  return failure(unavailable);
}

export async function performAuth(
  operation: AuthOperation,
  form: FormData,
  deps: Dependencies,
): Promise<Result> {
  const { email, password, errors } = validateAuth(operation, form);
  if (Object.keys(errors).length)
    return {
      state: {
        status: 'error',
        message: 'Check the highlighted fields.',
        errors,
      },
    };
  const confirmation = confirmationInput(form);
  if (operation === 'confirm' && !confirmation) return failure(invalidLink);
  try {
    const client = await deps.client();
    const callback = `${deps.origin()}/auth/confirm`;
    switch (operation) {
      case 'login': {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) return providerFailure(error, operation);
        if (!data.session || !data.user) return failure(unavailable);
        return destination(safeReturnPath(textField(form, 'next')));
      }
      case 'signup': {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callback },
        });
        // Supabase can return an obfuscated user or an already-registered error.
        if (
          error &&
          error.code !== 'user_already_exists' &&
          error.code !== 'email_exists'
        )
          return providerFailure(error, operation);
        if (data.session) await deps.clearSession();
        return { state: { status: 'success', message: emailSent } };
      }
      case 'resend': {
        const { error } = await client.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: callback },
        });
        if (error && error.code !== 'user_not_found')
          return providerFailure(error, operation);
        return { state: { status: 'success', message: emailSent } };
      }
      case 'forgot-password': {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: callback,
        });
        if (error && error.code !== 'user_not_found')
          return providerFailure(error, operation);
        return { state: { status: 'success', message: emailSent } };
      }
      case 'confirm': {
        const verifiedInput = confirmation as NonNullable<typeof confirmation>;
        const { data, error } = await client.auth.verifyOtp(verifiedInput);
        if (error) return providerFailure(error, operation);
        if (!data.session || !data.user) return failure(invalidLink);
        return destination(
          verifiedInput.type === 'recovery' ? '/reset-password' : '/app',
        );
      }
      case 'reset-password': {
        const identity = await readIdentity(client);
        if (identity.status === 'anonymous')
          return failure(
            'Your session has expired. Request a new password reset email.',
          );
        if (identity.status === 'unavailable') return failure(unavailable);
        const { data, error } = await client.auth.updateUser({ password });
        if (error) return providerFailure(error, operation);
        if (!data.user) return failure(unavailable);
        // Updating succeeded. Never report a later logout failure as a failed update.
        let logoutFailed = false;
        try {
          const result = await client.auth.signOut({ scope: 'local' });
          logoutFailed = Boolean(result.error);
        } catch {
          logoutFailed = true;
        }
        try {
          await deps.clearSession();
        } catch {
          return {
            state: {
              status: 'success',
              message:
                'Your password has been changed. Sign out below, then log in with your new password.',
            },
          };
        }
        return destination(
          logoutFailed
            ? '/login?notice=password-changed-signout-incomplete'
            : '/login?notice=password-changed',
        );
      }
      case 'signout': {
        // The SDK removes local credentials even if remote revocation fails.
        let logoutFailed = false;
        try {
          const result = await client.auth.signOut({ scope: 'local' });
          logoutFailed = Boolean(result.error);
        } catch {
          logoutFailed = true;
        }
        await deps.clearSession();
        return destination(
          logoutFailed
            ? '/login?notice=signout-incomplete'
            : '/login?notice=signed-out',
        );
      }
      default:
        return failure('Invalid authentication request.');
    }
  } catch {
    return failure(unavailable);
  }
}
