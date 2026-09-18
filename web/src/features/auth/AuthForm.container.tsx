'use client';
import { useActionState } from 'react';
import { AuthForm } from './AuthForm.component';
import { type AuthAction, type AuthMode, initialAuthState } from './auth.types';
import { SignOutButtonContainer } from './SignOutButton.container';
export function AuthFormContainer({
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
  return (
    <AuthForm
      mode={mode}
      state={state}
      dispatch={dispatch}
      pending={pending}
      resendState={resendState}
      resendDispatch={resendDispatch}
      resending={resending}
      next={next}
      notice={notice}
      signOut={
        state.status === 'success' && mode === 'reset-password' ? (
          <SignOutButtonContainer action={signOutAction} />
        ) : null
      }
    />
  );
}
