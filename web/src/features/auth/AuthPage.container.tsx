import { redirect } from 'next/navigation';
import { AuthFormContainer } from './AuthForm.container';
import { AuthFrameContainer } from './AuthFrame.container';
import { submitAuth } from './auth.actions';
import { serverIdentity } from './auth.session';
import type { AuthMode } from './auth.types';
import { safeReturnPath } from './auth.validation';

const copy: Record<AuthMode, { title: string; description: string }> = {
  login: {
    title: 'Welcome back',
    description: 'Log in to your job-search workspace.',
  },
  signup: {
    title: 'Create your account',
    description:
      'One place to keep track of your job search. Confirm your email to get started.',
  },
  'forgot-password': {
    title: 'Forgot your password?',
    description:
      'Enter your email and we’ll send you a link to choose a new password.',
  },
  'reset-password': {
    title: 'Choose a new password',
    description: 'After saving your password, log in again to continue.',
  },
};
const notices: Record<string, string> = {
  'password-changed':
    'Your password has been changed. Log in with your new password.',
  'password-changed-signout-incomplete':
    'Your password has been changed and this browser has been signed out. We could not confirm session revocation. Log in with your new password.',
  'signed-out': 'You have been signed out.',
  'signout-incomplete':
    'This browser has been signed out. We could not confirm session revocation with the authentication service.',
};
export type AuthSearch = Promise<Record<string, string | string[] | undefined>>;

export async function AuthPageContainer({
  mode,
  searchParams,
}: {
  mode: AuthMode;
  searchParams: AuthSearch;
}) {
  const params = await searchParams;
  const identity = await serverIdentity();
  if (identity.status === 'unavailable')
    redirect(`/auth/unavailable?next=/${mode}`);
  if (
    (mode === 'login' || mode === 'signup') &&
    identity.status === 'authenticated'
  )
    redirect(safeReturnPath(params.next));
  if (mode === 'reset-password' && identity.status === 'anonymous') {
    return (
      <AuthFrameContainer
        title="Request a new reset link"
        description="Your session is missing or has expired. Request another email to reset your password."
      >
        <AuthFormContainer
          mode="forgot-password"
          action={submitAuth.bind(null, 'forgot-password')}
          resendAction={submitAuth.bind(null, 'resend')}
          signOutAction={submitAuth.bind(null, 'signout')}
        />
      </AuthFrameContainer>
    );
  }
  const notice =
    typeof params.notice === 'string' ? notices[params.notice] : undefined;
  return (
    <AuthFrameContainer {...copy[mode]}>
      <AuthFormContainer
        mode={mode}
        action={submitAuth.bind(null, mode)}
        resendAction={submitAuth.bind(null, 'resend')}
        signOutAction={submitAuth.bind(null, 'signout')}
        next={safeReturnPath(params.next)}
        notice={notice}
      />
    </AuthFrameContainer>
  );
}
