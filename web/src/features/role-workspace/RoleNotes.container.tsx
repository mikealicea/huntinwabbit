'use client';
import { useRef } from 'react';
import {
  postingApi,
  type RoleNote,
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useEditNoteMutation,
  useRoleNotesInfiniteQuery,
} from '@/features/job-api/job-api.index';
import { useAppDispatch } from '@/state/state.index';
import type { NoteOutcome } from './NoteEntry.component';
import { RoleNotes } from './RoleNotes.component';
export function RoleNotesContainer({
  roleId,
  disabled = false,
}: {
  roleId: string;
  disabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const query = useRoleNotesInfiniteQuery(roleId, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const [create, creating] = useCreateNoteMutation();
  const [edit, editing] = useEditNoteMutation();
  const [remove, deleting] = useDeleteNoteMutation();
  const attempt = useRef<{ id: string; body: string } | null>(null);
  const busy = useRef(false);
  const notes = [
    ...new Map(
      (query.currentData?.pages.flatMap((page) => page.items) ?? []).map(
        (note) => [note.id, note],
      ),
    ).values(),
  ];
  const error = query.error ?? creating.error;
  async function refreshRole() {
    // Wait for the updated deletion/tracking version before reporting the save complete.
    await dispatch(
      postingApi.endpoints.posting.initiate(roleId, {
        forceRefetch: true,
        subscribe: false,
      }),
    );
  }
  async function change(note: RoleNote, body?: string): Promise<NoteOutcome> {
    if (disabled || busy.current) return 'failed';
    busy.current = true;
    try {
      const input = {
        roleId,
        noteId: note.id,
        expectedRevision: note.revision,
      };
      if (body === undefined) await remove(input).unwrap();
      else await edit({ ...input, body }).unwrap();
      await refreshRole();
      return 'saved';
    } catch (failure) {
      await query.refetch();
      return typeof failure === 'object' &&
        failure &&
        'status' in failure &&
        failure.status === 409
        ? 'conflict'
        : 'failed';
    } finally {
      busy.current = false;
    }
  }
  return (
    <RoleNotes
      notes={notes}
      loading={query.isFetching}
      error={
        error
          ? 'Comments could not be confirmed. Refresh to check saved comments; your draft is preserved.'
          : undefined
      }
      pending={creating.isLoading}
      disabled={disabled || editing.isLoading || deleting.isLoading}
      hasOlder={query.hasNextPage}
      onOlder={() => void query.fetchNextPage()}
      onReload={() => {
        creating.reset();
        void query.refetch();
      }}
      onCreate={async (body) => {
        if (disabled || busy.current) return false;
        busy.current = true;
        if (attempt.current?.body !== body)
          attempt.current = { id: crypto.randomUUID(), body };
        try {
          await create({ roleId, ...attempt.current }).unwrap();
          await refreshRole();
          attempt.current = null;
          return true;
        } catch {
          return false;
        } finally {
          busy.current = false;
        }
      }}
      onEdit={(note, body) => change(note, body)}
      onDelete={(note) => change(note)}
    />
  );
}
