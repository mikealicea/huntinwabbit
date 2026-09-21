'use client';

import { useEffect, useRef, useState } from 'react';
import type { Opportunity } from '@/features/job-search/job-search.index';
import { LoadingPulse } from '@/shared/shared.index';
import { type DeleteOutcome, DeletePosting } from './DeletePosting.component';

export function PostingActions({
  role,
  roleName,
  extracting,
  deleting,
  deleteDisabled,
  onExtract,
  onDelete,
  compact = false,
}: {
  compact?: boolean;
  role: Opportunity;
  roleName: string;
  extracting: boolean;
  deleting: boolean;
  deleteDisabled: boolean;
  onExtract?: () => void;
  onDelete?: (version: number) => Promise<DeleteOutcome>;
}) {
  const dropdown = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const [confirming, setConfirming] = useState(false);
  const pending = ['queued', 'processing'].includes(
    role.saved?.extraction.status ?? '',
  );

  function closeDropdown() {
    if (dropdown.current) dropdown.current.open = false;
    trigger.current?.focus();
  }

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !dropdown.current?.contains(event.target) &&
        dropdown.current
      )
        dropdown.current.open = false;
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && dropdown.current?.open) {
        event.preventDefault();
        dropdown.current.open = false;
        trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, []);

  if (!role.saved || (!onExtract && !onDelete)) return null;
  return (
    <>
      <details
        ref={dropdown}
        className={`dropdown dropdown-end ${compact ? 'static' : ''}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            event.currentTarget.open = false;
          }
        }}
      >
        <summary
          ref={trigger}
          className="btn btn-ghost btn-square min-h-11 min-w-11"
          aria-label="Posting actions"
        >
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </summary>
        <ul
          className={`dropdown-content menu z-10 mt-2 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg ${compact ? 'right-0 w-full max-w-60' : 'w-60'}`}
        >
          {onExtract && (
            <li>
              <button
                type="button"
                className="min-h-11"
                disabled={deleting || extracting || pending}
                onClick={() => {
                  closeDropdown();
                  onExtract();
                }}
              >
                {(extracting || pending) && <LoadingPulse />}
                {extracting
                  ? 'Requesting extraction…'
                  : pending
                    ? role.posting
                      ? 'Refreshing posting…'
                      : 'Extracting posting…'
                    : role.saved.extraction.status === 'failed'
                      ? 'Retry extraction'
                      : role.posting
                        ? 'Refresh posting'
                        : 'Extract posting details'}
              </button>
            </li>
          )}
          {onDelete && (
            <li className="mt-1 border-t border-base-300 pt-1">
              <button
                type="button"
                className="min-h-11 text-error"
                disabled={deleting || deleteDisabled}
                onClick={() => {
                  closeDropdown();
                  setConfirming(true);
                }}
              >
                Delete posting
              </button>
            </li>
          )}
        </ul>
      </details>
      {confirming && onDelete && (
        <DeletePosting
          roleName={roleName}
          version={role.saved.applicationVersion}
          pending={deleting}
          onDelete={onDelete}
          onClose={() => {
            setConfirming(false);
            trigger.current?.focus();
          }}
        />
      )}
    </>
  );
}
