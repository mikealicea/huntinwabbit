'use client';
import { useActionState } from 'react';
import { type AuthAction, initialAuthState } from './auth.types';
import { SignOutButton } from './SignOutButton.component';

export function SignOutButtonContainer({ action }: { action: AuthAction }) {
  const [state, dispatch, pending] = useActionState(action, initialAuthState);
  return (
    <SignOutButton
      dispatch={dispatch}
      pending={pending}
      message={state.message}
    />
  );
}
