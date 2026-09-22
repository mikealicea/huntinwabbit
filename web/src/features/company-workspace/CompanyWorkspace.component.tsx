import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SavedCompany } from '@/features/job-api/job-api.index';
export function CompanyWorkspace({
  company,
  count,
  complete,
  status,
  analysis,
  analysisStatus,
  children,
}: {
  company: SavedCompany;
  count: number;
  complete: boolean;
  status: ReactNode;
  analysis?: ReactNode;
  analysisStatus?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/app" className="btn btn-ghost -ml-3 mb-5 min-h-11">
        <span aria-hidden="true">←</span> Search board
      </Link>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-base-300 pb-7">
        <div className="min-w-0 max-w-full">
          <p className="mb-2 text-sm font-medium text-base-content/65">
            Company
          </p>
          <h1
            id="company-title"
            tabIndex={-1}
            className="break-words text-3xl font-bold tracking-tight sm:text-4xl"
          >
            {company.name}
          </h1>
        </div>
        <div className="ml-auto">{analysisStatus}</div>
      </header>
      {analysis}
      <section aria-labelledby="company-roles-title">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="company-roles-title" className="text-xl font-semibold">
            Your roles
          </h2>
          <p className="text-sm text-base-content/70">
            {count} {count === 1 ? 'role' : 'roles'}
            {complete ? '' : ' loaded'}
          </p>
        </div>
        {status}
        {complete && count === 0 && (
          <div className="rounded-box border border-dashed border-base-300 p-8 text-center">
            <p className="font-medium">No roles at this company yet.</p>
            <p className="mt-2 text-sm text-base-content/70">
              Choose this company from a saved role’s Change company control.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      </section>
    </div>
  );
}
export function CompanyNotFound() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Company not found</h1>
      <p className="my-4">This company is not available in your workspace.</p>
      <Link href="/app" className="btn min-h-11">
        Search board
      </Link>
    </div>
  );
}
