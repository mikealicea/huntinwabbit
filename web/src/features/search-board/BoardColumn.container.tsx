'use client';
import { useDroppable } from '@dnd-kit/react';
import {
  type Stage,
  selectRolesByStage,
} from '@/features/job-search/job-search.index';
import { useAppSelector } from '@/state/state.index';
import { BoardColumn } from './BoardColumn.component';
import { RoleCardContainer } from './RoleCard.container';
export function BoardColumnContainer({ stage }: { stage: Stage }) {
  const roles = useAppSelector((state) => selectRolesByStage(state, stage));
  const { ref, isDropTarget } = useDroppable({ id: stage });
  return (
    <BoardColumn
      stage={stage}
      roleCount={roles.length}
      isDropTarget={isDropTarget}
      dropRef={ref}
    >
      {roles.map((role) => (
        <RoleCardContainer key={role.id} role={role} />
      ))}
    </BoardColumn>
  );
}
