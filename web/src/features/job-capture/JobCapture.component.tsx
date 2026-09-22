import Link from 'next/link';
import { type FormEvent, type Ref, useRef } from 'react';
import {
  INTEREST_LABELS,
  INTERESTS,
  type Interest,
} from '@/features/job-search/job-search.index';
import { LoadingPulse } from '@/shared/shared.index';
import type { CaptureRow } from './job-capture.validation';
export interface JobCaptureProps {
  saving?: boolean;
  recommendedRow?: number | null;
  onRowFocus?: (id: number | null) => void;
  expandedRow?: number | null;
  onExpandedRowChange?: (id: number | null) => void;
  onSourceTextChange?: (id: number, text: string) => void;
  registerText?: (id: number, element: HTMLTextAreaElement | null) => void;
  isOpen: boolean;
  rows: CaptureRow[];
  errors: Record<number, string>;
  notice: string;
  id: string;
  toggleRef: Ref<HTMLButtonElement>;
  registerInput: (id: number, element: HTMLInputElement | null) => void;
  onToggle: () => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUrlChange: (id: number, url: string) => void;
  onInterestChange: (id: number, interest: Interest) => void;
}
export function JobCapture({
  saving = false,
  recommendedRow = null,
  onRowFocus,
  expandedRow = null,
  onExpandedRowChange,
  onSourceTextChange,
  registerText,
  isOpen,
  rows,
  errors,
  notice,
  id,
  toggleRef,
  registerInput,
  onToggle,
  onClose,
  onSubmit,
  onUrlChange,
  onInterestChange,
}: JobCaptureProps) {
  const disclosures = useRef(new Map<number, HTMLButtonElement>());
  return (
    <section aria-label="Add job links" className="mb-8">
      <button
        ref={toggleRef}
        type="button"
        className="btn btn-primary min-h-11"
        aria-expanded={isOpen}
        aria-controls={`${id}-form`}
        onClick={onToggle}
      >
        <span aria-hidden="true" className="text-xl">
          +
        </span>{' '}
        Add job links
      </button>
      {isOpen && (
        <form
          id={`${id}-form`}
          onSubmit={onSubmit}
          noValidate
          className="card mt-4 border border-base-300 bg-base-100 shadow-sm"
        >
          <div className="card-body gap-5 p-5 sm:p-6">
            <div>
              <h2 className="card-title">Collect a few possibilities</h2>
              <p className="mt-1 text-sm text-base-content/75">
                One job link per row. Interest is optional; you can decide
                later.
              </p>
            </div>
            {rows.map((row, index) => (
              <div
                key={row.id}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    onRowFocus?.(null);
                }}
                onFocusCapture={() => {
                  onRowFocus?.(row.id);
                  if (expandedRow !== null && expandedRow !== row.id)
                    onExpandedRowChange?.(null);
                }}
                className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_220px]"
              >
                <div className="fieldset p-0">
                  <label
                    htmlFor={`${id}-url-${row.id}`}
                    className="fieldset-legend pb-2 pt-0"
                  >
                    Job link {index + 1}
                  </label>
                  <input
                    ref={(element) => registerInput(row.id, element)}
                    id={`${id}-url-${row.id}`}
                    className={`input w-full min-h-11 text-base ${errors[row.id] ? 'input-error' : ''}`}
                    disabled={saving}
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    placeholder="https://company.com/careers/role"
                    value={row.url}
                    aria-invalid={Boolean(errors[row.id])}
                    aria-describedby={
                      [
                        errors[row.id] ? `${id}-error-${row.id}` : '',
                        recommendedRow === row.id
                          ? `${id}-guidance-${row.id}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    onChange={(event) =>
                      onUrlChange(row.id, event.target.value)
                    }
                  />
                  {errors[row.id] && (
                    <p
                      id={`${id}-error-${row.id}`}
                      role="alert"
                      className="text-sm font-medium text-base-content"
                    >
                      {errors[row.id]}
                    </p>
                  )}
                </div>
                <div className="fieldset p-0">
                  <label
                    htmlFor={`${id}-interest-${row.id}`}
                    className="fieldset-legend pb-2 pt-0"
                  >
                    Interest <span className="font-normal">(optional)</span>
                    <span className="sr-only"> for job link {index + 1}</span>
                  </label>
                  <select
                    id={`${id}-interest-${row.id}`}
                    className="select w-full min-h-11 text-base"
                    disabled={saving}
                    value={row.interest}
                    onChange={(event) =>
                      onInterestChange(row.id, event.target.value as Interest)
                    }
                  >
                    {INTERESTS.map((interest) => (
                      <option key={interest} value={interest}>
                        {INTEREST_LABELS[interest]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  {recommendedRow === row.id && (
                    <p
                      id={`${id}-guidance-${row.id}`}
                      role="status"
                      className="mb-2 text-sm text-base-content/75"
                    >
                      This site may block scanning. Paste the full job
                      description to help extract the details.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      ref={(element) => {
                        if (element) disclosures.current.set(row.id, element);
                        else disclosures.current.delete(row.id);
                      }}
                      className="btn btn-ghost btn-sm min-h-11"
                      aria-expanded={expandedRow === row.id}
                      aria-controls={`${id}-paste-${row.id}`}
                      aria-label={`${row.sourceText?.trim() ? 'Edit' : 'Paste'} page text for job link ${index + 1}`}
                      onClick={() =>
                        onExpandedRowChange?.(
                          expandedRow === row.id ? null : row.id,
                        )
                      }
                    >
                      <span aria-hidden="true">
                        {expandedRow === row.id ? '▾' : '▸'}
                      </span>
                      {row.sourceText?.trim()
                        ? 'Edit page text'
                        : 'Paste page text'}
                    </button>
                    {row.sourceText?.trim() && (
                      <span className="text-sm text-base-content/75">
                        Page text added
                      </span>
                    )}
                  </div>
                  <div
                    id={`${id}-paste-${row.id}`}
                    hidden={expandedRow !== row.id}
                  >
                    <label
                      htmlFor={`${id}-text-${row.id}`}
                      className="mb-2 block text-sm font-medium"
                    >
                      Page text for job link {index + 1}
                    </label>
                    <div className="overflow-hidden rounded-box border border-base-300 focus-within:outline-2 focus-within:outline-primary">
                      <textarea
                        id={`${id}-text-${row.id}`}
                        ref={(element) => registerText?.(row.id, element)}
                        className="block min-h-40 max-h-80 w-full resize-y bg-base-100 p-3 text-base focus:outline-none"
                        disabled={saving}
                        value={row.sourceText ?? ''}
                        aria-describedby={`${id}-paste-help-${row.id}${errors[row.id] ? ` ${id}-error-${row.id}` : ''}`}
                        onChange={(event) =>
                          onSourceTextChange?.(row.id, event.target.value)
                        }
                      />
                      <div className="flex items-center justify-between gap-3 border-t border-base-300 bg-base-200 px-3 py-1">
                        <span className="text-xs text-base-content/75">
                          Draft · saved with your link
                        </span>
                        <button
                          type="button"
                          className="btn btn-success btn-square min-h-11 min-w-11"
                          disabled={saving}
                          aria-label={`Done with pasted text for job link ${index + 1}`}
                          onClick={() => {
                            onExpandedRowChange?.(null);
                            disclosures.current.get(row.id)?.focus();
                          }}
                        >
                          <svg
                            aria-hidden="true"
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="m5 12 4 4L19 6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p
                      id={`${id}-paste-help-${row.id}`}
                      className="mt-2 text-sm text-base-content/75"
                    >
                      Copy the visible webpage text here. We’ll also try the
                      link; your pasted text takes priority. Up to 100,000
                      characters (256 KiB). The check only folds this editor.
                    </p>
                  </div>
                  {row.existingId && (
                    <p role="status" className="mt-2 text-sm">
                      This link is already saved. Your pasted draft is still
                      here.{' '}
                      <Link
                        className="link"
                        href={`/app/roles/${row.existingId}`}
                      >
                        Open saved role
                      </Link>{' '}
                      to manage its page text.
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <button
                disabled={saving}
                className="btn btn-primary min-h-11"
                type="submit"
              >
                {saving && <LoadingPulse />}
                {saving ? 'Saving links…' : 'Save to Collected'}
              </button>
              <button
                className="btn btn-ghost min-h-11"
                type="button"
                onClick={onClose}
              >
                Close
              </button>
              <p className="text-sm text-base-content/75">
                Links save first. Posting details are extracted in the
                background.
              </p>
            </div>
          </div>
        </form>
      )}
      <p
        role="status"
        aria-live="polite"
        className={notice ? 'mt-3 text-sm' : 'sr-only'}
      >
        {notice}
      </p>
    </section>
  );
}
