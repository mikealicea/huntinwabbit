import Link from 'next/link';

export function Hello({
  pending,
  message,
  error,
  onRequest,
}: {
  pending: boolean;
  message?: string;
  error?: string;
  onRequest: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm sm:p-8">
      <h1 className="text-3xl font-bold">Hello World</h1>
      <p className="mt-3 text-base-content/75">
        You’re signed in. Try a request to the protected API.
      </p>
      <button
        type="button"
        className="btn btn-primary mt-6"
        disabled={pending}
        onClick={onRequest}
      >
        {pending ? 'Calling API…' : 'Call API'}
      </button>
      <div
        className="mt-5 min-h-12"
        role="status"
        aria-label="API response"
        aria-live="polite"
      >
        {pending ? (
          <p>Waiting for the API…</p>
        ) : error ? (
          <p>{error}</p>
        ) : message ? (
          <p className="font-mono text-lg">{message}</p>
        ) : (
          <p>No request yet.</p>
        )}
      </div>
      {error && (
        <Link className="link mt-3 inline-block" href="/login">
          Log in again
        </Link>
      )}
    </section>
  );
}
