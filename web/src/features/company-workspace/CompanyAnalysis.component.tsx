import Link from 'next/link';
import type { CompanyAnalysis as Analysis } from '@/features/job-api/job-api.index';
export function CompanyAnalysis({
  data,
  pending,
  failed,
  complete,
  onRefresh,
  onRetry,
  onLoadMore,
}: {
  data?: Analysis;
  pending: boolean;
  failed: boolean;
  complete: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
}) {
  const running =
    pending || data?.status === 'scheduled' || data?.status === 'processing';
  const disabled = data?.status === 'disabled';
  return (
    <section className="mb-10" aria-labelledby="company-analysis-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="company-analysis-title" className="text-xl font-semibold">
          Across your roles
        </h2>
      </div>
      <p className="mb-3 text-sm text-base-content/70">
        AI-generated from saved role details, comments, and update history.
        Review the supporting evidence.
      </p>
      <div role="status" className="mb-4 text-sm">
        {!data && !failed
          ? 'Loading company analysis…'
          : disabled
            ? 'Company analysis is not enabled on this server.'
            : data?.status === 'scheduled'
              ? 'Analysis scheduled. Nearby changes are combined before it starts.'
              : running
                ? 'Analyzing saved information…'
                : data?.status === 'not-started'
                  ? 'Preparing your first analysis…'
                  : null}
        {data?.stale && (
          <p>
            Saved information has changed. These results are from the previous
            analysis.
          </p>
        )}
        {data?.completedAt && (
          <p>
            Last analyzed {new Date(data.completedAt).toLocaleString()}. Based
            on {data.analyzedRoles} of {data.totalRoles} saved roles.
          </p>
        )}
      </div>
      {(failed || data?.status === 'failed') && (
        <div
          role="alert"
          className="mb-4 rounded-box border border-base-300 p-4"
        >
          <p>
            {data?.error === 'ANALYSIS_TOO_LARGE'
              ? 'This company exceeds the current analysis capacity. No partial result was published.'
              : 'Company analysis could not finish. Your saved roles are still available.'}
          </p>
          <button
            type="button"
            className="btn btn-sm mt-2 min-h-11"
            onClick={failed ? onRetry : onRefresh}
            disabled={pending}
          >
            {failed ? 'Reload analysis' : 'Retry analysis'}
          </button>
        </div>
      )}
      {data?.completedAt && data.analyzedRoles === 1 && (
        <p className="mb-4 rounded-box bg-base-200 p-3 text-sm">
          Single-role preview — these findings are not yet shared across roles.
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {(['requirement', 'technology'] as const).map((category) => {
          const findings =
            data?.items.filter((item) => item.category === category) ?? [];
          return (
            <section
              key={category}
              aria-labelledby={`company-${category}`}
              className="rounded-box border border-base-300 bg-base-100 p-5"
            >
              <h3
                id={`company-${category}`}
                className="mb-4 text-lg font-semibold"
              >
                {category === 'requirement'
                  ? 'Shared requirements'
                  : 'Common tech stack'}
              </h3>
              {findings.length ? (
                <ul className="space-y-5">
                  {findings.map((finding) => (
                    <li
                      key={`${finding.category}-${finding.qualifier}-${finding.label}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="font-semibold break-words">
                          {finding.label}
                        </h4>
                        <span className="text-xs text-base-content/65">
                          {
                            new Set(finding.evidence.map((item) => item.roleId))
                              .size
                          }{' '}
                          of {data?.analyzedRoles} analyzed roles
                        </span>
                      </div>
                      <p className="mt-1 text-xs capitalize text-base-content/65">
                        {finding.qualifier}
                      </p>
                      {finding.explanation && (
                        <p className="mt-2 text-sm">{finding.explanation}</p>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer py-2 text-sm font-medium">
                          Supporting evidence for {finding.label}
                        </summary>
                        <ul className="space-y-3 border-l-2 border-base-300 pl-3">
                          {finding.evidence.map((evidence) => (
                            <li
                              key={`${evidence.roleId}-${evidence.source}-${evidence.excerpt}`}
                              className="text-sm"
                            >
                              <Link
                                className="link break-words"
                                href={`/app/roles/${evidence.roleId}`}
                              >
                                {evidence.roleTitle}
                              </Link>
                              <span className="ml-2 text-xs text-base-content/65">
                                {evidence.source === 'personal'
                                  ? 'Personal observation'
                                  : evidence.source === 'history'
                                    ? 'Historical context'
                                    : evidence.source === 'correction'
                                      ? 'Corrected role details'
                                      : 'Job posting'}
                              </span>
                              <blockquote className="mt-1 whitespace-pre-wrap break-words text-base-content/75">
                                {evidence.excerpt}
                              </blockquote>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-base-content/65">
                  {disabled
                    ? 'Company analysis is unavailable.'
                    : (failed || data?.status === 'failed') &&
                        !data?.completedAt
                      ? 'No analysis results are available yet.'
                      : running || !data || data.status === 'not-started'
                        ? 'Results will appear here when analysis finishes.'
                        : !complete
                          ? 'More results may be available below.'
                          : !data.analyzedRoles
                            ? 'Add role details or comments to begin finding patterns.'
                            : category === 'requirement'
                              ? 'No shared requirements found in the analyzed information.'
                              : 'No common technologies found in the analyzed information.'}
                </p>
              )}
            </section>
          );
        })}
      </div>
      {!complete && data?.nextCursor && (
        <button
          type="button"
          className="btn mt-4 min-h-11"
          onClick={onLoadMore}
          disabled={pending}
        >
          Load more findings
        </button>
      )}
    </section>
  );
}
