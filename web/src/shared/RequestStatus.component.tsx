'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

export function RequestStatus({
  busy,
  failed,
  neutral = false,
  label,
  statusLabel,
  expandable,
  feedback,
}: {
  busy: boolean;
  failed: boolean;
  neutral?: boolean;
  label: string;
  statusLabel: string;
  expandable: boolean;
  feedback: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const detailsId = useId();
  useEffect(() => {
    if (!expandable) setOpen(false);
  }, [expandable]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent | FocusEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [open]);

  const icon = (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        busy
          ? 'motion-safe:animate-spin text-base-content/75'
          : failed
            ? 'text-error'
            : neutral
              ? 'text-base-content/75'
              : 'text-success'
      }
    >
      {busy ? (
        <path d="M12 3a9 9 0 1 1-9 9" />
      ) : failed ? (
        <path d="m6 6 12 12M18 6 6 18" />
      ) : neutral ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </>
      ) : (
        <path d="m5 12 4 4L19 6" />
      )}
    </svg>
  );

  return (
    <div
      ref={root}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center"
    >
      <span role="status" aria-label={statusLabel} className="sr-only">
        {label}
      </span>
      {expandable ? (
        <button
          ref={trigger}
          type="button"
          className="btn btn-ghost btn-square h-11 w-11"
          aria-label={`${label}. Show details`}
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((value) => !value)}
        >
          {icon}
        </button>
      ) : (
        <span title={label}>{icon}</span>
      )}
      {expandable && open && (
        <div
          id={detailsId}
          className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-3rem)] rounded-box border border-base-300 bg-base-100 p-3 text-sm shadow-lg [&>div]:mb-0"
        >
          {feedback}
        </div>
      )}
    </div>
  );
}
