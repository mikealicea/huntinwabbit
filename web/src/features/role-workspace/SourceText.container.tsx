'use client';
import { useRef, useState } from 'react';
import {
  type SavedPosting,
  sourceTextSchema,
  useExtractPostingMutation,
  useSourceTextQuery,
} from '@/features/job-api/job-api.index';
import { SourceText } from './SourceText.component';

type Draft = { text: string; version: number; generation: string | null };
export function SourceTextContainer({
  posting,
  open,
  disabled,
  onClose,
}: {
  posting: SavedPosting;
  open: boolean;
  disabled: boolean;
  onClose: () => void;
}) {
  const query = useSourceTextQuery(posting.id, {
    skip: !open,
    refetchOnMountOrArgChange: true,
  });
  const [extract, mutation] = useExtractPostingMutation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const request = useRef<{ key: string; operationId: string } | null>(null);
  const data = query.currentData;
  const text = draft?.text ?? data?.source?.text ?? '';
  const pending = ['queued', 'processing'].includes(posting.extraction.status);
  function baseline(value: string): Draft {
    return {
      text: value,
      version: data?.applicationVersion ?? posting.applicationVersion,
      generation: data ? data.generation : posting.extraction.generation,
    };
  }
  async function submit(sourceText: string | null) {
    if (!data || disabled || pending || mutation.isLoading || conflict) return;
    if (
      sourceText !== null &&
      !sourceTextSchema.safeParse(sourceText).success
    ) {
      setError(
        'Page text must be at most 100,000 characters and 256 KiB. Shorten it before saving.',
      );
      return;
    }
    const reviewed = draft ?? baseline(text);
    const body = {
      sourceText,
      expectedApplicationVersion: reviewed.version,
      expectedGeneration: reviewed.generation,
    };
    const key = JSON.stringify(body);
    if (request.current?.key !== key)
      request.current = { key, operationId: crypto.randomUUID() };
    // Keep the original baseline and operation ID after uncertain acknowledgements.
    setDraft(reviewed);
    setError('');
    try {
      await extract({
        id: posting.id,
        ...body,
        operationId: request.current.operationId,
      }).unwrap();
      setDraft(null);
      request.current = null;
      onClose();
    } catch (cause) {
      const isConflict =
        typeof cause === 'object' &&
        cause !== null &&
        'status' in cause &&
        cause.status === 409;
      setConflict(isConflict);
      setError(
        isConflict
          ? 'This role changed. Review its latest version before applying your draft.'
          : 'Saving could not be confirmed. Your draft is retained; retrying the same submission is safe.',
      );
    }
  }
  return (
    <SourceText
      open={open}
      loading={!data}
      saving={mutation.isLoading}
      disabled={disabled || pending}
      text={text}
      hasSavedText={!!data?.source}
      mismatch={!!data?.source && data.source.sourceUrl !== posting.sourceUrl}
      error={
        error || (query.error ? 'Saved page text could not be loaded.' : '')
      }
      conflict={conflict}
      onChange={(value) => {
        setDraft((current) =>
          current ? { ...current, text: value } : baseline(value),
        );
        setError('');
      }}
      onSave={() => void submit(text)}
      onRemove={() => void submit(null)}
      onReview={() => {
        void query.refetch().then((result) => {
          if (!result.data) return;
          const latest = result.data;
          setDraft((current) => ({
            text: current?.text ?? text,
            version: latest.applicationVersion,
            generation: latest.generation,
          }));
          request.current = null;
          setConflict(false);
          setError(
            'Latest version loaded. Review your draft, then submit again.',
          );
        });
      }}
      onRetry={() => void query.refetch()}
      onClose={onClose}
    />
  );
}
