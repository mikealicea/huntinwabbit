'use client';
import { type ReactNode, useRef } from 'react';
import {
  postingApi,
  useCompanyAnalysisInfiniteQuery,
  useRequestCompanyAnalysisMutation,
} from '@/features/job-api/job-api.index';
import { CompanyAnalysis } from './CompanyAnalysis.component';
import { CompanyAnalysisStatus } from './CompanyAnalysisStatus.component';
export function CompanyAnalysisContainer({
  companyId,
  children,
}: {
  companyId: string;
  children?: (slots: { analysis: ReactNode; status: ReactNode }) => ReactNode;
}) {
  const cached =
    postingApi.endpoints.companyAnalysis.useInfiniteQueryState(companyId);
  const status = cached.data?.pages[0]?.status;
  const query = useCompanyAnalysisInfiniteQuery(companyId, {
    refetchOnFocus: true,
    pollingInterval:
      status === 'scheduled' ||
      status === 'processing' ||
      status === 'not-started'
        ? 5000
        : 0,
    skipPollingIfUnfocused: true,
  });
  const [refresh, mutation] = useRequestCompanyAnalysisMutation({
    fixedCacheKey: `company-analysis:${companyId}`,
  });
  const operation = useRef<string | null>(null);
  const first = query.currentData?.pages[0];
  const data = first
    ? {
        ...first,
        items:
          query.currentData?.pages
            .filter(
              (page) =>
                page.generation === first.generation &&
                page.completedAt === first.completedAt,
            )
            .flatMap((page) => page.items) ?? [],
        nextCursor: query.currentData?.pages.at(-1)?.nextCursor ?? null,
      }
    : undefined;
  async function requestRefresh() {
    operation.current ??= crypto.randomUUID();
    try {
      await refresh({
        id: companyId,
        operationId: operation.current,
        intent: 'refresh',
      }).unwrap();
      operation.current = null;
    } catch {
      /* Keep operation ID for explicit acknowledgement recovery. */
    }
  }
  const analysis = (
    <CompanyAnalysis
      data={data}
      pending={mutation.isLoading || query.isFetchingNextPage}
      failed={query.isError || mutation.isError}
      complete={!query.hasNextPage}
      onRefresh={() => void requestRefresh()}
      onRetry={() => {
        if (mutation.isError) void requestRefresh();
        else void query.refetch();
      }}
      onLoadMore={() => void query.fetchNextPage()}
    />
  );
  const header = (
    <CompanyAnalysisStatus
      data={data}
      pending={mutation.isLoading}
      failed={query.isError || mutation.isError}
      onAnalyze={() => void requestRefresh()}
    />
  );
  return children ? (
    children({ analysis, status: header })
  ) : (
    <>
      {header}
      {analysis}
    </>
  );
}
