import { AuthFrame } from './AuthFrame';
import type { AuthSearch } from './AuthPage';
import { safeReturnPath } from './auth.validation';

export async function AuthUnavailablePage({
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
    <AuthFrame
      title="Unable to connect"
      description="Authentication is temporarily unavailable. Your workspace stays protected. Please try again."
    >
      <a href={retry} className="btn btn-primary min-h-11 w-full">
        Try again
      </a>
    </AuthFrame>
  );
}
