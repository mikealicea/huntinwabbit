import {
  formatSalary,
  type Opportunity,
} from '@/features/job-search/job-search.index';

export function JobDetails({
  role,
  onExtract,
  extracting,
}: {
  role: Opportunity;
  onExtract?: () => void;
  extracting?: boolean;
}) {
  const posting = role.posting;
  return (
    <section
      className="card border border-base-300 bg-base-100 shadow-sm"
      aria-labelledby="job-details-title"
    >
      <div className="card-body gap-4 p-5 sm:p-6">
        <h2 id="job-details-title" className="card-title">
          Job details
        </h2>
        {posting ? (
          <>
            <p className="text-sm text-base-content/75">
              {posting.location || 'Location not listed'} ·{' '}
              {posting.employmentType || 'Employment type not listed'}
            </p>
            <p className="leading-relaxed">
              {posting.description || 'Description not listed'}
            </p>
            {posting.requirements.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Requirements</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                  {posting.requirements.map((requirement) => (
                    <li key={requirement}>{requirement}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="leading-relaxed text-base-content/75">
            Your link is collected. Job title, company, location, and posting
            details have not been extracted yet.
          </p>
        )}
        <p className="rounded-lg bg-base-200 p-3 text-sm font-medium">
          {formatSalary(posting?.salary)}
        </p>
        {role.saved && (
          <div className="space-y-2">
            <p role="status">
              {role.saved.extraction.status === 'queued'
                ? 'Waiting to extract posting details…'
                : role.saved.extraction.status === 'processing'
                  ? 'Extracting posting details…'
                  : role.saved.extraction.status === 'failed'
                    ? 'Extraction could not finish. Your link is saved.'
                    : role.saved.extraction.status === 'disabled'
                      ? 'Extraction is currently unavailable. Your link is saved.'
                      : role.saved.extraction.status === 'complete'
                        ? 'Details extracted from the posting. Review them against the original.'
                        : 'Posting details have not been requested.'}
            </p>
            {onExtract &&
              ['not-requested', 'disabled', 'failed'].includes(
                role.saved.extraction.status,
              ) && (
                <button
                  type="button"
                  className="btn"
                  disabled={extracting}
                  onClick={onExtract}
                >
                  {extracting
                    ? 'Requesting extraction…'
                    : 'Extract posting details'}
                </button>
              )}
          </div>
        )}
        {role.saved?.parsedPosting && (
          <>
            <p>
              {role.saved.parsedPosting.job.workArrangement ??
                'Work arrangement not listed'}
            </p>
            {(
              [
                'responsibilities',
                'preferredQualifications',
                'benefits',
              ] as const
            ).map((field) =>
              role.saved?.parsedPosting?.job[field].length ? (
                <div key={field}>
                  <h3 className="font-semibold">
                    {field === 'preferredQualifications'
                      ? 'Preferred qualifications'
                      : field === 'responsibilities'
                        ? 'Responsibilities'
                        : 'Benefits'}
                  </h3>
                  <ul className="list-disc pl-5">
                    {[...new Set(role.saved.parsedPosting.job[field])].map(
                      (text) => (
                        <li key={text}>{text}</li>
                      ),
                    )}
                  </ul>
                </div>
              ) : null,
            )}
            {role.saved.parsedPosting.job.compensation.length > 0 && (
              <div>
                <h3 className="font-semibold">Compensation details</h3>
                <ul className="space-y-2">
                  {role.saved.parsedPosting.job.compensation.map((band) => (
                    <li key={JSON.stringify(band)}>
                      {band.originalText}
                      {band.location && ` · ${band.location}`}
                      {band.kind && ` · ${band.kind}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {role.sourceUrl && (
          <a
            href={role.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link inline-flex min-h-11 items-center text-sm"
          >
            Open original posting
            <span className="sr-only"> (opens in a new tab)</span>
            <span aria-hidden="true" className="ml-2">
              ↗
            </span>
          </a>
        )}
      </div>
    </section>
  );
}
