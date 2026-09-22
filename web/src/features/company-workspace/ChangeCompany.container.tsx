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
    <div className="mb-3">
      <button
        type="button"
        ref={trigger}
        className="btn btn-ghost btn-sm min-h-11 -ml-3"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Change company
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
    </div>
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
