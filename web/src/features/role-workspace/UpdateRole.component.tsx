import { useEffect, useId, useRef, useState } from 'react';
import type { UpdateEntry } from '@/features/job-api/job-api.index';

export interface UpdateRoleProps {
  entries: UpdateEntry[];
  pending: boolean;
  loading: boolean;
  error?: string;
  hasOlder: boolean;
  onOlder: () => void;
  onReload: () => void;
  onSend: (text: string) => Promise<boolean>;
  onUndo: (id: string) => void;
  onRetry: (entry: UpdateEntry) => void;
}
const labels: Record<string, string> = {
  companyName: 'Company',
  companyWebsite: 'Company website',
  sourceUrl: 'Posting link',
  workArrangement: 'Work arrangement',
  employmentType: 'Employment type',
  preferredQualifications: 'Preferred qualifications',
  postingId: 'Posting ID',
  publishedDate: 'Published date',
  closingDate: 'Closing date',
  followUpOn: 'Follow-up',
  compensation: 'Compensation',
};
function valueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (Array.isArray(value))
    return value.length ? value.map(valueText).join('; ') : 'None';
  if (typeof value === 'object')
    return Object.entries(value)
      .filter(([, entry]) => entry !== null)
      .map(([key, entry]) => `${key}: ${valueText(entry)}`)
      .join(', ');
  return String(value);
}
export function UpdateRole({
  entries,
  pending,
  loading,
  error,
  hasOlder,
  onOlder,
  onReload,
  onSend,
  onUndo,
  onRetry,
}: UpdateRoleProps) {
  const [text, setText] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const id = useId();
  const desktopHistory = useRef<HTMLDivElement>(null);
  const mobileHistory = useRef<HTMLDivElement>(null);
  const previousNewest = useRef<{ id?: string; status?: string }>({});
  const newest = entries.at(-1);
  const newestId = newest?.id;
  const newestStatus = newest?.status;
  useEffect(() => {
    for (const history of [desktopHistory.current, mobileHistory.current]) {
      if (
        history &&
        (previousNewest.current.id !== newestId ||
          (previousNewest.current.status !== newestStatus &&
            history.scrollHeight - history.scrollTop - history.clientHeight <
              80))
      )
        history.scrollTop = history.scrollHeight;
    }
    previousNewest.current = { id: newestId, status: newestStatus };
  }, [newestId, newestStatus]);
  async function send() {
    const draft = text;
    if (pending || !draft.trim()) return;
    if (await onSend(draft))
      setText((current) => (current === draft ? '' : current));
  }
  function content(mobile: boolean) {
    const suffix = mobile ? 'mobile' : 'desktop';
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id={`${id}-${suffix}-title`} className="card-title">
            Update role
          </h2>
          {mobile && (
            <button
              type="button"
              className="btn btn-ghost min-h-11"
              onClick={() => dialog.current?.close()}
            >
              Close
            </button>
          )}
        </div>
        <p className="text-sm text-base-content/75">
          Type a change or paste an email. Clear changes save automatically, and
          you can undo them.
        </p>
        <div
          className="min-h-32 flex-1 space-y-4 overflow-y-auto break-words lg:max-h-[55vh]"
          ref={mobile ? mobileHistory : desktopHistory}
          role="log"
          aria-label="Update history"
        >
          {hasOlder && (
            <button
              type="button"
              className="btn btn-sm min-h-11"
              disabled={loading}
              onClick={onOlder}
            >
              Load older messages
            </button>
          )}
          {!entries.length && !loading && (
            <p className="text-sm text-base-content/75">
              Try “Salary is $150k–$180k USD per year” or “I applied today; set
              priority to high.”
            </p>
          )}
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="space-y-3 border-b border-base-300 pb-4"
            >
              <p className="whitespace-pre-wrap rounded-xl bg-base-200 p-3">
                {entry.text}
              </p>
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  {entry.undoneAt
                    ? 'Changes undone'
                    : entry.status === 'queued'
                      ? 'Waiting to update…'
                      : entry.status === 'processing'
                        ? 'Updating role…'
                        : entry.status === 'partial'
                          ? 'Some changes saved'
                          : entry.status === 'applied'
                            ? 'Changes saved'
                            : entry.status === 'failed'
                              ? 'Update failed'
                              : 'No changes made'}
                </p>
                {entry.changes.length > 0 && (
                  <ul className="space-y-2">
                    {entry.changes.map((change) => (
                      <li key={change.field}>
                        <strong>
                          {labels[change.field] ??
                            change.field[0].toUpperCase() +
                              change.field.slice(1)}
                          :
                        </strong>{' '}
                        {valueText(change.before)} → {valueText(change.after)}
                      </li>
                    ))}
                  </ul>
                )}
                {[...new Set(entry.skipped)].map((reason) => (
                  <p key={reason}>Not changed: {reason}</p>
                ))}
                {entry.error && <p>{entry.error}</p>}
                {!entry.undoneAt && entry.changes.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm min-h-11"
                    disabled={pending}
                    onClick={() => onUndo(entry.id)}
                  >
                    Undo changes
                  </button>
                )}
                {entry.status === 'failed' && (
                  <button
                    type="button"
                    className="btn btn-sm min-h-11"
                    disabled={pending}
                    onClick={() => onRetry(entry)}
                  >
                    Retry update
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        <p role="status" className="text-sm">
          {loading
            ? 'Loading history…'
            : pending
              ? 'An update is in progress. You can leave and return.'
              : entries.length
                ? 'Update history is saved with this role.'
                : ''}
        </p>
        {error && (
          <div role="alert" className="text-sm">
            <p>{error}</p>
            <button
              type="button"
              className="btn btn-sm mt-2 min-h-11"
              onClick={onReload}
            >
              Refresh role and history
            </button>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="space-y-2"
        >
          <label
            className="block text-sm font-medium"
            htmlFor={`${id}-${suffix}-message`}
          >
            Your update
          </label>
          <textarea
            id={`${id}-${suffix}-message`}
            className="textarea min-h-28 w-full text-base"
            maxLength={20000}
            value={text}
            placeholder="The role is remote, and the salary is…"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-base-content/75">
              Text is processed by Redpill. Shift+Enter adds a line.
            </p>
            <button
              type="submit"
              className="btn btn-primary min-h-11"
              disabled={pending || !text.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        className="btn btn-primary order-first w-full lg:hidden"
        ref={opener}
        onClick={() => {
          dialog.current?.showModal();
          dialog.current?.querySelector('textarea')?.focus();
        }}
      >
        Update role
      </button>
      <section
        className="card hidden border border-base-300 bg-base-100 shadow-sm lg:flex"
        aria-labelledby={`${id}-desktop-title`}
      >
        {content(false)}
      </section>
      <dialog
        ref={dialog}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-base-100 text-base-content backdrop:bg-black/40"
        aria-labelledby={`${id}-mobile-title`}
        onClose={() => opener.current?.focus()}
      >
        <div className="flex h-full min-h-0 flex-col">{content(true)}</div>
      </dialog>
    </>
  );
}
