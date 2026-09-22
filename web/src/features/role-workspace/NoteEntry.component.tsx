import { useRef, useState } from 'react';
import type { RoleNote } from '@/features/job-api/job-api.index';
import { SafeMarkdown } from '@/shared/shared.index';
import { NoteComposer } from './NoteComposer.component';

function focusCancel(element: HTMLButtonElement | null) {
  element?.focus();
}
export type NoteOutcome = 'saved' | 'conflict' | 'failed';
export function NoteEntry({
  note,
  disabled,
  onEdit,
  onDelete,
  onDraftChange,
  unavailable = false,
}: {
  note: RoleNote;
  onDraftChange: (note: RoleNote | null) => void;
  unavailable?: boolean;
  disabled: boolean;
  onEdit: (note: RoleNote, body: string) => Promise<NoteOutcome>;
  onDelete: (note: RoleNote) => Promise<NoteOutcome>;
}) {
  const [draft, setDraft] = useState<{ body: string; revision: number } | null>(
    null,
  );
  const [confirm, setConfirm] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<NoteOutcome | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const blocked = pending || disabled;
  function cancel() {
    setDraft(null);
    onDraftChange(null);
    setConfirm(null);
    setOutcome(null);
    requestAnimationFrame(() =>
      (draft ? editButton : deleteButton).current?.focus(),
    );
  }
  return (
    <article
      className="rounded-xl border border-base-300 p-4"
      aria-label="Comment"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-base-content/75">
          <time dateTime={note.createdAt}>
            {new Date(note.createdAt).toLocaleString()}
          </time>
          {note.revision > 1 && (
            <span title={new Date(note.updatedAt).toLocaleString()}>
              {' '}
              · Edited
            </span>
          )}
        </p>
        {!draft && confirm === null && (
          <div className="flex gap-1">
            <button
              ref={editButton}
              type="button"
              className="btn btn-ghost btn-sm min-h-11"
              disabled={blocked}
              onClick={() => {
                onDraftChange(note);
                setDraft({ body: note.body, revision: note.revision });
                setOutcome(null);
              }}
            >
              Edit comment
            </button>
            <button
              ref={deleteButton}
              type="button"
              className="btn btn-ghost btn-sm min-h-11"
              disabled={blocked}
              onClick={() => {
                setConfirm(note.revision);
                setOutcome(null);
              }}
            >
              Delete comment
            </button>
          </div>
        )}
      </div>
      {draft ? (
        <NoteComposer
          body={draft.body}
          onChange={(body) =>
            setDraft((current) => (current ? { ...current, body } : null))
          }
          focusOnMount
          label="Edit comment"
          submitLabel="Save changes"
          disabled={blocked}
          submitDisabled={outcome === 'conflict' || unavailable}
          pending={pending}
          onSubmit={async () => {
            setPending(true);
            const result = await onEdit(
              { ...note, revision: draft.revision },
              draft.body,
            );
            setPending(false);
            setOutcome(result);
            if (result === 'saved') {
              onDraftChange(null);
              setDraft(null);
              requestAnimationFrame(() => editButton.current?.focus());
            }
          }}
        >
          <button
            type="button"
            className="btn min-h-11"
            disabled={blocked}
            onClick={cancel}
          >
            Cancel edit
          </button>
        </NoteComposer>
      ) : (
        <SafeMarkdown text={note.body} />
      )}
      {confirm !== null && (
        <fieldset
          className="mt-4 space-y-3 rounded-lg bg-base-200 p-3"
          aria-label="Confirm comment deletion"
        >
          <p>Permanently delete this comment? This cannot be undone.</p>
          <div className="flex flex-wrap gap-2">
            <button
              ref={focusCancel}
              type="button"
              className="btn min-h-11"
              disabled={blocked}
              onClick={cancel}
            >
              Cancel deletion
            </button>
            <button
              type="button"
              className="btn btn-error min-h-11"
              disabled={blocked || outcome === 'conflict'}
              onClick={async () => {
                setPending(true);
                const result = await onDelete({ ...note, revision: confirm });
                setPending(false);
                setOutcome(result);
              }}
            >
              {pending ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </fieldset>
      )}
      {unavailable && draft && (
        <p role="alert" className="mt-3 text-sm">
          This comment is no longer in the loaded list. Your draft is preserved.
          Copy it into a new comment before canceling if you want to keep it.
        </p>
      )}
      {outcome === 'failed' && (
        <p role="alert" className="mt-3 text-sm">
          The request could not be confirmed. Your draft is preserved. Try
          again.
        </p>
      )}
      {outcome === 'conflict' && (
        <div role="alert" className="mt-3 space-y-3">
          <p>
            This comment changed. Review the latest saved version before trying
            again.
          </p>
          {draft && (
            <>
              <SafeMarkdown text={note.body} />
              <button
                type="button"
                className="btn min-h-11"
                disabled={disabled}
                onClick={() => {
                  setDraft((current) =>
                    current ? { ...current, revision: note.revision } : null,
                  );
                  setOutcome(null);
                }}
              >
                I reviewed the latest comment
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
