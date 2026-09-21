import type { ReactNode } from 'react';
export interface SearchBoardProps {
  activeCount: number;
  totalCount: number;
  capture: ReactNode;
  children: ReactNode;
  complete?: boolean;
  status?: ReactNode;
}
export function SearchBoard({
  activeCount,
  totalCount,
  capture,
  children,
  complete = true,
  status,
}: SearchBoardProps) {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-base-content/75">
            One step at a time
          </p>
          <h1
            id="search-board-title"
            tabIndex={-1}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Your search
          </h1>
          <p className="mt-3 text-sm text-base-content/75">
            {!complete && 'Loaded so far: '}
            {activeCount} active roles <span aria-hidden="true">·</span>{' '}
            {totalCount - activeCount} closed
          </p>
        </div>
        <div className="ml-auto flex w-full flex-col items-end gap-2 sm:w-auto">
          <div className="flex h-11 w-11 items-center justify-center">
            {status}
          </div>
          <p
            id="board-move-help"
            className="max-w-sm text-sm text-base-content/75"
          >
            Drag a handle to move a role, or open it to change its stage.
          </p>
        </div>
      </div>
      {capture}
      {complete && totalCount === 0 && (
        <div className="alert mb-6 border-base-300 bg-base-100">
          <p>
            Your next opportunity starts with a link. Add one above to begin
            your search.
          </p>
        </div>
      )}
      {children}
    </>
  );
}
export function DragPreview({ label }: { label: string }) {
  return (
    <div className="card max-w-64 border-2 border-primary bg-base-100 p-4 font-semibold shadow-lg">
      {label}
    </div>
  );
}

export function BoardColumns({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-3 xl:grid-cols-6 xl:gap-2">
      {children}
    </div>
  );
}
