'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { linksCaptured } from '@/features/job-search/job-search.index';
import { useAppDispatch } from '@/state/state.index';
import { JobCapture } from './JobCapture.component';
import { type CaptureRow, validateCapture } from './job-capture.validation';

export function JobCaptureContainer() {
  const dispatch = useAppDispatch();
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
    dispatch(
      linksCaptured(
        result.links.map((link) => ({ ...link, id: crypto.randomUUID() })),
      ),
    );
    setRows([{ id: 0, url: '', interest: 'not-set' }]);
    setNotice(
      `${result.links.length} ${result.links.length === 1 ? 'link added' : 'links added'} to Collected. Posting details are unavailable in this sample.`,
    );
    // Row zero remains mounted, so focus can return without a delayed callback.
    inputs.current.get(0)?.focus();
  }

  return (
    <JobCapture
      isOpen={isOpen}
      rows={rows}
      errors={errors}
      notice={notice}
      id={id}
      toggleRef={toggle}
      registerInput={(rowId, element) => {
        if (element) inputs.current.set(rowId, element);
        else inputs.current.delete(rowId);
      }}
      onToggle={() => setIsOpen(!isOpen)}
      onClose={() => {
        setIsOpen(false);
        toggle.current?.focus();
      }}
      onSubmit={saveLinks}
      onUrlChange={updateUrl}
      onInterestChange={(rowId, interest) =>
        setRows((current) =>
          current.map((row) => (row.id === rowId ? { ...row, interest } : row)),
        )
      }
    />
  );
}
