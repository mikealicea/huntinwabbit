import {
  formatSalary,
  type Opportunity,
} from '@/features/job-search/job-search.index';
import { LoadingPulse } from '@/shared/shared.index';

export function JobDetails({
  role,
  extracting,
}: {
  role: Opportunity;
  extracting?: boolean;
}) {
  const posting = role.posting;
  const details = role.jobDetails ?? role.saved?.parsedPosting?.job;
  const pending = ['queued', 'processing'].includes(
    role.saved?.extraction.status ?? '',
  );
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
              {(extracting || pending) && <LoadingPulse />}
              {extracting
                ? 'Requesting extraction…'
                : role.saved.extraction.status === 'queued'
                  ? posting
                    ? 'Waiting to refresh posting details…'
                    : 'Waiting to extract posting details…'
                  : role.saved.extraction.status === 'processing'
                    ? posting
                      ? 'Refreshing posting details…'
                      : 'Extracting posting details…'
                    : role.saved.extraction.status === 'failed'
                      ? posting
                        ? 'Refresh could not finish. Your previous details are still shown.'
                        : 'Extraction could not finish. Your link is saved.'
                      : role.saved.extraction.status === 'disabled'
                        ? 'Extraction is currently unavailable. Your link is saved.'
                        : role.saved.extraction.status === 'complete'
                          ? role.saved.edits &&
                            Object.keys(role.saved.edits.overrides).length
                            ? 'Your corrections are preserved when posting details refresh.'
                            : 'Details extracted from the posting. Review them against the original.'
                          : 'Posting details have not been requested.'}
            </p>
          </div>
        )}
        {details && (
          <>
            <p>{details.workArrangement ?? 'Work arrangement not listed'}</p>
            {(
              [
                'responsibilities',
                'preferredQualifications',
                'benefits',
              ] as const
            ).map((field) =>
              details[field].length ? (
                <div key={field}>
                  <h3 className="font-semibold">
                    {field === 'preferredQualifications'
                      ? 'Preferred qualifications'
                      : field === 'responsibilities'
                        ? 'Responsibilities'
                        : 'Benefits'}
                  </h3>
                  <ul className="list-disc pl-5">
                    {[...new Set(details[field])].map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
            <dl className="space-y-2 text-sm">
              {details.company.website && (
                <div>
                  <dt className="font-semibold">Company website</dt>
                  <dd>
                    <a
                      className="link break-all"
                      href={details.company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {details.company.website}
                    </a>
                  </dd>
                </div>
              )}
              {details.postingId && (
                <div>
                  <dt className="font-semibold">Posting ID</dt>
                  <dd>{details.postingId}</dd>
                </div>
              )}
              {details.publishedDate && (
                <div>
                  <dt className="font-semibold">Published</dt>
                  <dd>{details.publishedDate}</dd>
                </div>
              )}
              {details.closingDate && (
                <div>
                  <dt className="font-semibold">Closing date</dt>
                  <dd>{details.closingDate}</dd>
                </div>
              )}
            </dl>
            {details.compensation.length > 0 && (
              <div>
                <h3 className="font-semibold">Compensation details</h3>
                <ul className="space-y-2">
                  {details.compensation.map((band) => (
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
        {role.saved?.parsedPosting &&
          role.saved.parsedPosting.source.normalizedUrl !== role.sourceUrl && (
            <p className="text-sm text-base-content/75">
              These extracted details came from the previous posting link.
              Refresh the posting to read the new link.
            </p>
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
