'use client';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { SafeMarkdown } from '@/shared/shared.index';

export function InterviewStage({
  stage,
  notes,
  onClose,
}: {
  stage: { name: string; context?: string } | undefined;
  notes: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    dialog.current?.showModal();
    close.current?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
    >
      <div className="modal-box max-h-[90dvh] w-full max-w-3xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-base-content/75">Interview step</p>
            <h2 id={`${id}-title`} className="break-words text-xl font-bold">
              {stage?.name ?? 'Removed interview step'}
            </h2>
          </div>
          <button
            ref={close}
            type="button"
            className="btn min-h-11"
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </div>
        {stage ? (
          <section aria-label="Stage details" className="space-y-2">
            <h3 className="font-semibold">Stage details</h3>
            {stage.context ? (
              <SafeMarkdown text={stage.context} />
            ) : (
              <p className="text-sm text-base-content/75">
                No details saved yet. Add a note below, or paste a transcript
                into Update role to extract details for this step.
              </p>
            )}
          </section>
        ) : (
          <p role="status">
            This step was removed. Its saved comments remain in the role’s
            Notes. Copy any unsaved draft before closing.
          </p>
        )}
        {notes}
        <p className="text-sm text-base-content/75">
          Add or save your comment before closing. Unsaved drafts are not
          retained when you close this window.
        </p>
      </div>
    </dialog>
  );
}
