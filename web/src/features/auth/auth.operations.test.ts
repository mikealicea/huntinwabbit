import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthClient } from './auth.identity';
import { readIdentity } from './auth.identity';
import { performAuth } from './auth.operations';
import type { AuthOperation } from './auth.types';

const user = { id: 'fictional-user' };
const success = {
  data: { user, session: { access_token: 'fictional' } },
  error: null,
};
const auth = {
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};
const client = { auth } as unknown as AuthClient;
const deps = {
  client: vi.fn(async () => client),
  origin: vi.fn(() => 'http://localhost:3000'),
  clearSession: vi.fn(async () => {}),
};
function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    email: 'fictional@example.test',
    password: 'twelve-chars!',
    confirmPassword: 'twelve-chars!',
    token_hash: 'a'.repeat(64),
    type: 'email',
    ...values,
  }))
    data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  for (const method of Object.values(auth)) method.mockResolvedValue(success);
  deps.client.mockResolvedValue(client);
  deps.origin.mockReturnValue('http://localhost:3000');
  deps.clearSession.mockResolvedValue();
});

describe('verified identity', () => {
  it('uses the provider user lookup', async () =>
    expect(await readIdentity(client)).toEqual({
      status: 'authenticated',
      userId: user.id,
    }));
  it.each([
    { name: 'AuthSessionMissingError' },
    { status: 400 },
    { status: 401 },
    { status: 403 },
  ])('rejects an invalid session %j', async (error) => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error });
    expect(await readIdentity(client)).toEqual({ status: 'anonymous' });
  });
  it.each([null, {}])('rejects absent user identity %j', async (missing) => {
    auth.getUser.mockResolvedValue({ data: { user: missing }, error: null });
    expect(await readIdentity(client)).toEqual({ status: 'anonymous' });
  });
  it('distinguishes an outage from an anonymous session', async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 503 },
    });
    expect(await readIdentity(client)).toEqual({ status: 'unavailable' });
    auth.getUser.mockRejectedValue(new Error('private provider detail'));
    expect(await readIdentity(client)).toEqual({ status: 'unavailable' });
  });
});

describe('auth operations', () => {
  it('stops invalid input before provider calls', async () => {
    expect(
      (await performAuth('signup', form({ email: '', password: '' }), deps))
        .state.errors,
    ).toHaveProperty('email');
    expect(deps.client).not.toHaveBeenCalled();
    expect(
      (await performAuth('confirm', form({ token_hash: '' }), deps)).state
        .message,
    ).toContain('invalid');
    expect(deps.client).not.toHaveBeenCalled();
  });
  it('logs in and validates the return destination', async () => {
    expect(
      (await performAuth('login', form({ next: '/app/roles/example' }), deps))
        .redirect,
    ).toBe('/app/roles/example');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'fictional@example.test',
      password: 'twelve-chars!',
    });
    expect(
      (await performAuth('login', form({ next: '//evil.test' }), deps))
        .redirect,
    ).toBe('/app');
  });
  it.each([
    { user, session: null },
    { user: null, session: {} },
  ])(
    'does not claim login success for incomplete provider data %j',
    async (data) => {
      auth.signInWithPassword.mockResolvedValue({ data, error: null });
      expect((await performAuth('login', form(), deps)).state.status).toBe(
        'error',
      );
    },
  );
  it('sends signup confirmation to configured origin and never signs up straight into the workspace', async () => {
    auth.signUp.mockResolvedValue({
      data: { user, session: null },
      error: null,
    });
    expect((await performAuth('signup', form(), deps)).state.status).toBe(
      'success',
    );
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'fictional@example.test',
      password: 'twelve-chars!',
      options: { emailRedirectTo: 'http://localhost:3000/auth/confirm' },
    });
    expect(deps.clearSession).not.toHaveBeenCalled();
    auth.signUp.mockResolvedValue(success);
    expect(
      (await performAuth('signup', form(), deps)).redirect,
    ).toBeUndefined();
    expect(deps.clearSession).toHaveBeenCalledOnce();
  });
  it.each(['user_already_exists', 'email_exists'])(
    'does not disclose existing signup accounts (%s)',
    async (code) => {
      auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { code },
      });
      expect((await performAuth('signup', form(), deps)).state.status).toBe(
        'success',
      );
    },
  );
  it.each(['resend', 'forgot-password'] as const)(
    'keeps %s responses neutral for existing and missing accounts',
    async (operation) => {
      const method =
        operation === 'resend' ? auth.resend : auth.resetPasswordForEmail;
      const first = await performAuth(operation, form(), deps);
      method.mockResolvedValue({ error: { code: 'user_not_found' } });
      expect(await performAuth(operation, form(), deps)).toEqual(first);
      expect(first.state.status).toBe('success');
      expect(JSON.stringify(method.mock.calls)).toContain(
        'http://localhost:3000/auth/confirm',
      );
    },
  );
  it.each([
    ['email', '/app'],
    ['recovery', '/reset-password'],
  ])('verifies %s before opening %s', async (type, target) => {
    expect((await performAuth('confirm', form({ type }), deps)).redirect).toBe(
      target,
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'a'.repeat(64),
      type,
    });
  });
  it.each([
    { user, session: null },
    { user: null, session: {} },
  ])('rejects confirmation without an issued session %j', async (data) => {
    auth.verifyOtp.mockResolvedValue({ data, error: null });
    expect(
      (await performAuth('confirm', form(), deps)).state.message,
    ).toContain('invalid');
  });
  it('updates a verified user and signs out only that session', async () => {
    expect((await performAuth('reset-password', form(), deps)).redirect).toBe(
      '/login?notice=password-changed',
    );
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'twelve-chars!' });
    expect(auth.getUser.mock.invocationCallOrder[0]).toBeLessThan(
      auth.updateUser.mock.invocationCallOrder[0],
    );
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(deps.clearSession).toHaveBeenCalledOnce();
  });
  it.each([401, 503])(
    'blocks password updates when verification fails (%s)',
    async (status) => {
      auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { status },
      });
      expect(
        (await performAuth('reset-password', form(), deps)).state.status,
      ).toBe('error');
      expect(auth.updateUser).not.toHaveBeenCalled();
    },
  );
  it('does not sign out after an incomplete password update response', async () => {
    auth.updateUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(
      (await performAuth('reset-password', form(), deps)).state.status,
    ).toBe('error');
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it.each(['response', 'throw'])(
    'preserves password-update success after logout %s failure',
    async (kind) => {
      if (kind === 'response')
        auth.signOut.mockResolvedValue({ error: { status: 503 } });
      else auth.signOut.mockRejectedValue(new Error('private details'));
      expect((await performAuth('reset-password', form(), deps)).redirect).toBe(
        '/login?notice=password-changed-signout-incomplete',
      );
      expect(auth.updateUser).toHaveBeenCalledOnce();
      expect(deps.clearSession).toHaveBeenCalledOnce();
    },
  );
  it('preserves password-update success when browser cleanup fails', async () => {
    deps.clearSession.mockRejectedValue(new Error('cookie failure'));
    const result = await performAuth('reset-password', form(), deps);
    expect(result.state.status).toBe('success');
    expect(result.state.message).toContain('password has been changed');
  });
  it.each(['response', 'throw'])(
    'clears browser credentials after signout %s failure',
    async (kind) => {
      if (kind === 'response')
        auth.signOut.mockResolvedValue({ error: { status: 503 } });
      else auth.signOut.mockRejectedValue(new Error('provider unavailable'));
      expect((await performAuth('signout', form(), deps)).redirect).toBe(
        '/login?notice=signout-incomplete',
      );
      expect(deps.clearSession).toHaveBeenCalledOnce();
    },
  );
  it('signs out and clears auth cookies', async () => {
    expect((await performAuth('signout', form(), deps)).redirect).toBe(
      '/login?notice=signed-out',
    );
    expect(deps.clearSession).toHaveBeenCalledOnce();
  });
  it.each([
    ['login', 'signInWithPassword'],
    ['signup', 'signUp'],
    ['resend', 'resend'],
    ['forgot-password', 'resetPasswordForEmail'],
    ['confirm', 'verifyOtp'],
    ['reset-password', 'updateUser'],
  ] as const)(
    'handles %s provider errors and rejected requests',
    async (operation, method) => {
      auth[method].mockResolvedValue({ error: { status: 503 }, data: {} });
      expect(
        (await performAuth(operation, form(), deps)).state.message,
      ).toContain('temporarily unavailable');
      auth[method].mockRejectedValue(new Error('private details'));
      expect(
        (await performAuth(operation, form(), deps)).state.message,
      ).not.toContain('private details');
      expect((await performAuth(operation, form(), deps)).state.status).toBe(
        'error',
      );
    },
  );
  it.each([
    [{ status: 429 }, 'Too many attempts'],
    [{ code: 'over_email_send_rate_limit' }, 'Too many attempts'],
    [{ code: 'over_request_rate_limit' }, 'Too many attempts'],
    [{ code: 'email_not_confirmed' }, 'Confirm your email'],
    [{ code: 'invalid_credentials' }, 'incorrect'],
    [{ code: 'weak_password' }, 'stronger password'],
    [{ code: 'same_password' }, 'different'],
    [{ code: 'reauthentication_needed' }, 'verify your identity again'],
    [{ code: 'reauthentication_not_valid' }, 'verify your identity again'],
  ])('maps provider failure %j safely', async (error, expected) => {
    auth.signInWithPassword.mockResolvedValue({ error });
    expect((await performAuth('login', form(), deps)).state.message).toContain(
      expected,
    );
  });
  it.each([400, 401, 403, 410])(
    'handles invalid, expired or consumed confirmation (%s)',
    async (status) => {
      auth.verifyOtp.mockResolvedValue({
        error: { status, code: 'otp_expired' },
      });
      expect(
        (await performAuth('confirm', form(), deps)).state.message,
      ).toContain('invalid or has expired');
    },
  );
  it('handles confirmation errors without a status', async () => {
    auth.verifyOtp.mockResolvedValue({ error: {} });
    expect(
      (await performAuth('confirm', form(), deps)).state.message,
    ).toContain('unavailable');
  });
  it('handles missing configuration and unknown operations', async () => {
    expect(
      (await performAuth('unknown' as AuthOperation, form(), deps)).state
        .status,
    ).toBe('error');
    deps.client.mockRejectedValue(new Error('secret config details'));
    expect((await performAuth('login', form(), deps)).state.message).toContain(
      'unavailable',
    );
  });
});
