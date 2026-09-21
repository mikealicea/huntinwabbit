import Link from 'next/link';
import { PageShell } from '@/shared/shared.index';

export function HomePage() {
  return (
    <PageShell>
      <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">
        huntinwabbit-boilerplate
      </h1>
      <p className="mt-4 text-lg">
        A starting point for your next application.
      </p>
      <p className="mt-3 text-base-content/75">
        Sign in to try the authenticated Hello World API.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className="btn btn-primary">
          Log in
        </Link>
        <Link href="/signup" className="btn btn-outline">
          Create account
        </Link>
      </div>
    </PageShell>
  );
}
