import { useRef, useState } from 'react';
import type { RoleNote } from '@/features/job-api/job-api.index';
import { LoadingPulse } from '@/shared/shared.index';
import { NoteComposer } from './NoteComposer.component';
import { NoteEntry, type NoteOutcome } from './NoteEntry.component';
export function RoleNotes({
  notes,
  loading,
  error,
  pending,
  disabled,
  hasOlder,
  onOlder,
  onReload,
  onCreate,
  onEdit,
  onDelete,
}: {
  notes: RoleNote[];
  loading: boolean;
  error?: string;
  pending: boolean;
  disabled: boolean;
  hasOlder: boolean;
  onOlder: () => void;
  onReload: () => void;
  onCreate: (body: string) => Promise<boolean>;
  onEdit: (note: RoleNote, body: string) => Promise<NoteOutcome>;
  onDelete: (note: RoleNote) => Promise<NoteOutcome>;
}) {
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);
  const [draftEntries, setDraftEntries] = useState<Record<string, RoleNote>>(
    {},
  );
  const visibleNotes = [
    ...notes,
    ...Object.values(draftEntries).filter(
      (draft) => !notes.some((note) => note.id === draft.id),
    ),
  ];
  const composer = useRef<HTMLDivElement>(null);
  return (
    <section
      className="card border border-base-300 bg-base-100 shadow-sm"
      aria-labelledby="role-notes-title"
    >
      <div className="card-body gap-5 p-5 sm:p-6">
        <div>
          <h2 id="role-notes-title" className="card-title">
            Notes
          </h2>
          <p className="mt-2 text-sm text-base-content/75">
            Keep comments and interview notes with this role.
          </p>
        </div>
        <div ref={composer}>
          <NoteComposer
            body={body}
            onChange={(value) => {
              setBody(value);
              setSaved(false);
            }}
            label="Add a note"
            submitLabel="Add comment"
            disabled={disabled}
            pending={pending}
            onSubmit={async () => {
              const submitted = body;
              if (await onCreate(submitted)) {
                setBody((current) => (current === submitted ? '' : current));
                setSaved(true);
              }
            }}
          />
        </div>
        <p role="status" className="text-sm text-base-content/75">
          {pending
            ? 'Saving comment…'
            : saved
              ? 'Comment saved.'
              : body
                ? 'Your draft is not saved. Add your comment before leaving this page.'
                : 'Comments are saved to this role.'}
        </p>
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="btn btn-sm mt-2 min-h-11"
              disabled={loading}
              onClick={onReload}
            >
              Refresh comments
            </button>
          </div>
        )}
        {loading && (
          <p role="status">
            <LoadingPulse /> Loading comments…
          </p>
        )}
        {!loading && !error && visibleNotes.length === 0 && (
          <p className="text-sm text-base-content/75">
            No comments yet. Add your first note above.
          </p>
        )}
        <div className="space-y-4">
          {visibleNotes.map((note) => (
            <NoteEntry
              key={note.id}
              note={note}
              disabled={disabled || pending}
              unavailable={
                !loading && !notes.some((current) => current.id === note.id)
              }
              onDraftChange={(entry) =>
                setDraftEntries((current) => {
                  const next = { ...current };
                  if (entry) next[note.id] = entry;
                  else delete next[note.id];
                  return next;
                })
              }
              onEdit={onEdit}
              onDelete={async (value) => {
                const result = await onDelete(value);
                if (result === 'saved')
                  composer.current?.querySelector('textarea')?.focus();
                return result;
              }}
            />
          ))}
        </div>
        {hasOlder && (
          <button
            type="button"
            className="btn min-h-11"
            disabled={loading}
            onClick={onOlder}
          >
            Load older comments
          </button>
        )}
      </div>
    </section>
  );
}
