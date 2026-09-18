import { describe, expect, it } from 'vitest';
import {
  confirmationInput,
  safeReturnPath,
  textField,
  validateAuth,
} from './auth.validation';

describe('auth input boundaries', () => {
  it.each([
    undefined,
    null,
    [],
    '',
    'https://evil.test/app',
    '//evil.test/app',
    'javascript:alert(1)',
    '/login',
    '/application',
    '/app/../login',
    '/app/%2e%2e/login',
    '/app/%252e%252e/login',
    '/app/%2f../login',
    '/app/%5cevil',
    '/app\\evil',
    '/app bad',
    '/app/%ZZ',
    '/app/%0a',
    '/app\n',
  ])('rejects unsafe return destination %j', (input) => {
    expect(safeReturnPath(input)).toBe('/app');
  });
  it.each([
    '/app',
    '/app/roles/example',
    '/app?view=board',
    '/app/roles/a%20b',
  ])('keeps an application destination %s', (input) => {
    expect(safeReturnPath(input)).toBe(input);
  });
  it('removes fragments', () =>
    expect(safeReturnPath('/app#token')).toBe('/app'));
  it('treats missing and file fields as empty text', () => {
    const form = new FormData();
    expect(textField(form, 'email')).toBe('');
    form.set('email', new Blob(['example']), 'example.txt');
    expect(textField(form, 'email')).toBe('');
  });
  it.each(['', 'bad', 'x@y', 'a @b.test', `${'a'.repeat(245)}@example.test`])(
    'rejects invalid email %s',
    (email) => {
      const form = new FormData();
      form.set('email', email);
      expect(validateAuth('forgot-password', form).errors.email).toBeTruthy();
    },
  );
  it('trims email without modifying passwords and accepts the minimum length', () => {
    const form = new FormData();
    form.set('email', ' a@example.test ');
    form.set('password', ' twelve chars ');
    form.set('confirmPassword', ' twelve chars ');
    expect(validateAuth('signup', form)).toEqual({
      email: 'a@example.test',
      password: ' twelve chars ',
      errors: {},
    });
    form.set('password', '123456789012');
    form.set('confirmPassword', '123456789012');
    expect(validateAuth('signup', form).errors).toEqual({});
  });
  it('requires matching new passwords but accepts existing short passwords at login', () => {
    const form = new FormData();
    form.set('email', 'a@example.test');
    form.set('password', 'short');
    expect(validateAuth('login', form).errors).toEqual({});
    expect(validateAuth('reset-password', form).errors).toEqual({
      password: 'Use at least 12 characters.',
      confirmPassword: 'Passwords must match.',
    });
    form.set('password', '');
    expect(validateAuth('login', form).errors.password).toBeTruthy();
  });
  it.each(['email', 'recovery'])('accepts a valid %s token', (type) => {
    const form = new FormData();
    form.set('token_hash', 'a'.repeat(64));
    form.set('type', type);
    expect(confirmationInput(form)).toEqual({
      token_hash: 'a'.repeat(64),
      type,
    });
  });
  it('accepts opaque provider hashes, including PKCE-prefixed SHA-224 tokens', () => {
    const form = new FormData();
    form.set('type', 'email');
    form.set('token_hash', `pkce_${'a'.repeat(56)}`);
    expect(confirmationInput(form)).not.toBeNull();
    form.set('token_hash', 'a'.repeat(513));
    expect(confirmationInput(form)).toBeNull();
  });
  it.each([
    ['', 'email'],
    ['not a token!', 'email'],
    ['a'.repeat(64), 'invite'],
    ['a'.repeat(64), ''],
  ])('rejects invalid confirmation %s %s', (token, type) => {
    const form = new FormData();
    form.set('token_hash', token);
    form.set('type', type);
    expect(confirmationInput(form)).toBeNull();
  });
});
