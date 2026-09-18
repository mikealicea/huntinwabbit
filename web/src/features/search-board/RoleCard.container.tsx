'use client';
import { useDraggable } from '@dnd-kit/react';
import {
  getCompanyLabel,
  getNextAction,
  getRoleTitle,
  type Opportunity,
  selectCompanies,
} from '@/features/job-search/job-search.index';
import { selectToday, useAppSelector } from '@/state/state.index';
import { RoleCard } from './RoleCard.component';

export function RoleCardContainer({ role }: { role: Opportunity }) {
  const companies = useAppSelector(selectCompanies);
  const today = useAppSelector(selectToday);
  const title = getRoleTitle(role);
  const company = getCompanyLabel(role, companies);
  const { ref, handleRef, isDragging } = useDraggable({
    id: role.id,
    data: { label: `${title} at ${company}` },
  });
  return (
    <RoleCard
      role={role}
      title={title}
      company={company}
      next={getNextAction(role, today)}
      isDragging={isDragging}
      cardRef={ref}
      dragHandleRef={handleRef}
    />
  );
}
