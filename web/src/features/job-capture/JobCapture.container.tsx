'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import {
  useSavePostingMutation,
  useSourceGuidanceQuery,
} from '@/features/job-api/job-api.index';
import { JobCapture } from './JobCapture.component';
import {
  type CaptureRow,
  captureHostname,
  pageTextError,
  validateCapture,
} from './job-capture.validation';

export function JobCaptureContainer() {
  const [savePosting] = useSavePostingMutation();
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<CaptureRow[]>([
    { id: 0, url: '', interest: 'not-set' },
  ]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const [shownGuidance, setShownGuidance] = useState<{
    rowId: number;
    hostname: string;
  } | null>(null);
  const activeHostname = captureHostname(
    rows.find((row) => row.id === activeRow)?.url ?? '',
  );
  const [lookupHostname, setLookupHostname] = useState('');
  const suggested = useRef(new Map<number, string>());
  const focusText = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => setLookupHostname(activeHostname), 300);
    return () => clearTimeout(timer);
  }, [activeHostname]);
  const { currentData: guidance } = useSourceGuidanceQuery(lookupHostname, {
    skip:
      !isOpen || saving || !lookupHostname || lookupHostname !== activeHostname,
    refetchOnMountOrArgChange: 60,
  });
  const recommendedRow =
    isOpen &&
    activeHostname &&
    guidance?.hostname === activeHostname &&
    guidance.recommendSourceText &&
    (focusedRow === activeRow ||
      (shownGuidance?.rowId === activeRow &&
        shownGuidance.hostname === activeHostname))
      ? activeRow
      : null;
  useEffect(() => {
    if (recommendedRow === null || focusedRow !== recommendedRow || saving)
      return;
    // Keep a displayed hint in place on blur so pointer clicks below it don't move.
    setShownGuidance((current) =>
      current?.rowId === recommendedRow && current.hostname === activeHostname
        ? current
        : { rowId: recommendedRow, hostname: activeHostname },
    );
    if (suggested.current.get(recommendedRow) === activeHostname) return;
    suggested.current.set(recommendedRow, activeHostname);
    focusText.current = false;
    setExpandedRow(recommendedRow);
  }, [recommendedRow, activeHostname, focusedRow, saving]);
  const texts = useRef(new Map<number, HTMLTextAreaElement>());
  useEffect(() => {
    if (expandedRow !== null && focusText.current)
      texts.current.get(expandedRow)?.focus();
    focusText.current = false;
  }, [expandedRow]);
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
    if (
      captureHostname(rows.find((row) => row.id === rowId)?.url ?? '') !==
      captureHostname(url)
    )
      suggested.current.delete(rowId);
    setErrors((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
    // Allocate IDs outside the updater: React may replay state updaters.
    const newRowId = rowSequence.current++;
    setRows((current) => {
      const updated = current.map((row) =>
        row.id === rowId ? { ...row, url, existingId: undefined } : row,
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
      if (pageTextError(firstInvalid.sourceText ?? '')) {
        focusText.current = true;
        setExpandedRow(firstInvalid.id);
        texts.current.get(firstInvalid.id)?.focus();
      } else inputs.current.get(firstInvalid.id)?.focus();
      return;
    }
    setSaving(true);
    let saved = 0;
    let duplicates = 0;
    const succeeded = new Set<number>();
    const failures: Record<number, string> = {};
    const existing = new Map<number, string>();
    for (const row of rows.filter((row) => row.url.trim())) {
      setNotice(
        `Saving link ${saved + duplicates + Object.keys(failures).length + 1} of ${result.links.length}…`,
      );
      try {
        const response = await savePosting({
          url: row.url,
          application: { interest: row.interest },
          extract: true,
          ...(row.sourceText?.trim() ? { sourceText: row.sourceText } : {}),
        }).unwrap();
        if (response.created) saved++;
        else duplicates++;
        if (!response.created && row.sourceText?.trim()) {
          existing.set(row.id, response.item.id);
        } else succeeded.add(row.id);
      } catch {
        failures[row.id] =
          'This link could not be saved. Try again; repeated saves do not create duplicates.';
      }
    }
    setRows((current) =>
      current
        .filter((row) => !succeeded.has(row.id))
        .map((row) =>
          existing.has(row.id)
            ? { ...row, existingId: existing.get(row.id) }
            : row,
        ),
    );
    setExpandedRow(null);
    setErrors(failures);
    setNotice(
      `${saved} saved. ${duplicates} already saved.${Object.keys(failures).length ? ' Some links need another try.' : ' Posting details will appear as extraction finishes.'}`,
    );
    setSaving(false);
  }

  return (
    <JobCapture
      saving={saving}
      expandedRow={expandedRow}
      recommendedRow={recommendedRow}
      onRowFocus={(rowId) => {
        setFocusedRow(rowId);
        if (rowId !== null) setActiveRow(rowId);
      }}
      onExpandedRowChange={(rowId) => {
        if (expandedRow !== null) {
          const row = rows.find((item) => item.id === expandedRow);
          suggested.current.set(expandedRow, captureHostname(row?.url ?? ''));
        }
        focusText.current = rowId !== null;
        setExpandedRow(rowId);
      }}
      registerText={(rowId, element) => {
        if (element) texts.current.set(rowId, element);
        else texts.current.delete(rowId);
      }}
      onSourceTextChange={(rowId, sourceText) => {
        setErrors((current) => {
          const next = { ...current };
          delete next[rowId];
          return next;
        });
        setRows((current) =>
          current.map((row) =>
            row.id === rowId ? { ...row, sourceText } : row,
          ),
        );
      }}
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
