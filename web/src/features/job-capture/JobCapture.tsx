'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import {
  INTEREST_LABELS,
  INTERESTS,
  type Interest,
  useJobSearch,
} from '@/features/job-search/job-search.index';
import { type CaptureRow, validateCapture } from './job-capture.validation';

export function JobCapture() {
  const { dispatch } = useJobSearch();
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<CaptureRow[]>([
    { id: 0, url: '', interest: 'not-set' },
  ]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState('');
  const rowSequence = useRef(1);
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (isOpen) inputs.current.get(0)?.focus();
  }, [isOpen]);

  function updateUrl(rowId: number, url: string) {
    setNotice('');
    setErrors((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
    // Allocate IDs outside the updater: React may replay state updaters.
    const newRowId = rowSequence.current++;
    setRows((current) => {
      const updated = current.map((row) =>
        row.id === rowId ? { ...row, url } : row,
      );
      if (url.trim() && current.at(-1)?.id === rowId)
        updated.push({ id: newRowId, url: '', interest: 'not-set' });
      return updated;
    });
  }

  function saveLinks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateCapture(rows);
    setErrors(result.errors);
    const firstInvalid = rows.find((row) => result.errors[row.id]);
    if (firstInvalid) {
      setNotice('');
      inputs.current.get(firstInvalid.id)?.focus();
      return;
    }
    dispatch({
      type: 'capture',
      links: result.links.map((link) => ({ ...link, id: crypto.randomUUID() })),
    });
    setRows([{ id: 0, url: '', interest: 'not-set' }]);
    setNotice(
      `${result.links.length} ${result.links.length === 1 ? 'link added' : 'links added'} to Collected. Posting details are unavailable in this sample.`,
    );
    // Row zero remains mounted, so focus can return without a delayed callback.
    inputs.current.get(0)?.focus();
  }

  return (
    <section aria-label="Add job links" className="mb-8">
      <button
        ref={toggle}
        type="button"
        className="btn btn-primary min-h-11"
        aria-expanded={isOpen}
        aria-controls={`${id}-form`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span aria-hidden="true" className="text-xl">
          +
        </span>{' '}
        Add job links
      </button>
      {isOpen && (
        <form
          id={`${id}-form`}
          onSubmit={saveLinks}
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
                    ref={(element) => {
                      if (element) inputs.current.set(row.id, element);
                      else inputs.current.delete(row.id);
                    }}
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
                    onChange={(event) => updateUrl(row.id, event.target.value)}
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
                      setRows((current) =>
                        current.map((item) =>
                          item.id === row.id
                            ? {
                                ...item,
                                interest: event.target.value as Interest,
                              }
                            : item,
                        ),
                      )
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
                onClick={() => {
                  setIsOpen(false);
                  toggle.current?.focus();
                }}
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
