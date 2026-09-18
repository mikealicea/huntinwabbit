'use client';
import { useActionState } from 'react';
import { type AuthAction, initialAuthState } from './auth.types';

export function SignOutButton({ action }: { action: AuthAction }) {
  const [state, dispatch, pending] = useActionState(action, initialAuthState);
  return (
    <form action={dispatch} className="max-w-xs">
      <button
        type="submit"
        disabled={pending}
        className="btn btn-ghost min-h-11"
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
      <p role="status" className="text-sm">
        {state.message}
      </p>
    </form>
  );
}
