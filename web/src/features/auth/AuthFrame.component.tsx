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
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-lg font-bold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-content"
          >
            h
          </span>
          huntinwabbit
        </Link>
        {themeSwitch}
      </header>
      <main className="mx-auto w-full max-w-md px-5 pb-12 pt-8 sm:pt-16">
        <div className="min-w-0 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-8">
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
