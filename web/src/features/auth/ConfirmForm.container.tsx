'use client';
import { useActionState } from 'react';
import { type AuthAction, initialAuthState } from './auth.types';
import { ConfirmForm } from './ConfirmForm.component';

export function ConfirmFormContainer({
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
    <ConfirmForm
      dispatch={dispatch}
      pending={pending}
      message={state.message}
      token={token}
      type={type}
      isRecovery={recovery}
    />
  );
}
