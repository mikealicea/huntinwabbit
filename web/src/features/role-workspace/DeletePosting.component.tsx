import { useEffect, useId, useRef, useState } from 'react';
import { LoadingPulse } from '@/shared/shared.index';

export type DeleteOutcome = 'deleted' | 'conflict' | 'failed';
export function DeletePosting({
  roleName,
  version,
  pending,
  onClose,
  onDelete,
}: {
  roleName: string;
  version: number;
  pending: boolean;
  onClose: () => void;
  onDelete: (version: number) => Promise<DeleteOutcome>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const reviewedVersion = useRef(version);
  const title = useId();
  const description = useId();
  const [outcome, setOutcome] = useState<DeleteOutcome | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
    cancel.current?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={title}
      aria-describedby={description}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const first = cancel.current;
        const last = outcome === 'conflict' ? first : confirm.current;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={onClose}
    >
      <div className="modal-box">
        <h2 id={title} className="text-xl font-bold">
          Delete posting?
        </h2>
        <p id={description} className="mt-3 break-words">
          Permanently delete {roleName}, including its saved details, tracking
          choices, and notes? This cannot be undone. You can save the link again
          as a new posting.
        </p>
        {outcome === 'failed' && (
          <p role="alert" className="mt-3">
            Deletion could not be confirmed. Try again.
          </p>
        )}
        {outcome === 'conflict' && (
          <p role="alert" className="mt-3">
            This posting changed elsewhere. Review the updated posting before
            confirming deletion again.
          </p>
        )}
        <div className="modal-action">
          <button
            ref={cancel}
            type="button"
            className="btn min-h-11"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            {outcome === 'conflict' ? 'Review posting' : 'Cancel'}
          </button>
          <button
            type="button"
            ref={confirm}
            className="btn btn-error min-h-11"
            disabled={pending || outcome === 'conflict'}
            onClick={async () => {
              const result = await onDelete(reviewedVersion.current);
              setOutcome(result);
              if (result === 'deleted') dialog.current?.close();
            }}
          >
            {pending && <LoadingPulse />}
            {pending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
