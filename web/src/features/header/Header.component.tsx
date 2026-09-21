import Link from 'next/link';
import type { ReactNode } from 'react';
export function Header({
  themeSwitch,
  actions,
}: {
  themeSwitch: ReactNode;
  actions: ReactNode;
}) {
  return (
    <header className="border-base-300 bg-base-100 border-b">
      <nav
        aria-label="Primary navigation"
        className="navbar mx-auto flex max-w-[1600px] flex-wrap justify-between gap-3 px-4 py-3 sm:px-8"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/app"
            className="flex min-h-11 items-center gap-2 break-all text-lg font-bold tracking-tight"
          >
            huntinwabbit-boilerplate
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {themeSwitch}
          {actions}
        </div>
      </nav>
    </header>
  );
}
