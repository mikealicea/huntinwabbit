import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthFrame({
  title,
  description,
  children,
  themeSwitch,
}: {
  title: string;
  description: string;
  children: ReactNode;
  themeSwitch: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-base-200">
      <header className="mx-auto flex max-w-6xl justify-end px-5 py-4 sm:px-8">
        {themeSwitch}
      </header>
      <main className="mx-auto w-full max-w-md px-5 pb-12 pt-2 sm:pt-6">
        <div className="min-w-0 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-8">
          <Link
            href="/"
            aria-label="huntinwabbit-boilerplate"
            className="mb-6 block break-words rounded-lg text-lg font-bold"
          >
            huntinwabbit-boilerplate
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mb-7 mt-3 text-sm leading-relaxed text-base-content/75">
            {description}
          </p>
          {children}
        </div>
      </main>
    </div>
  );
}
