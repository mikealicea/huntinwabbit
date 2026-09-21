import type { ReactNode } from 'react';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="prose prose-headings:text-base-content prose-p:text-base-content prose-a:text-primary max-w-none">
        {children}
      </div>
    </main>
  );
}
