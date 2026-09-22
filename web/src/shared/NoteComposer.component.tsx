import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { LoadingPulse } from './LoadingPulse.component';
import { SafeMarkdown } from './SafeMarkdown.component';
export function NoteComposer({
  body,
  onChange,
  onSubmit,
  label,
  submitLabel,
  pending,
  disabled = false,
  submitDisabled = false,
  focusOnMount = false,
  children,
}: {
  body: string;
  onChange: (body: string) => void;
  onSubmit: () => void;
  label: string;
  submitLabel: string;
  pending: boolean;
  disabled?: boolean;
  submitDisabled?: boolean;
  focusOnMount?: boolean;
  children?: ReactNode;
}) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const canSubmit = !disabled && !submitDisabled && !pending && !!body.trim();
  useEffect(() => {
    if (focusOnMount) input.current?.focus();
  }, [focusOnMount]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <fieldset className="join" aria-label={`${label} mode`}>
          <button
            type="button"
            className="btn btn-sm join-item min-h-11"
            aria-pressed={!preview}
            onClick={() => {
              setPreview(false);
              requestAnimationFrame(() => input.current?.focus());
            }}
          >
            Write
          </button>
          <button
            type="button"
            className="btn btn-sm join-item min-h-11"
            aria-pressed={preview}
            onClick={() => setPreview(true)}
          >
            Preview
          </button>
        </fieldset>
      </div>
      <textarea
        ref={input}
        hidden={preview}
        id={id}
        className="textarea min-h-40 w-full text-base leading-relaxed"
        value={body}
        maxLength={20000}
        disabled={disabled}
        placeholder="Interview thoughts, recruiter updates, things to remember…"
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key !== 'Enter' ||
            !event.metaKey ||
            event.nativeEvent.isComposing
          ) {
            return;
          }
          event.preventDefault();
          if (canSubmit && !event.repeat) onSubmit();
        }}
      />
      {preview && (
        <section
          className="min-h-40 rounded-lg border border-base-300 p-4"
          aria-label={`${label} preview`}
        >
          {body.trim() ? (
            <SafeMarkdown text={body} />
          ) : (
            <p className="text-sm text-base-content/75">
              Nothing to preview yet.
            </p>
          )}
        </section>
      )}
      <p id={`${id}-hint`} className="text-xs text-base-content/75">
        Markdown supported. Cmd+Enter to submit. {body.length.toLocaleString()}{' '}
        / 20,000 characters.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary min-h-11"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {pending && <LoadingPulse />}
          {pending ? 'Saving…' : submitLabel}
        </button>
        {children}
      </div>
    </div>
  );
}
