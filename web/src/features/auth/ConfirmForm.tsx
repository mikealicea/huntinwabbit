'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { type AuthAction, initialAuthState } from './auth.types';

export function ConfirmForm({
  action,
  token,
  type,
}: {
  action: AuthAction;
  token: string;
  type: string;
}) {
  const [state, dispatch, pending] = useActionState(action, initialAuthState);
  const recovery = type === 'recovery';
  return (
    <form action={dispatch} className="space-y-5">
      <input type="hidden" name="token_hash" value={token} />
      <input type="hidden" name="type" value={type} />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary min-h-11 w-full"
      >
        {pending
          ? 'Verifying…'
          : recovery
            ? 'Continue to reset password'
            : 'Confirm email'}
      </button>
      <p role="status" className="text-sm">
        {state.message}
      </p>
      <Link
        className="link block text-center text-sm"
        href={recovery ? '/forgot-password' : '/login'}
      >
        Request a new email
      </Link>
    </form>
  );
}
