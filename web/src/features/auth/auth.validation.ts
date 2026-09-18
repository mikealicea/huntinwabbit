import type { AuthField, AuthOperation } from './auth.types';

export function textField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || /[\\\s\p{Cc}]/u.test(value)) return '/app';
  try {
    const url = new URL(value, 'https://app.invalid');
    if (!value.startsWith('/') || url.origin !== 'https://app.invalid')
      return '/app';
    // Decode before checking so encoded traversal cannot escape the application.
    const path = decodeURIComponent(url.pathname);
    if (
      path.includes('%') ||
      /[\\\p{Cc}]/u.test(path) ||
      path.split('/').includes('..')
    )
      return '/app';
    if (path !== '/app' && !path.startsWith('/app/')) return '/app';
    return `${url.pathname}${url.search}`;
  } catch {
    return '/app';
  }
}

export function validateAuth(operation: AuthOperation, form: FormData) {
  const errors: Partial<Record<AuthField, string>> = {};
  const email = textField(form, 'email').trim();
  const password = textField(form, 'password');
  if (['login', 'signup', 'forgot-password', 'resend'].includes(operation)) {
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = 'Enter a valid email address.';
  }
  if (operation === 'login' && !password)
    errors.password = 'Enter your password.';
  if (operation === 'signup' || operation === 'reset-password') {
    if (password.length < 12) errors.password = 'Use at least 12 characters.';
    if (textField(form, 'confirmPassword') !== password)
      errors.confirmPassword = 'Passwords must match.';
  }
  return { email, password, errors };
}

export function confirmationInput(form: FormData) {
  const token_hash = textField(form, 'token_hash');
  const type = textField(form, 'type');
  if (
    !/^[A-Za-z0-9_-]{1,512}$/.test(token_hash) ||
    (type !== 'email' && type !== 'recovery')
  )
    return null;
  return { token_hash, type };
}
