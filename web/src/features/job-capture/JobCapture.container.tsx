'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { useSavePostingMutation } from '@/features/job-api/job-api.index';
import { JobCapture } from './JobCapture.component';
import { type CaptureRow, validateCapture } from './job-capture.validation';

export function JobCaptureContainer() {
  const [savePosting] = useSavePostingMutation();
  const [saving, setSaving] = useState(false);
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
    if (isOpen && !saving) inputs.current.values().next().value?.focus();
  }, [isOpen, saving]);

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

  async function saveLinks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const result = validateCapture(rows);
    setErrors(result.errors);
    const firstInvalid = rows.find((row) => result.errors[row.id]);
    if (firstInvalid) {
      inputs.current.get(firstInvalid.id)?.focus();
      return;
    }
    setSaving(true);
    let saved = 0;
    let duplicates = 0;
    const succeeded = new Set<number>();
    const failures: Record<number, string> = {};
    for (const row of rows.filter((row) => row.url.trim())) {
      setNotice(
        `Saving link ${saved + duplicates + Object.keys(failures).length + 1} of ${result.links.length}…`,
      );
      try {
        const response = await savePosting({
          url: row.url,
          application: { interest: row.interest },
          extract: true,
        }).unwrap();
        if (response.created) saved++;
        else duplicates++;
        succeeded.add(row.id);
      } catch {
        failures[row.id] =
          'This link could not be saved. Try again; repeated saves do not create duplicates.';
      }
    }
    setRows((current) => current.filter((row) => !succeeded.has(row.id)));
    setErrors(failures);
    setNotice(
      `${saved} saved. ${duplicates} already saved.${Object.keys(failures).length ? ' Some links need another try.' : ' Posting details will appear as extraction finishes.'}`,
    );
    setSaving(false);
  }

  return (
    <JobCapture
      saving={saving}
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
