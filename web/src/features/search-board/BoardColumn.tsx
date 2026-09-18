'use client';

import { useDroppable } from '@dnd-kit/react';
import {
  STAGE_LABELS,
  type Stage,
  selectRolesByStage,
} from '@/features/job-search/job-search.index';
import { useAppSelector } from '@/state/state.index';
import { RoleCard } from './RoleCard';

export function BoardColumn({ stage }: { stage: Stage }) {
  const roles = useAppSelector((state) => selectRolesByStage(state, stage));
  const { ref, isDropTarget } = useDroppable({ id: stage });
  return (
    <section
      ref={ref}
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
          {roles.length}
          <span className="sr-only"> roles</span>
        </span>
      </div>
      <div className="flex min-h-36 flex-col gap-3">
        {roles.length ? (
          roles.map((role) => <RoleCard key={role.id} role={role} />)
        ) : (
          <p className="rounded-xl border border-dashed border-base-content/30 px-4 py-8 text-center text-sm text-base-content/75">
            No roles here yet
          </p>
        )}
      </div>
    </section>
  );
}
