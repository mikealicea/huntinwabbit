'use client';

import { Accessibility } from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { JobCapture } from '@/features/job-capture/job-capture.index';
import {
  STAGES,
  type Stage,
  useJobSearch,
} from '@/features/job-search/job-search.index';
import { BoardColumn } from './BoardColumn';
import { boardAccessibility } from './search-board.drag';

export function SearchBoard() {
  const { state, dispatch } = useJobSearch();
  const activeCount = state.opportunities.filter(
    (role) => role.stage !== 'closed',
  ).length;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-base-content/75">
            One step at a time
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Your search
          </h1>
          <p className="mt-3 text-sm text-base-content/75">
            {activeCount} active roles <span aria-hidden="true">·</span>{' '}
            {state.opportunities.length - activeCount} closed
          </p>
        </div>
        <p
          id="board-move-help"
          className="max-w-sm text-sm text-base-content/75"
        >
          Drag a handle to move a role, or open it to change its stage.
        </p>
      </div>
      <JobCapture />
      {state.opportunities.length === 0 && (
        <div className="alert mb-6 border-base-300 bg-base-100">
          <p>
            Your next opportunity starts with a link. Add one above to begin
            your search.
          </p>
        </div>
      )}
      <DragDropProvider
        plugins={(defaults) =>
          defaults.map((plugin) =>
            plugin === Accessibility ? boardAccessibility : plugin,
          )
        }
        onDragEnd={(event) => {
          const id = event.operation.source?.id;
          const target = event.operation.target?.id;
          const role = state.opportunities.find((item) => item.id === id);
          if (!role) return;
          if (!event.canceled && STAGES.includes(target as Stage)) {
            const stage = target as Stage;
            dispatch({
              type: 'update-application',
              id: role.id,
              changes: { stage },
            });
          }
          requestAnimationFrame(() =>
            document.getElementById(`move-${role.id}`)?.focus(),
          );
        }}
      >
        <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-3 xl:grid-cols-6 xl:gap-2">
          {STAGES.map((stage) => (
            <BoardColumn
              key={stage}
              stage={stage}
              roles={state.opportunities.filter((role) => role.stage === stage)}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {(source) => (
            <div className="card max-w-64 border-2 border-primary bg-base-100 p-4 font-semibold shadow-lg">
              {String(source.data.label)}
            </div>
          )}
        </DragOverlay>
      </DragDropProvider>
    </>
  );
}
