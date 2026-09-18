import type { FormEvent, Ref } from 'react';
import {
  INTEREST_LABELS,
  INTERESTS,
  type Interest,
} from '@/features/job-search/job-search.index';
import type { CaptureRow } from './job-capture.validation';
export interface JobCaptureProps {
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
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    placeholder="https://company.com/careers/role"
                    value={row.url}
                    aria-invalid={Boolean(errors[row.id])}
                    aria-describedby={
                      errors[row.id] ? `${id}-error-${row.id}` : undefined
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
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn btn-primary min-h-11" type="submit">
                Save to Collected
              </button>
              <button
                className="btn btn-ghost min-h-11"
                type="button"
                onClick={onClose}
              >
                Close
              </button>
              <p className="text-sm text-base-content/75">
                Links are saved without fetching the posting.
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
