import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import type {
  CompanySelection,
  SavedCompany,
} from '@/features/job-api/job-api.index';
export function ChangeCompany({
  companies,
  pending,
  complete,
  conflict = false,
  feedback,
  onSearch,
  onSave,
  onClose,
}: {
  companies: SavedCompany[];
  conflict?: boolean;
  pending: boolean;
  complete: boolean;
  feedback: ReactNode;
  onSearch: (query: string) => void;
  onSave: (selection: CompanySelection['selection']) => Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const title = useId();
  const [selection, setSelection] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
    search.current?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={title}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={onClose}
    >
      <form
        className="modal-box"
        onSubmit={async (event) => {
          event.preventDefault();
          const value =
            selection === 'clear'
              ? null
              : selection === 'new'
                ? {
                    create: {
                      name: name.trim(),
                      website: website.trim() || null,
                    },
                  }
                : { id: selection };
          if (await onSave(value)) dialog.current?.close();
        }}
      >
        <h2 id={title} className="mb-3 text-xl font-bold">
          Change company
        </h2>
        <p className="mb-5 text-sm text-base-content/70">
          Your selection stays in place when this posting is refreshed.
        </p>
        <label className="fieldset block">
          <span className="fieldset-legend">Find a company</span>
          <input
            ref={search}
            className="input min-h-11 w-full text-base"
            type="search"
            value={query}
            disabled={pending}
            onChange={(event) => {
              setQuery(event.target.value);
              onSearch(event.target.value);
              setSelection('');
            }}
          />
        </label>
        {feedback}
        {conflict && (
          <p role="alert" className="my-3">
            The role changed. Close this dialog and review its current company
            before trying again.
          </p>
        )}
        <fieldset
          disabled={pending}
          className="my-3 max-h-60 space-y-1 overflow-auto"
        >
          <legend className="sr-only">Company selection</legend>
          {companies.map((company) => (
            <label
              key={company.id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-base-200"
            >
              <input
                className="radio radio-sm"
                type="radio"
                name="company"
                value={company.id}
                checked={selection === company.id}
                onChange={() => setSelection(company.id)}
              />
              <span className="min-w-0 break-words">
                {company.name}
                {company.website && (
                  <span className="block text-xs text-base-content/65">
                    {new URL(company.website).hostname}
                  </span>
                )}
              </span>
            </label>
          ))}
          {complete && !companies.length && (
            <p className="py-2 text-sm">No matching companies.</p>
          )}
          <label className="flex min-h-11 items-center gap-3 p-2">
            <input
              type="radio"
              className="radio radio-sm"
              name="company"
              checked={selection === 'new'}
              onChange={() => {
                setSelection('new');
                setName(query);
              }}
            />
            Create a company
          </label>
          <label className="flex min-h-11 items-center gap-3 p-2">
            <input
              type="radio"
              className="radio radio-sm"
              name="company"
              checked={selection === 'clear'}
              onChange={() => setSelection('clear')}
            />
            Leave unassigned
          </label>
        </fieldset>
        {selection === 'new' && (
          <div className="space-y-2">
            <label className="fieldset block">
              <span className="fieldset-legend">Company name</span>
              <input
                className="input min-h-11 w-full text-base"
                required
                maxLength={500}
                value={name}
                disabled={pending}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="fieldset block">
              <span className="fieldset-legend">Website (optional)</span>
              <input
                type="url"
                className="input min-h-11 w-full text-base"
                placeholder="https://example.com"
                maxLength={2048}
                value={website}
                disabled={pending}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>
        )}
        <div className="modal-action">
          <button
            className="btn min-h-11"
            type="button"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary min-h-11"
            disabled={
              conflict ||
              pending ||
              !selection ||
              (selection === 'new' && !name.trim())
            }
          >
            {pending ? 'Saving…' : 'Save company'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
