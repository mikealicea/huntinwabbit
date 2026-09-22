'use client';
import { useDraggable } from '@dnd-kit/react';
import {
  getCompanyLabel,
  getRoleTitle,
  type Opportunity,
} from '@/features/job-search/job-search.index';
import { SavedRoleCardContainer } from './SavedRoleCard.container';
export function RoleCardContainer({
  role,
  saving = false,
  onDeleted,
}: {
  role: Opportunity;
  saving?: boolean;
  onDeleted: (id: string) => void;
}) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: role.id,
    disabled: saving,
    data: { label: `${getRoleTitle(role)} at ${getCompanyLabel(role, [])}` },
  });
  return (
    <SavedRoleCardContainer
      role={role}
      saving={saving}
      onDeleted={onDeleted}
      drag={{ ref, handleRef, isDragging }}
    />
  );
}
