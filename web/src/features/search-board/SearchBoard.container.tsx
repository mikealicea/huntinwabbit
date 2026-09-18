'use client';

import { Accessibility } from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { JobCaptureContainer } from '@/features/job-capture/job-capture.index';
import {
  applicationUpdated,
  STAGES,
  type Stage,
  selectActiveRoleCount,
  selectOpportunities,
} from '@/features/job-search/job-search.index';
import { useAppDispatch, useAppSelector } from '@/state/state.index';
import { BoardColumnContainer } from './BoardColumn.container';
import {
  BoardColumns,
  DragPreview,
  SearchBoard,
} from './SearchBoard.component';
import { boardAccessibility } from './search-board.drag';
export function SearchBoardContainer() {
  const dispatch = useAppDispatch();
  const opportunities = useAppSelector(selectOpportunities);
  const activeCount = useAppSelector(selectActiveRoleCount);
  return (
    <SearchBoard
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
        onDragEnd={(event) => {
          const id = event.operation.source?.id;
          const target = event.operation.target?.id;
          const role = opportunities.find((item) => item.id === id);
          if (!role) return;
          if (!event.canceled && STAGES.includes(target as Stage)) {
            const stage = target as Stage;
            dispatch(
              applicationUpdated({
                id: role.id,
                changes: { stage },
              }),
            );
          }
          requestAnimationFrame(() =>
            document.getElementById(`move-${role.id}`)?.focus(),
          );
        }}
      >
        <BoardColumns>
          {STAGES.map((stage) => (
            <BoardColumnContainer key={stage} stage={stage} />
          ))}
        </BoardColumns>
        <DragOverlay dropAnimation={null}>
          {(source) => <DragPreview label={String(source.data.label)} />}
        </DragOverlay>
      </DragDropProvider>
    </SearchBoard>
  );
}
