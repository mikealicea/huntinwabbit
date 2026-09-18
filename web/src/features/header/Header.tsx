import Link from 'next/link';
import { type AuthAction, SignOutButton } from '@/features/auth/auth.index';
import { ThemeSwitch } from '@/features/theme/theme.index';

export function Header({ signOutAction }: { signOutAction: AuthAction }) {
  return (
    <header className="border-base-300 bg-base-100 border-b">
      <nav
        aria-label="Primary navigation"
        className="navbar mx-auto flex max-w-[1600px] flex-wrap justify-between gap-3 px-4 py-3 sm:px-8"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/app"
            className="flex min-h-11 items-center gap-2 text-lg font-bold tracking-tight"
          >
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-content"
            >
              h
            </span>
            huntinwabbit
          </Link>
          <span className="badge badge-outline hidden sm:inline-flex">
            Your job search
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeSwitch />
          <SignOutButton action={signOutAction} />
        </div>
      </nav>
    </header>
  );
}
