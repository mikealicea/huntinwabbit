import { AuthFrame } from './AuthFrame';
import type { AuthSearch } from './AuthPage';
import { submitAuth } from './auth.actions';
import { ConfirmForm } from './ConfirmForm';

export async function AuthConfirmationPage({
  searchParams,
}: {
  searchParams: AuthSearch;
}) {
  const params = await searchParams;
  const token = typeof params.token_hash === 'string' ? params.token_hash : '';
  const type = typeof params.type === 'string' ? params.type : '';
  return (
    <AuthFrame
      title={type === 'recovery' ? 'Reset your password' : 'Confirm your email'}
      description="Continue to verify this email link. Only continue if you requested it for your account."
    >
      <ConfirmForm
        action={submitAuth.bind(null, 'confirm')}
        token={token}
        type={type}
      />
    </AuthFrame>
  );
}
