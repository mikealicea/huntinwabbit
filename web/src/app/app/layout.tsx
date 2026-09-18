import type { ReactNode } from 'react';
import { requireUser, submitAuth } from '@/features/auth/auth.server.index';
import { Header } from '@/features/header/header.index';
import { StoreProvider } from '@/state/state.index';

export default async function ApplicationLayout({
  children,
}: {
  children: ReactNode;
}) {
  const identity = await requireUser();
  return (
    <StoreProvider key={identity.userId}>
      <div className="min-h-screen bg-base-200">
        <a
          href="#app-content"
          className="btn btn-primary fixed left-4 top-4 z-50 -translate-y-24 focus:translate-y-0"
        >
          Skip to content
        </a>
        <Header signOutAction={submitAuth.bind(null, 'signout')} />
        <main
          id="app-content"
          className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8 sm:py-10"
        >
          <p className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/75">
            <span className="badge badge-outline badge-sm font-medium">
              Sample workspace
            </span>{' '}
            Fictional data. Edits reset when you reload or leave the app.
          </p>
          {children}
        </main>
      </div>
    </StoreProvider>
  );
}
