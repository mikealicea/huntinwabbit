'use client';
import { useEffect, useId, useRef } from 'react';
import { LoadingPulse } from '@/shared/shared.index';

export function SourceText({
  open,
  loading,
  saving,
  disabled,
  text,
  hasSavedText,
  mismatch,
  error,
  conflict,
  onChange,
  onSave,
  onRemove,
  onReview,
  onRetry,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  saving: boolean;
  disabled: boolean;
  text: string;
  hasSavedText: boolean;
  mismatch: boolean;
  error: string;
  conflict: boolean;
  onChange: (text: string) => void;
  onSave: () => void;
  onRemove: () => void;
  onReview: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const title = useId();
  const help = useId();
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (open && !loading) textarea.current?.focus();
  }, [open, loading]);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={title}
      onCancel={(event) => {
        if (saving) event.preventDefault();
      }}
      onClose={onClose}
    >
      <div className="modal-box w-full max-w-2xl">
        <h2 id={title} className="text-xl font-bold">
          Manage pasted text
        </h2>
        <p id={help} className="my-3 text-sm text-base-content/75">
          Paste the visible webpage text. It is saved with this role and sent to
          our extraction provider. Refresh tries the link too and gives your
          pasted text priority until you replace or remove it. Your corrections
          are preserved.
        </p>
        {loading ? (
          <p role="status">
            <LoadingPulse /> Loading saved text…
          </p>
        ) : (
          <>
            {mismatch && (
              <p role="alert" className="mb-3">
                The saved text belongs to a previous link. Replace it with text
                for the current link, or remove it before refreshing.
              </p>
            )}
            <label htmlFor={`${title}-text`} className="mb-2 block font-medium">
              Page text
            </label>
            <textarea
              id={`${title}-text`}
              ref={textarea}
              className="textarea block min-h-64 w-full text-base"
              aria-describedby={help}
              value={text}
              disabled={saving}
              onChange={(event) => onChange(event.target.value)}
            />
            <p className="mt-2 text-sm text-base-content/75">
              Up to 100,000 characters (256 KiB). Unsaved changes remain a
              draft.
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="mt-3">
            {error}
          </p>
        )}
        {conflict && (
          <button
            type="button"
            className="btn mt-2 min-h-11"
            onClick={onReview}
            disabled={saving}
          >
            Review latest version
          </button>
        )}
        {disabled && !loading && (
          <p role="status" className="mt-3">
            Wait for the current role operation to finish before submitting.
          </p>
        )}
        <div className="modal-action flex-wrap">
          <button
            type="button"
            className="btn btn-ghost min-h-11"
            disabled={saving}
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
          {loading && error && (
            <button type="button" className="btn min-h-11" onClick={onRetry}>
              Retry loading
            </button>
          )}
          <button
            type="button"
            className="btn min-h-11"
            disabled={
              loading || saving || disabled || conflict || !hasSavedText
            }
            onClick={onRemove}
          >
            Remove text and refresh
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-11"
            disabled={loading || saving || disabled || conflict || !text.trim()}
            onClick={onSave}
          >
            {saving && <LoadingPulse />}
            {saving ? 'Saving…' : 'Save and refresh'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
