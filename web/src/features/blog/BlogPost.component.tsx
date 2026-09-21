import Link from 'next/link';
import type { ReactNode } from 'react';
export function BlogPost({
  title,
  date,
  children,
}: {
  title: string;
  date: string;
  children: ReactNode;
}) {
  return (
    <article>
      <nav
        aria-label="Breadcrumb"
        className="text-base-content/70 mb-8 flex items-center gap-2 text-sm"
      >
        <Link href="/blog">Blog</Link>
        <span aria-hidden="true">/</span>
        <span>{title}</span>
      </nav>
      <header>
        <h1>{title}</h1>
        <p className="text-base-content/60 text-sm">{date}</p>
      </header>
      {children}
    </article>
  );
}
