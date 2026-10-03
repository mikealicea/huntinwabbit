import type { ReactNode, Ref } from 'react';
import type { InterviewProcess as Process } from '@/features/job-api/job-api.index';

export function InterviewProcess({
  process,
  busy,
  message,
  error,
  onSetup,
  onMove,
  children,
  setup,
}: {
  process: Process | null;
  busy: boolean;
  message: string;
  error: string;
  onSetup: () => void;
  onMove: (id: string) => void;
  children: ReactNode;
  setup: ReactNode;
}) {
  return (
    <section
      className="card mb-7 min-w-0 border border-base-300 bg-base-100 shadow-sm"
      aria-labelledby="interview-process-title"
    >
      <div className="card-body min-w-0 gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="interview-process-title" className="card-title">
            Interview process
          </h2>
          <button
            id="interview-setup"
            className="btn min-h-11"
            type="button"
            disabled={busy}
            onClick={onSetup}
          >
            {process ? 'Edit stages' : 'Set up interview stages'}
          </button>
        </div>
        {!process ? (
          <p className="text-sm text-base-content/75">
            Add the stages for this role, or paste your recruiter transcript to
            fill them in.
          </p>
        ) : (
          <>
            <label className="fieldset max-w-sm p-0">
              <span className="fieldset-legend py-1">Move to stage</span>
              <select
                className="select min-h-11 w-full text-base"
                value={process.currentStageId ?? ''}
                disabled={busy}
                onChange={(event) => onMove(event.target.value)}
              >
                <option value="" disabled>
                  Choose current stage
                </option>
                {process.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </label>
            <p
              id="interview-move-help"
              className="text-sm text-base-content/75"
            >
              Drag your card between stages, or use Move to stage.
            </p>
            {children}
          </>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
      </div>
      {setup}
    </section>
  );
}

export function InterviewColumn({
  stageId,
  name,
  selected,
  active,
  dropRef,
  children,
  onOpen,
}: {
  stageId: string;
  name: string;
  selected: boolean;
  active: boolean;
  dropRef: Ref<HTMLDivElement>;
  children: ReactNode;
  onOpen?: () => void;
}) {
  return (
    <div
      ref={dropRef}
      data-stage-id={stageId}
      data-current={selected || undefined}
      className={`min-h-44 w-60 shrink-0 rounded-xl border p-3 ${active ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-200/50'}`}
    >
      <h3 aria-label={name} className="mb-3 break-words font-semibold">
        {onOpen ? (
          <button
            type="button"
            className="w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            onClick={onOpen}
            aria-label={`Open ${name} notes and details`}
          >
            <span className="block">{name}</span>
            <span className="mt-1 block text-xs font-normal text-base-content/75">
              Notes &amp; details →
            </span>
          </button>
        ) : (
          name
        )}
      </h3>
      {children}
    </div>
  );
}

export function InterviewCard({
  title,
  company,
  busy,
  dragging,
  cardRef,
  handleRef,
}: {
  title: string;
  company: string;
  busy: boolean;
  dragging: boolean;
  cardRef: Ref<HTMLElement>;
  handleRef: Ref<HTMLButtonElement>;
}) {
  return (
    <article
      ref={cardRef}
      aria-label="Current interview card"
      className={`rounded-lg border border-base-300 bg-base-100 p-3 shadow-sm ${dragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm text-base-content/75">{company}</p>
          <p className="mt-1 break-words font-medium">{title}</p>
        </div>
        <button
          id="interview-move"
          ref={handleRef}
          type="button"
          disabled={busy}
          className="btn btn-ghost min-h-11 min-w-11 touch-none cursor-grab px-2"
          aria-label="Move interview card"
          aria-describedby="interview-move-help"
        >
          ⠿
        </button>
      </div>
    </article>
  );
}
