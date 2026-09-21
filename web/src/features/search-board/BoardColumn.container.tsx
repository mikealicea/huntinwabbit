'use client';
import { useDroppable } from '@dnd-kit/react';
import type {
  Opportunity,
  Stage,
} from '@/features/job-search/job-search.index';
import { BoardColumn } from './BoardColumn.component';
import { RoleCardContainer } from './RoleCard.container';
export function BoardColumnContainer({
  stage,
  roles,
  saving = false,
}: {
  saving?: boolean;
  stage: Stage;
  roles: Opportunity[];
}) {
  const { ref, isDropTarget } = useDroppable({ id: stage });
  return (
    <BoardColumn
      stage={stage}
      roleCount={roles.length}
      isDropTarget={isDropTarget}
      dropRef={ref}
    >
      {roles.map((role) => (
        <RoleCardContainer key={role.id} role={role} saving={saving} />
      ))}
    </BoardColumn>
  );
}
