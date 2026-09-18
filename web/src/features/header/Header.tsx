import Link from 'next/link';
import { ThemeSwitch } from '@/features/theme/theme.index';

export function Header() {
  return (
    <header className="border-base-300 bg-base-100/80 sticky top-0 z-10 border-b backdrop-blur-sm">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3"
      >
        <div className="flex items-center gap-5">
          <Link href="/" className="link link-hover">
            Home
          </Link>
          <Link href="/blog" className="link link-hover">
            Blog
          </Link>
        </div>
        <ThemeSwitch />
      </nav>
    </header>
  );
}
