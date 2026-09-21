import { AuthFrameContainer } from './AuthFrame.container';
import type { AuthSearch } from './AuthPage.container';
import { safeReturnPath } from './auth.validation';

export async function AuthUnavailablePageContainer({
  searchParams,
}: {
  searchParams: AuthSearch;
}) {
  const { next } = await searchParams;
  const retry =
    typeof next === 'string' &&
    ['/login', '/signup', '/forgot-password', '/reset-password'].includes(next)
      ? next
      : safeReturnPath(next);
  return (
    <AuthFrameContainer
      title="Unable to connect"
      description="Authentication is temporarily unavailable. Your workspace stays protected. Please try again."
    >
      <a href={retry} className="btn btn-primary min-h-11 w-full">
        Try again
      </a>
    </AuthFrameContainer>
  );
}
