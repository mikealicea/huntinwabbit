import {
  formatSalary,
  type Opportunity,
} from '@/features/job-search/job-search.index';

export function JobDetails({ role }: { role: Opportunity }) {
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
            details are unavailable in this sample. Links are not parsed yet.
          </p>
        )}
        <p className="rounded-lg bg-base-200 p-3 text-sm font-medium">
          {formatSalary(posting?.salary)}
        </p>
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
