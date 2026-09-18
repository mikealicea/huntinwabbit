import type { ReactNode, Ref } from 'react';
import {
  STAGE_LABELS,
  type Stage,
} from '@/features/job-search/job-search.index';
export interface BoardColumnProps {
  stage: Stage;
  roleCount: number;
  isDropTarget: boolean;
  dropRef: Ref<HTMLElement>;
  children: ReactNode;
}
export function BoardColumn({
  stage,
  roleCount,
  isDropTarget,
  dropRef,
  children,
}: BoardColumnProps) {
  return (
    <section
      ref={dropRef}
      aria-label={STAGE_LABELS[stage]}
      className={`min-w-0 rounded-xl border p-2 ${isDropTarget ? 'border-primary bg-primary/10 ring-2 ring-primary' : 'border-transparent'}`}
    >
      <div className="mb-4 flex items-center justify-between gap-2 px-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${stage === 'closed' ? 'bg-base-content/40' : stage === 'offer' ? 'bg-success' : 'bg-primary'}`}
          />
          {STAGE_LABELS[stage]}
        </h2>
        <span className="badge badge-sm border-base-300 bg-base-100">
          {roleCount}
          <span className="sr-only"> roles</span>
        </span>
      </div>
      <div className="flex min-h-36 flex-col gap-3">
        {roleCount ? (
          children
        ) : (
          <p className="rounded-xl border border-dashed border-base-content/30 px-4 py-8 text-center text-sm text-base-content/75">
            No roles here yet
          </p>
        )}
      </div>
    </section>
  );
}
