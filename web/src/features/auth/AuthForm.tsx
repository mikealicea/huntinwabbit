'use client';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import type { AuthAction, AuthMode } from './auth.types';
import { initialAuthState } from './auth.types';
import { PasswordField } from './PasswordField';
import { SignOutButton } from './SignOutButton';

const labels: Record<AuthMode, string> = {
  login: 'Log in',
  signup: 'Create account',
  'forgot-password': 'Send reset email',
  'reset-password': 'Save new password',
};

export function AuthForm({
  mode,
  action,
  resendAction,
  signOutAction,
  next = '/app',
  notice = '',
}: {
  mode: AuthMode;
  action: AuthAction;
  resendAction: AuthAction;
  signOutAction: AuthAction;
  next?: string;
  notice?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, initialAuthState);
  const [resendState, resendDispatch, resending] = useActionState(
    resendAction,
    initialAuthState,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const success = state.status === 'success';
  const hasEmail = mode !== 'reset-password';
  const hasPassword = mode !== 'forgot-password';
  const newPassword = mode === 'signup' || mode === 'reset-password';
  useEffect(() => {
    if (state.status === 'error')
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    if (state.status === 'success') {
      setPassword('');
      setConfirmation('');
    }
  }, [state]);
  return (
    <>
      {notice && (
        <p role="status" className="mb-5 rounded-lg bg-base-200 p-3 text-sm">
          {notice}
        </p>
      )}
      <form ref={formRef} action={dispatch} noValidate className="space-y-5">
        <input type="hidden" name="next" value={next} />
        <fieldset disabled={pending || resending} className="min-w-0 space-y-5">
          {hasEmail && (
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(state.errors?.email)}
                aria-describedby={
                  state.errors?.email ? 'email-error' : undefined
                }
                className={`input w-full ${state.errors?.email ? 'input-error' : ''}`}
              />
              {state.errors?.email && (
                <p id="email-error" className="mt-2 text-sm">
                  {state.errors.email}
                </p>
              )}
            </div>
          )}
          {hasPassword && !success && (
            <PasswordField
              name="password"
              label={newPassword ? 'New password' : 'Password'}
              autoComplete={newPassword ? 'new-password' : 'current-password'}
              value={password}
              onChange={setPassword}
              error={state.errors?.password}
            />
          )}
          {newPassword && !success && (
            <>
              <p className="text-sm text-base-content/75">
                Use at least 12 characters.
              </p>
              <PasswordField
                name="confirmPassword"
                label="Confirm password"
                autoComplete="new-password"
                value={confirmation}
                onChange={setConfirmation}
                error={state.errors?.confirmPassword}
              />
            </>
          )}
          {(!success || mode === 'forgot-password') && (
            <button className="btn btn-primary min-h-11 w-full" type="submit">
              {pending ? 'Please wait…' : labels[mode]}
            </button>
          )}
        </fieldset>
        <p role="status" aria-live="polite" className="text-sm">
          {pending ? 'Submitting…' : state.message}
        </p>
      </form>
      {success && mode === 'reset-password' && (
        <SignOutButton action={signOutAction} />
      )}
      {success && mode === 'signup' && (
        <a className="link mt-4 block text-center text-sm" href="/signup">
          Use another email address
        </a>
      )}
      {(mode === 'login' || mode === 'signup') && (
        <form action={resendDispatch} className="mt-4 space-y-3" noValidate>
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={pending || resending}
            className="btn btn-ghost h-auto min-h-11 w-full whitespace-normal py-2"
          >
            {resending ? 'Sending…' : 'Resend confirmation email'}
          </button>
          <p role="status" className="text-sm">
            {resendState.message}
            {resendState.errors?.email && ' Enter your email above first.'}
          </p>
        </form>
      )}
      <nav
        aria-label="Account options"
        className="mt-6 flex flex-col items-center gap-3 text-sm"
      >
        {mode === 'login' ? (
          <>
            <Link className="link min-h-6" href="/forgot-password">
              Forgot password?
            </Link>
            <Link className="link min-h-6" href="/signup">
              Create an account
            </Link>
          </>
        ) : (
          <Link className="link min-h-6" href="/login">
            Back to log in
          </Link>
        )}
        {mode === 'reset-password' && (
          <Link className="link min-h-6" href="/forgot-password">
            Request a new reset email
          </Link>
        )}
      </nav>
    </>
  );
}
