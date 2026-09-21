'use client';
import { useDraggable } from '@dnd-kit/react';
import {
  postingApi,
  RequestFeedback,
  useDeletePostingMutation,
  useExtractPostingMutation,
  usePostingQuery,
} from '@/features/job-api/job-api.index';
import {
  getCompanyLabel,
  getNextAction,
  getRoleTitle,
  type Opportunity,
  toOpportunity,
} from '@/features/job-search/job-search.index';
import { PostingActions } from '@/features/role-workspace/role-workspace.index';
import { LoadingPulse } from '@/shared/shared.index';
import {
  selectToday,
  useAppDispatch,
  useAppSelector,
} from '@/state/state.index';
import { RoleCard } from './RoleCard.component';

export function RoleCardContainer({
  role: initial,
  saving = false,
  onDeleted,
}: {
  role: Opportunity;
  saving?: boolean;
  onDeleted: (id: string) => void;
}) {
  const dispatch = useAppDispatch();
  const [extract, extraction] = useExtractPostingMutation();
  const [remove, deletion] = useDeletePostingMutation();
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
  const latest = data ?? cached.currentData;
  const role =
    latest && latest.recordVersion >= (initial.saved?.recordVersion ?? 0)
      ? toOpportunity(latest)
      : initial;
  const today = useAppSelector(selectToday);
  const title = getRoleTitle(role);
  const company = getCompanyLabel(role, []);
  const { ref, handleRef, isDragging } = useDraggable({
    id: role.id,
    disabled: saving || extraction.isLoading || deletion.isLoading,
    data: { label: `${title} at ${company}` },
  });
  return (
    <RoleCard
      role={role}
      busy={saving || extraction.isLoading || deletion.isLoading}
      actions={
        <PostingActions
          compact
          role={role}
          roleName={title}
          extracting={extraction.isLoading}
          deleting={deletion.isLoading || saving}
          deleteDisabled={extraction.isLoading}
          onExtract={() => {
            if (
              !role.saved ||
              saving ||
              extraction.isLoading ||
              deletion.isLoading
            )
              return;
            void extract({
              id: role.id,
              expectedGeneration: role.saved.extraction.generation,
            });
          }}
          onDelete={async (expectedApplicationVersion) => {
            if (saving || extraction.isLoading || deletion.isLoading)
              return 'failed';
            try {
              await remove({
                id: role.id,
                expectedApplicationVersion,
              }).unwrap();
              onDeleted(role.id);
              return 'deleted';
            } catch (error) {
              if (
                typeof error === 'object' &&
                error &&
                'status' in error &&
                error.status === 409
              ) {
                await dispatch(
                  postingApi.endpoints.posting.initiate(role.id, {
                    subscribe: false,
                    forceRefetch: true,
                  }),
                );
                return 'conflict';
              }
              return 'failed';
            }
          }}
        />
      }
      feedback={
        <>
          {Boolean(extraction.error) && (
            <RequestFeedback error={extraction.error} />
          )}
          {extraction.isLoading && (
            <p role="status" className="text-xs">
              <LoadingPulse />
              Requesting extraction…
            </p>
          )}
        </>
      }
      title={title}
      company={company}
      next={getNextAction(role, today)}
      isDragging={isDragging}
      cardRef={ref}
      dragHandleRef={handleRef}
    />
  );
}
