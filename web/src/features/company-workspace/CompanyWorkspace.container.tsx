'use client';
import { useEffect, useState } from 'react';
import {
  postingApi,
  RequestFeedback,
  useCompanyQuery,
  useCompanyRolesInfiniteQuery,
} from '@/features/job-api/job-api.index';
import {
  mergePostingPages,
  toOpportunity,
} from '@/features/job-search/job-search.index';
import { SavedRoleCardContainer } from '@/features/search-board/search-board.index';
import { CompanyAnalysisContainer } from './CompanyAnalysis.container';
import {
  CompanyNotFound,
  CompanyWorkspace,
} from './CompanyWorkspace.component';
export function CompanyWorkspaceContainer({
  companyId,
}: {
  companyId: string;
}) {
  const company = useCompanyQuery(companyId, { refetchOnFocus: true });
  const cached =
    postingApi.endpoints.companyRoles.useInfiniteQueryState(companyId);
  const pending = cached.data?.pages.some((page) =>
    page.items.some(
      (item) =>
        ['queued', 'processing'].includes(item.extraction.status) ||
        item.edits?.pending,
    ),
  );
  const roles = useCompanyRolesInfiniteQuery(companyId, {
    skip: !company.currentData,
    refetchOnFocus: true,
    pollingInterval: pending ? 5000 : 0,
    skipPollingIfUnfocused: true,
  });
  const [deleted, setDeleted] = useState<string | null>(null);
  const items = mergePostingPages(roles.currentData?.pages ?? []);
  const deletedVisible = items.some((item) => item.id === deleted);
  useEffect(() => {
    if (roles.hasNextPage && !roles.isFetching && !roles.isError)
      void roles.fetchNextPage();
  }, [roles.hasNextPage, roles.isFetching, roles.isError, roles.fetchNextPage]);
  useEffect(() => {
    if (deleted && !deletedVisible)
      document.getElementById('company-title')?.focus();
  }, [deleted, deletedVisible]);
  if (
    company.error &&
    'status' in company.error &&
    company.error.status === 404
  )
    return <CompanyNotFound />;
  if (!company.currentData)
    return (
      <RequestFeedback
        loading={company.isLoading}
        loadingMessage="Loading company…"
        error={company.error}
        onRetry={() => void company.refetch()}
      />
    );
  return (
    <CompanyWorkspace
      analysis={
        <CompanyAnalysisContainer key={companyId} companyId={companyId} />
      }
      company={company.currentData}
      count={items.length}
      complete={
        Boolean(roles.currentData) && !roles.hasNextPage && !roles.isError
      }
      status={
        <RequestFeedback
          loading={
            roles.isFetching || Boolean(roles.hasNextPage && !roles.isError)
          }
          error={company.error ?? roles.error}
          onRetry={() => {
            void company.refetch();
            if (roles.hasNextPage) void roles.fetchNextPage();
            else void roles.refetch();
          }}
        />
      }
    >
      {items.map((item) => (
        <SavedRoleCardContainer
          key={item.id}
          role={toOpportunity(item)}
          onDeleted={setDeleted}
        />
      ))}
    </CompanyWorkspace>
  );
}
