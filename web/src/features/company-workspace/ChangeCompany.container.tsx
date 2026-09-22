'use client';
import { useEffect, useRef, useState } from 'react';
import {
  type CompanySelection,
  RequestFeedback,
  type SavedPosting,
  useCompaniesInfiniteQuery,
  usePostingQuery,
  useSelectCompanyMutation,
} from '@/features/job-api/job-api.index';
import { ChangeCompany } from './ChangeCompany.component';
export function ChangeCompanyContainer({
  posting,
  disabled = false,
}: {
  posting: SavedPosting;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="btn btn-ghost btn-sm btn-square min-h-11 min-w-11 shrink-0"
        aria-label="Change company"
        title="Change company"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
          <path d="m13 6 5 5" />
        </svg>
      </button>
      {open && (
        <CompanyPickerContainer
          posting={posting}
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() => trigger.current?.focus());
          }}
        />
      )}
    </>
  );
}
function CompanyPickerContainer({
  posting,
  onClose,
}: {
  posting: SavedPosting;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [version] = useState(posting.recordVersion);
  const [conflict, setConflict] = useState(false);
  const query = useCompaniesInfiniteQuery(search);
  const [save, mutation] = useSelectCompanyMutation();
  const role = usePostingQuery(posting.id);
  useEffect(() => {
    if (query.hasNextPage && !query.isFetching && !query.isError)
      void query.fetchNextPage();
  }, [query.hasNextPage, query.isFetching, query.isError, query.fetchNextPage]);
  async function submit(selection: CompanySelection['selection']) {
    try {
      await save({
        id: posting.id,
        expectedRecordVersion: version,
        selection,
      }).unwrap();
      return true;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'status' in error &&
        error.status === 409
      )
        setConflict(true);
      await role.refetch();
      return false;
    }
  }
  const companies = [
    ...new Map(
      (query.currentData?.pages ?? [])
        .flatMap((page) => page.items)
        .map((company) => [company.id, company]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <ChangeCompany
      companies={companies}
      conflict={conflict}
      pending={mutation.isLoading}
      complete={
        Boolean(query.currentData) && !query.hasNextPage && !query.isError
      }
      onSearch={setSearch}
      onSave={submit}
      onClose={onClose}
      feedback={
        <RequestFeedback
          loadingMessage="Loading companies…"
          loading={query.isFetching}
          error={mutation.error ?? query.error}
          onRetry={() => {
            mutation.reset();
            if (query.hasNextPage) void query.fetchNextPage();
            else void query.refetch();
          }}
        />
      }
    />
  );
}
