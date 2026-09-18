import Link from 'next/link';

export function HomePage() {
  return (
    <main className="flex min-h-screen items-start justify-end p-6">
      <h1 className="sr-only">huntinwabbit</h1>
      <Link href="/app" className="btn btn-primary min-h-11">
        Open app
      </Link>
    </main>
  );
}
