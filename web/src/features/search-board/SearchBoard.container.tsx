'use client';

import { Accessibility } from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { useEffect } from 'react';
import {
  RequestFeedback,
  usePostingsInfiniteQuery,
  useUpdatePostingMutation,
} from '@/features/job-api/job-api.index';
import { JobCaptureContainer } from '@/features/job-capture/job-capture.index';
import {
  mergePostingPages,
  STAGES,
  type Stage,
  toOpportunity,
} from '@/features/job-search/job-search.index';
import { LoadingPulse } from '@/shared/shared.index';
import { BoardColumnContainer } from './BoardColumn.container';
import {
  BoardColumns,
  DragPreview,
  SearchBoard,
} from './SearchBoard.component';
import { boardAccessibility } from './search-board.drag';
export function SearchBoardContainer() {
  const query = usePostingsInfiniteQuery(undefined, { refetchOnFocus: true });
  const [update, mutation] = useUpdatePostingMutation();
  useEffect(() => {
    if (query.hasNextPage && !query.isFetching && !query.isError)
      void query.fetchNextPage();
  }, [query.hasNextPage, query.isFetching, query.isError, query.fetchNextPage]);
  const opportunities = mergePostingPages(query.data?.pages ?? []).map(
    toOpportunity,
  );
  const activeCount = opportunities.filter(
    (role) => role.stage !== 'closed',
  ).length;
  return (
    <>
      <RequestFeedback
        loading={query.isLoading}
        error={query.error ?? mutation.error}
        onRetry={() => {
          mutation.reset();
          void query.refetch();
        }}
      />
      {mutation.isLoading && (
        <p role="status" className="mb-3">
          <LoadingPulse />
          Saving stage…
        </p>
      )}
      <SearchBoard
        complete={!query.isFetching && !query.hasNextPage && !query.isError}
        activeCount={activeCount}
        totalCount={opportunities.length}
        capture={<JobCaptureContainer />}
      >
        <DragDropProvider
          plugins={(defaults) =>
            defaults.map((plugin) =>
              plugin === Accessibility ? boardAccessibility : plugin,
            )
          }
          onDragEnd={async (event) => {
            const id = event.operation.source?.id;
            const target = event.operation.target?.id;
            const role = opportunities.find((item) => item.id === id);
            if (!role) return;
            if (!event.canceled && STAGES.includes(target as Stage)) {
              const stage = target as Stage;
              if (role.saved && !mutation.isLoading)
                await update({
                  id: role.id,
                  expectedApplicationVersion: role.saved.applicationVersion,
                  changes: { stage },
                });
            }
            await query.refetch();
            requestAnimationFrame(() =>
              document.getElementById(`move-${role.id}`)?.focus(),
            );
          }}
        >
          <BoardColumns>
            {STAGES.map((stage) => (
              <BoardColumnContainer
                key={stage}
                stage={stage}
                roles={opportunities.filter((role) => role.stage === stage)}
              />
            ))}
          </BoardColumns>
          <DragOverlay dropAnimation={null}>
            {(source) => <DragPreview label={String(source.data.label)} />}
          </DragOverlay>
        </DragDropProvider>
      </SearchBoard>
    </>
  );
}
