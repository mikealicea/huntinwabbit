'use client';

import { Accessibility } from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { useEffect, useState } from 'react';
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
import { BoardColumnContainer } from './BoardColumn.container';
import { BoardStatus } from './BoardStatus.component';
import {
  BoardColumns,
  DragPreview,
  SearchBoard,
} from './SearchBoard.component';
import { boardAccessibility } from './search-board.drag';
export function SearchBoardContainer() {
  const query = usePostingsInfiniteQuery(undefined, { refetchOnFocus: true });
  const [update, mutation] = useUpdatePostingMutation();
  const [deletedRoleId, setDeletedRoleId] = useState<string | null>(null);
  useEffect(() => {
    if (query.hasNextPage && !query.isFetching && !query.isError)
      void query.fetchNextPage();
  }, [query.hasNextPage, query.isFetching, query.isError, query.fetchNextPage]);
  const opportunities = mergePostingPages(query.data?.pages ?? []).map(
    toOpportunity,
  );
  const deletedStillVisible = opportunities.some(
    (role) => role.id === deletedRoleId,
  );
  useEffect(() => {
    // The board survives the deleted card and runs after its modal is removed.
    if (deletedRoleId && !deletedStillVisible)
      document.getElementById('search-board-title')?.focus();
  }, [deletedRoleId, deletedStillVisible]);
  const activeCount = opportunities.filter(
    (role) => role.stage !== 'closed',
  ).length;
  return (
    <SearchBoard
      complete={Boolean(query.data) && !query.hasNextPage && !query.isError}
      status={
        <BoardStatus
          busy={
            query.isFetching ||
            mutation.isLoading ||
            Boolean(query.hasNextPage && !query.isError)
          }
          message={
            mutation.isLoading ? 'Saving stage…' : 'Loading your saved roles…'
          }
          failed={Boolean(query.error ?? mutation.error)}
          feedback={
            <RequestFeedback
              error={query.error ?? mutation.error}
              onRetry={() => {
                mutation.reset();
                void query.refetch();
              }}
            />
          }
        />
      }
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
              saving={mutation.isLoading}
              onDeleted={setDeletedRoleId}
              roles={opportunities.filter((role) => role.stage === stage)}
            />
          ))}
        </BoardColumns>
        <DragOverlay dropAnimation={null}>
          {(source) => <DragPreview label={String(source.data.label)} />}
        </DragOverlay>
      </DragDropProvider>
    </SearchBoard>
  );
}
