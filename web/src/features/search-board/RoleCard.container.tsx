'use client';
import { useDraggable } from '@dnd-kit/react';
import { postingApi, usePostingQuery } from '@/features/job-api/job-api.index';
import {
  getCompanyLabel,
  getNextAction,
  getRoleTitle,
  type Opportunity,
  toOpportunity,
} from '@/features/job-search/job-search.index';
import { selectToday, useAppSelector } from '@/state/state.index';
import { RoleCard } from './RoleCard.component';

export function RoleCardContainer({ role: initial }: { role: Opportunity }) {
  const pending = ['queued', 'processing'].includes(
    initial.saved?.extraction.status ?? '',
  );
  const cached = postingApi.endpoints.posting.useQueryState(initial.id);
  const stillPending =
    !cached.data ||
    ['queued', 'processing'].includes(cached.data.extraction.status);
  const { data } = usePostingQuery(initial.id, {
    skip: !pending,
    pollingInterval: stillPending ? 5000 : 0,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });
  const role =
    data && data.recordVersion >= (initial.saved?.recordVersion ?? 0)
      ? toOpportunity(data)
      : initial;
  const today = useAppSelector(selectToday);
  const title = getRoleTitle(role);
  const company = getCompanyLabel(role, []);
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
