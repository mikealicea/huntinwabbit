import type { PrepFilename } from './role-workspace.prep';

export type PrepMaterialsProps = {
  loading: boolean;
  ready: boolean;
  disabled: boolean;
  error: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  documents: readonly { filename: PrepFilename; title: string }[];
  onPrepare: () => void;
  onDownloadArchive: () => void;
  onDownloadDocument: (filename: PrepFilename) => void;
  onCopyDocument: (filename: PrepFilename) => void;
};

export function PrepMaterials({
  loading,
  ready,
  disabled,
  error,
  status,
  startedAt,
  completedAt,
  documents,
  onPrepare,
  onDownloadArchive,
  onDownloadDocument,
  onCopyDocument,
}: PrepMaterialsProps) {
  return (
    <section aria-label="Prep materials" className="space-y-3">
      <h3 className="font-semibold">Prep materials</h3>
      <p className="text-sm text-base-content/75">
        Creates three Markdown documents: job listing, company context, and role
        context. Includes saved information only. Review personal information
        before sharing with an external service.
      </p>
      <div className="flex flex-wrap gap-2">
        {ready && (
          <button
            type="button"
            className="btn btn-primary min-h-11 h-auto min-w-0 max-w-full whitespace-normal break-words px-3 py-2"
            disabled={disabled}
            onClick={onDownloadArchive}
          >
            Download all (.zip)
          </button>
        )}
        <button
          type="button"
          className="btn min-h-11 h-auto min-w-0 max-w-full whitespace-normal break-words px-3 py-2"
          disabled={disabled || loading}
          onClick={onPrepare}
        >
          {ready
            ? 'Export again'
            : error
              ? 'Retry export'
              : 'Export prep materials'}
        </button>
      </div>
      <p role="status" className="text-sm" aria-atomic="true">
        {loading
          ? 'Preparing export…'
          : status || (ready ? 'Three prep documents ready.' : '')}
      </p>
      {error && <p role="alert">{error}</p>}
      {ready && (
        <>
          <p className="break-words text-sm text-base-content/75">
            Collected from <time dateTime={startedAt}>{startedAt}</time> to{' '}
            <time dateTime={completedAt}>{completedAt}</time> (UTC). Saved reads
            over this interval are not an atomic snapshot. Export again after
            saving more context.
          </p>
          <ul className="space-y-3">
            {documents.map(({ filename, title }) => (
              <li
                key={filename}
                className="min-w-0 space-y-2 rounded-box border border-base-content/20 p-3"
              >
                <div className="min-w-0">
                  <h4 className="break-words font-semibold">{title}</h4>
                  <p className="break-all font-mono text-sm">{filename}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn min-h-11 h-auto min-w-0 max-w-full whitespace-normal break-words px-3 py-2"
                    aria-label={`Download Markdown: ${filename}`}
                    disabled={disabled}
                    onClick={() => onDownloadDocument(filename)}
                  >
                    Download Markdown
                  </button>
                  <button
                    type="button"
                    className="btn min-h-11 h-auto min-w-0 max-w-full whitespace-normal break-words px-3 py-2"
                    aria-label={`Copy Markdown: ${filename}`}
                    disabled={disabled}
                    onClick={() => onCopyDocument(filename)}
                  >
                    Copy Markdown
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
