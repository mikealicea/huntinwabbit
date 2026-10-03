import { useEffect, useId, useRef, useState } from 'react';
import {
  INTERVIEW_STAGE_LIMIT,
  INTERVIEW_STAGE_NAME_LIMIT,
  type InterviewProcess,
  validUpdateText,
} from '@/features/job-api/job-api.index';

export function InterviewSetup({
  initial,
  busy,
  error,
  onClose,
  onSave,
  onTranscript,
}: {
  initial: InterviewProcess | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (process: InterviewProcess | null) => Promise<void>;
  onTranscript: (text: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [mode, setMode] = useState<'manual' | 'transcript'>(
    initial ? 'manual' : 'transcript',
  );
  const [stages, setStages] = useState(initial?.stages ?? []);
  const [current, setCurrent] = useState(initial?.currentStageId ?? '');
  const [text, setText] = useState('');
  const [validation, setValidation] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  function add() {
    const stage = { id: crypto.randomUUID(), name: '' };
    setStages((previous) => [...previous, stage]);
  }
  function reorder(index: number, offset: number) {
    setStages((previous) => {
      const result = [...previous];
      [result[index], result[index + offset]] = [
        result[index + offset],
        result[index],
      ];
      return result;
    });
  }
  async function save() {
    if (busy) return;
    if (mode === 'transcript') {
      if (!validUpdateText(text)) {
        setValidation(
          'Enter a transcript of up to 100,000 characters and 256 KiB.',
        );
        return;
      }
      setValidation('');
      await onTranscript(text.trim());
      return;
    }
    if (current && !stages.some((stage) => stage.id === current)) {
      setValidation(
        'The current stage was removed. Choose another stage or leave the card unassigned.',
      );
      return;
    }
    if (!stages.length) {
      if (initial) {
        setValidation('');
        await onSave(null);
      } else setValidation('Add at least one stage.');
      return;
    }
    if (
      stages.length > INTERVIEW_STAGE_LIMIT ||
      stages.some(
        (stage) =>
          !stage.name.trim() ||
          stage.name.trim().length > INTERVIEW_STAGE_NAME_LIMIT,
      )
    ) {
      setValidation(
        'Give every stage a name of 1–120 characters. Use at most 20 stages.',
      );
      return;
    }
    setValidation('');
    await onSave({
      stages: stages.map((stage) => ({ ...stage, name: stage.name.trim() })),
      currentStageId: current || null,
    });
  }
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
    >
      <div className="modal-box w-full max-w-2xl">
        <h2 id={`${id}-title`} className="text-xl font-bold">
          {initial ? 'Edit interview stages' : 'Set up interview stages'}
        </h2>
        <fieldset
          className="my-4 flex flex-wrap gap-2"
          aria-label="Set up using"
        >
          <button
            type="button"
            className={`btn min-h-11 ${mode === 'transcript' ? 'btn-primary' : ''}`}
            aria-pressed={mode === 'transcript'}
            disabled={busy}
            onClick={() => {
              setMode('transcript');
              setValidation('');
            }}
          >
            Paste transcript
          </button>
          <button
            type="button"
            className={`btn min-h-11 ${mode === 'manual' ? 'btn-primary' : ''}`}
            aria-pressed={mode === 'manual'}
            disabled={busy}
            onClick={() => {
              setMode('manual');
              setValidation('');
            }}
          >
            Enter stages manually
          </button>
        </fieldset>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {mode === 'transcript' ? (
            <>
              <label
                htmlFor={`${id}-transcript`}
                className="mb-2 block font-medium"
              >
                Recruiter transcript
              </label>
              <textarea
                id={`${id}-transcript`}
                className="textarea min-h-64 w-full text-base"
                value={text}
                disabled={busy}
                onChange={(event) => setText(event.target.value)}
                aria-describedby={`${id}-help`}
              />
              <p
                id={`${id}-help`}
                className="mt-2 text-sm text-base-content/75"
              >
                Up to 100,000 characters (256 KiB). Redpill processes this text.
                Clear interview stages save automatically; review or undo them
                in Update history. The transcript is saved with that history.
              </p>
            </>
          ) : (
            <>
              <ol className="space-y-3">
                {stages.map((stage, index) => (
                  <li
                    key={stage.id}
                    className="rounded-lg border border-base-300 p-3"
                  >
                    <label className="block">
                      <span className="mb-1 block text-sm">
                        Stage {index + 1}
                      </span>
                      <input
                        className="input min-h-11 w-full text-base"
                        maxLength={INTERVIEW_STAGE_NAME_LIMIT}
                        value={stage.name}
                        disabled={busy}
                        onChange={(event) => {
                          const name = event.target.value;
                          setStages((previous) =>
                            previous.map((item) =>
                              item.id === stage.id ? { ...item, name } : item,
                            ),
                          );
                        }}
                      />
                    </label>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        className="btn btn-sm min-h-11"
                        type="button"
                        aria-label={`Move stage ${index + 1} up`}
                        disabled={busy || index === 0}
                        onClick={() => reorder(index, -1)}
                      >
                        ↑ Up
                      </button>
                      <button
                        className="btn btn-sm min-h-11"
                        type="button"
                        aria-label={`Move stage ${index + 1} down`}
                        disabled={busy || index === stages.length - 1}
                        onClick={() => reorder(index, 1)}
                      >
                        ↓ Down
                      </button>
                      <button
                        className="btn btn-ghost btn-sm min-h-11"
                        type="button"
                        aria-label={`Remove stage ${index + 1}`}
                        disabled={busy}
                        onClick={() =>
                          setStages((previous) =>
                            previous.filter((item) => item.id !== stage.id),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              <button
                className="btn my-3 min-h-11"
                type="button"
                disabled={busy || stages.length >= INTERVIEW_STAGE_LIMIT}
                onClick={add}
              >
                Add stage
              </button>
              <label className="fieldset p-0">
                <span className="fieldset-legend">Current stage</span>
                <select
                  className="select min-h-11 w-full text-base"
                  disabled={busy}
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                >
                  <option value="">Leave card unassigned</option>
                  {current && !stages.some((stage) => stage.id === current) && (
                    <option value={current} disabled>
                      Removed stage — choose a position
                    </option>
                  )}
                  {stages.map((stage, index) => (
                    <option value={stage.id} key={stage.id}>
                      {stage.name || `Stage ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {(validation || error) && (
            <p role="alert" className="mt-3">
              {validation || error}
            </p>
          )}
          <div className="modal-action flex-wrap">
            <button
              type="button"
              className="btn min-h-11"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary min-h-11"
              disabled={busy}
            >
              {busy
                ? 'Saving…'
                : mode === 'transcript'
                  ? 'Extract interview stages'
                  : 'Save stages'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
