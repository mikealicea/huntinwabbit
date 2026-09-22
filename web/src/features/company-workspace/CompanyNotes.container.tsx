'use client';
import { useRef } from 'react';
import {
  type RoleNote,
  useCompanyNotesInfiniteQuery,
  useCreateCompanyNoteMutation,
  useDeleteCompanyNoteMutation,
  useEditCompanyNoteMutation,
} from '@/features/job-api/job-api.index';
import type { NoteOutcome } from '@/shared/shared.index';
import { Notes } from '@/shared/shared.index';
export function CompanyNotesContainer({
  companyId,
  disabled = false,
}: {
  companyId: string;
  disabled?: boolean;
}) {
  const query = useCompanyNotesInfiniteQuery(companyId, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const [create, creating] = useCreateCompanyNoteMutation();
  const [edit, editing] = useEditCompanyNoteMutation();
  const [remove, deleting] = useDeleteCompanyNoteMutation();
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
  async function change(note: RoleNote, body?: string): Promise<NoteOutcome> {
    if (disabled || busy.current) return 'failed';
    busy.current = true;
    try {
      const input = {
        companyId,
        noteId: note.id,
        expectedRevision: note.revision,
      };
      if (body === undefined) await remove(input).unwrap();
      else await edit({ ...input, body }).unwrap();
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
    <Notes
      subject="company"
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
          await create({ companyId, ...attempt.current }).unwrap();
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
