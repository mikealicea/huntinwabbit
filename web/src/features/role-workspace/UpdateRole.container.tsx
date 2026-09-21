'use client';
import { useRef } from 'react';
import {
  postingApi,
  type UpdateEntry,
  type UpdateMessage,
  useRoleUpdatesInfiniteQuery,
  useSendRoleUpdateMutation,
  useUndoRoleUpdateMutation,
} from '@/features/job-api/job-api.index';
import { useAppDispatch } from '@/state/state.index';
import { UpdateRole } from './UpdateRole.component';
export function UpdateRoleContainer({
  roleId,
  pending: rolePending,
  disabled = false,
}: {
  roleId: string;
  pending: boolean;
  disabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const cached = postingApi.endpoints.roleUpdates.useInfiniteQueryState(roleId);
  const processing = cached.data?.pages.some((page) =>
    page.items.some(
      (entry) => entry.status === 'queued' || entry.status === 'processing',
    ),
  );
  const history = useRoleUpdatesInfiniteQuery(roleId, {
    pollingInterval: rolePending || processing ? 2000 : 0,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });
  const [send, sending] = useSendRoleUpdateMutation();
  const [undo, undoing] = useUndoRoleUpdateMutation();
  const attempt = useRef<UpdateMessage | null>(null);
  const entries = [
    ...new Map(
      (history.currentData?.pages.flatMap((page) => page.items) ?? []).map(
        (entry) => [entry.id, entry],
      ),
    ).values(),
  ].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const pending =
    disabled ||
    rolePending ||
    !!processing ||
    sending.isLoading ||
    undoing.isLoading;
  const error = history.error ?? sending.error ?? undoing.error;
  async function submit(text: string, retryOf?: string) {
    if (pending) return false;
    const trimmed = text.trim();
    if (
      attempt.current?.text !== trimmed ||
      attempt.current?.retryOf !== retryOf
    )
      attempt.current = {
        operationId: crypto.randomUUID(),
        text: trimmed,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(retryOf ? { retryOf } : {}),
      };
    if (!attempt.current) return false;
    try {
      await send({ id: roleId, ...attempt.current }).unwrap();
      attempt.current = null;
      return true;
    } catch {
      return false;
    }
  }
  return (
    <UpdateRole
      entries={entries}
      pending={pending}
      loading={history.isLoading || history.isFetchingNextPage}
      hasOlder={history.hasNextPage}
      onOlder={() => void history.fetchNextPage()}
      onReload={() => {
        sending.reset();
        undoing.reset();
        void history.refetch();
        dispatch(postingApi.util.invalidateTags(['Posting']));
      }}
      error={
        error
          ? 'status' in error && error.status === 409
            ? 'This role changed. Refresh and review it; Undo cannot overwrite later edits.'
            : 'The request could not be confirmed. Refresh to check its status; your draft is preserved.'
          : undefined
      }
      onSend={(text) => submit(text)}
      onRetry={(entry: UpdateEntry) => {
        void submit(entry.text, entry.id);
      }}
      onUndo={(operationId) => {
        if (!pending) void undo({ id: roleId, operationId });
      }}
    />
  );
}
