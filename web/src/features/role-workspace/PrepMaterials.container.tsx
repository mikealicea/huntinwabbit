'use client';
import {
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLazyPrepContextQuery } from '@/features/job-api/job-api.index';
import { PrepMaterials } from './PrepMaterials.component';
import { formatPrepMaterials, type PrepFilename } from './role-workspace.prep';
import { buildPrepArchive } from './role-workspace.prep-archive';

type PrepRequest = { abort: () => void; unsubscribe: () => void };
type PrepLifetime = { roleId: string; stageId: string; disabled: boolean };

function acquisitionMessage(error: unknown): string {
  // The aggregate loader supplies fixed, source-labeled messages, never response bodies.
  if (typeof error === 'object' && error !== null) {
    if (
      'data' in error &&
      typeof error.data === 'object' &&
      error.data !== null
    ) {
      if ('message' in error.data && typeof error.data.message === 'string')
        return error.data.message;
    }
    if (
      'status' in error &&
      error.status === 'CUSTOM_ERROR' &&
      'error' in error &&
      typeof error.error === 'string'
    )
      return error.error;
  }
  return 'Could not prepare the export. No export was created. Try again.';
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | undefined;
  try {
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
  } finally {
    // Keep the URL alive until the browser has handled the initiated download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    anchor?.remove();
  }
}

export function PrepMaterialsContainer({
  roleId,
  stageId,
  disabled,
}: {
  roleId: string;
  stageId: string;
  disabled: boolean;
}): ReactNode {
  const [prepare, result] = useLazyPrepContextQuery();
  const { reset } = result;
  const request = useRef<PrepRequest | null>(null);
  const inFlight = useRef(false);
  const lifetime = useRef<PrepLifetime | null>(null);
  const feedbackOperation = useRef(0);
  const [feedback, setFeedback] = useState({ error: '', status: '' });

  useLayoutEffect(() => {
    // A layout cleanup resets the lazy result before its own passive unsubscribe.
    // It also invalidates pending clipboard feedback before the next target is usable.
    lifetime.current = { roleId, stageId, disabled };
    setFeedback({ error: '', status: '' });
    return () => {
      lifetime.current = null;
      feedbackOperation.current += 1;
      request.current?.abort();
      request.current?.unsubscribe();
      request.current = null;
      inFlight.current = false;
      reset();
    };
  }, [roleId, stageId, disabled, reset]);

  const matching =
    !disabled &&
    result.originalArgs?.roleId === roleId &&
    result.originalArgs.stageId === stageId;
  const context =
    matching && result.isSuccess && !result.isFetching
      ? result.currentData
      : undefined;
  const materials = useMemo(
    () => (context ? formatPrepMaterials(context) : null),
    [context],
  );

  function start() {
    if (disabled || inFlight.current) return;
    feedbackOperation.current += 1;
    setFeedback({ error: '', status: '' });
    request.current?.unsubscribe();
    reset();
    inFlight.current = true;
    const pending = prepare({ roleId, stageId }, false);
    request.current = pending;
    void pending.then(() => {
      if (request.current === pending) inFlight.current = false;
    });
  }

  async function copy(filename: PrepFilename) {
    const selected = materials?.documents.find(
      (item) => item.filename === filename,
    );
    if (disabled || !selected) return;
    const instance = lifetime.current;
    const operation = ++feedbackOperation.current;
    setFeedback({ error: '', status: '' });
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(selected.markdown);
      if (
        lifetime.current === instance &&
        feedbackOperation.current === operation
      )
        setFeedback({ error: '', status: `${filename} copied.` });
    } catch {
      if (
        lifetime.current === instance &&
        feedbackOperation.current === operation
      )
        setFeedback({
          error: `Could not copy ${filename}. Download that Markdown document instead.`,
          status: '',
        });
    }
  }

  function downloadDocument(filename: PrepFilename) {
    const selected = materials?.documents.find(
      (item) => item.filename === filename,
    );
    if (disabled || !selected) return;
    feedbackOperation.current += 1;
    setFeedback({ error: '', status: '' });
    try {
      download(
        new Blob([selected.markdown], { type: 'text/markdown;charset=utf-8' }),
        selected.downloadFilename,
      );
    } catch {
      setFeedback({
        error: `Could not download ${filename}. Try again or copy that document.`,
        status: '',
      });
    }
  }

  function downloadArchive() {
    if (disabled || !materials) return;
    feedbackOperation.current += 1;
    setFeedback({ error: '', status: '' });
    try {
      download(
        buildPrepArchive(materials.documents),
        materials.archiveFilename,
      );
    } catch {
      setFeedback({
        error:
          'Could not download the ZIP. Try again or download the Markdown documents individually.',
        status: '',
      });
    }
  }

  return (
    <PrepMaterials
      loading={matching && result.isFetching}
      ready={materials !== null}
      disabled={disabled}
      error={
        matching && result.isError
          ? acquisitionMessage(result.error)
          : feedback.error
      }
      status={feedback.status}
      startedAt={context?.startedAt}
      completedAt={context?.completedAt}
      documents={materials?.documents ?? []}
      onPrepare={start}
      onDownloadArchive={downloadArchive}
      onDownloadDocument={downloadDocument}
      onCopyDocument={(filename) => void copy(filename)}
    />
  );
}
