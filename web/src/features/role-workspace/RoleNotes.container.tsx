'use client';
import { useRef, useState } from 'react';
import {
  postingApi,
  type RoleNote,
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useEditNoteMutation,
  useRoleNotesInfiniteQuery,
} from '@/features/job-api/job-api.index';
import type { NoteOutcome } from '@/shared/shared.index';
import { useAppDispatch } from '@/state/state.index';
import { NoteStage } from './NoteStage.component';
import { RoleNotes } from './RoleNotes.component';
export function RoleNotesContainer({
  roleId,
  disabled = false,
  stages = [],
  interviewStageId,
}: {
  roleId: string;
  disabled?: boolean;
  stages?: { id: string; name: string }[];
  interviewStageId?: string;
}) {
  const dispatch = useAppDispatch();
  const query = useRoleNotesInfiniteQuery(
    interviewStageId ? { roleId, interviewStageId } : roleId,
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
    },
  );
  const [create, creating] = useCreateNoteMutation();
  const [edit, editing] = useEditNoteMutation();
  const [remove, deleting] = useDeleteNoteMutation();
  const attempt = useRef<{
    id: string;
    body: string;
    interviewStageId: string | null;
  } | null>(null);
  const [selected, setSelected] = useState('');
  const [linkError, setLinkError] = useState('');
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
  async function change(
    note: RoleNote,
    body?: string,
    stageId?: string | null,
  ): Promise<NoteOutcome> {
    if (disabled || busy.current) return 'failed';
    busy.current = true;
    try {
      const input = {
        roleId,
        noteId: note.id,
        expectedRevision: note.revision,
      };
      if (body === undefined) await remove(input).unwrap();
      else
        await edit({
          ...input,
          body,
          ...(stageId !== undefined ? { interviewStageId: stageId } : {}),
        }).unwrap();
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
      subject={interviewStageId ? 'interview stage' : 'role'}
      composerContext={
        !interviewStageId &&
        stages.length > 0 && (
          <NoteStage
            stages={stages}
            value={selected}
            disabled={disabled || creating.isLoading}
            onChange={setSelected}
          />
        )
      }
      renderNoteContext={
        !interviewStageId
          ? (note) => {
              const saved = notes.find((item) => item.id === note.id);
              return (
                (stages.length > 0 || saved?.interviewStageId) && (
                  <NoteStage
                    stages={stages}
                    value={saved?.interviewStageId ?? ''}
                    disabled={
                      disabled ||
                      creating.isLoading ||
                      editing.isLoading ||
                      deleting.isLoading ||
                      !saved
                    }
                    onChange={async (value) => {
                      if (!saved) return;
                      setLinkError('');
                      const result = await change(
                        saved,
                        saved.body,
                        value || null,
                      );
                      if (result !== 'saved')
                        setLinkError(
                          result === 'conflict'
                            ? 'This comment changed. Review the saved comment before linking it again.'
                            : 'The interview step could not be saved. Review the saved selection before retrying.',
                        );
                    }}
                  />
                )
              );
            }
          : undefined
      }
      notes={notes}
      loading={query.isFetching}
      error={
        linkError ||
        (error
          ? 'Comments could not be confirmed. Refresh to check saved comments; your draft is preserved.'
          : undefined)
      }
      pending={creating.isLoading}
      disabled={disabled || editing.isLoading || deleting.isLoading}
      hasOlder={query.hasNextPage}
      onOlder={() => void query.fetchNextPage()}
      onReload={() => {
        creating.reset();
        setLinkError('');
        void query.refetch();
      }}
      onCreate={async (body) => {
        if (disabled || busy.current) return false;
        busy.current = true;
        const stageId = interviewStageId ?? (selected || null);
        if (
          attempt.current?.body !== body ||
          attempt.current?.interviewStageId !== stageId
        )
          attempt.current = {
            id: crypto.randomUUID(),
            body,
            interviewStageId: stageId,
          };
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
