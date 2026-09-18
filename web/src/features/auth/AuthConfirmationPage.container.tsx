import { AuthFrameContainer } from './AuthFrame.container';
import type { AuthSearch } from './AuthPage.container';
import { submitAuth } from './auth.actions';
import { ConfirmFormContainer } from './ConfirmForm.container';

export async function AuthConfirmationPageContainer({
  searchParams,
}: {
  searchParams: AuthSearch;
}) {
  const params = await searchParams;
  const token = typeof params.token_hash === 'string' ? params.token_hash : '';
  const type = typeof params.type === 'string' ? params.type : '';
  return (
    <AuthFrameContainer
      title={type === 'recovery' ? 'Reset your password' : 'Confirm your email'}
      description="Continue to verify this email link. Only continue if you requested it for your account."
    >
      <ConfirmFormContainer
        action={submitAuth.bind(null, 'confirm')}
        token={token}
        type={type}
      />
    </AuthFrameContainer>
  );
}
