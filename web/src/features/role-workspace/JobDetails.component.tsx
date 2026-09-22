import {
  formatSalary,
  type Opportunity,
} from '@/features/job-search/job-search.index';
import { PostingDescription } from './PostingDescription.component';

export function JobDetails({ role }: { role: Opportunity }) {
  const posting = role.posting;
  const details = role.jobDetails ?? role.saved?.parsedPosting?.job;
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
            <dl
              aria-label="Job overview"
              className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-base-content/75"
            >
              {[
                ['Location', posting.location || 'Location not listed'],
                [
                  'Employment type',
                  posting.employmentType || 'Employment type not listed',
                ],
                ['Salary', formatSalary(posting.salary)],
                [
                  'Work arrangement',
                  details?.workArrangement === 'on-site'
                    ? 'On-site'
                    : details?.workArrangement === 'hybrid'
                      ? 'Hybrid'
                      : details?.workArrangement === 'remote'
                        ? 'Remote'
                        : 'Work arrangement not listed',
                ],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 break-words">
                  <dt className="sr-only">{label}</dt>
                  <dd
                    className={
                      label === 'Salary'
                        ? 'font-semibold text-base-content'
                        : undefined
                    }
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Requirements</h3>
              <FactList
                items={posting.requirements}
                empty="Requirements not listed"
              />
              {!!details?.preferredQualifications.length && (
                <div className="mt-3">
                  <h4 className="mb-2 text-sm font-semibold">
                    Preferred qualifications
                  </h4>
                  <FactList items={details.preferredQualifications} />
                </div>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Tech stack</h3>
              {details?.technologies?.length ? (
                <ul className="flex flex-wrap gap-2 text-sm">
                  {[...new Set(details.technologies)].map((technology) => (
                    <li
                      key={technology}
                      className="min-w-0 max-w-full whitespace-pre-wrap break-words rounded-lg bg-base-200 px-3 py-1.5"
                    >
                      {technology}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-base-content/75">
                  {details?.technologies === undefined &&
                  role.saved?.parsedPosting
                    ? 'Refresh the posting to extract technologies.'
                    : 'Technologies not listed'}
                </p>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Responsibilities</h3>
              <FactList
                items={details?.responsibilities ?? []}
                empty="Responsibilities not listed"
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Full job details</h3>
              {posting.description ? (
                <PostingDescription description={posting.description} />
              ) : (
                <p className="text-sm text-base-content/75">
                  Description not listed
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="leading-relaxed text-base-content/75">
            Your link is collected. Job title, company, location, and posting
            details have not been extracted yet.
          </p>
        )}
        {details && (
          <>
            {details.benefits.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Benefits</h3>
                <FactList items={details.benefits} />
              </div>
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

function FactList({ items, empty }: { items: string[]; empty?: string }) {
  return items.length ? (
    <ul className="list-disc space-y-1 break-words pl-5 text-sm leading-relaxed">
      {[...new Set(items)].map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  ) : empty ? (
    <p className="text-sm text-base-content/75">{empty}</p>
  ) : null;
}
