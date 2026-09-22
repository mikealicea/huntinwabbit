import Link from 'next/link';
import { LoadingPulse } from '@/shared/shared.index';
export function RequestFeedback({
  loading,
  loadingMessage = 'Loading your saved roles…',
  error,
  onRetry,
  children,
}: {
  loading?: boolean;
  loadingMessage?: string;
  error?: unknown;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? error.status
      : undefined;
  return (
    <div className="mb-4 space-y-2">
      {loading && (
        <p role="status">
          <LoadingPulse />
          {loadingMessage}
        </p>
      )}
      {Boolean(error) && (
        <div role="alert" className="alert border-base-300 bg-base-100">
          <p>
            {status === 401
              ? 'Your session expired. Sign in again to continue.'
              : status === 409
                ? 'This role changed elsewhere. Your draft is retained. Review the refreshed role before saving again.'
                : 'We could not complete that request. Your saved roles have not been discarded.'}
          </p>
          {status === 401 ? (
            <Link href="/login?next=/app" className="link">
              Sign in
            </Link>
          ) : (
            onRetry && (
              <button type="button" className="btn" onClick={onRetry}>
                Try again
              </button>
            )
          )}
        </div>
      )}
      {children}
    </div>
  );
}
