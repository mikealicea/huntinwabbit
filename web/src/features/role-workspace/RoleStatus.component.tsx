import type { ReactNode } from 'react';
import type { Opportunity } from '@/features/job-search/job-search.index';
import { LoadingPulse, RequestStatus } from '@/shared/shared.index';

export function RoleStatus({
  role,
  extracting,
  busy,
  failed,
  message,
  feedback,
}: {
  role: Opportunity;
  extracting: boolean;
  busy: boolean;
  failed: boolean;
  message: string;
  feedback: ReactNode;
}) {
  const posting = role.posting;
  const pending = ['queued', 'processing'].includes(
    role.saved?.extraction.status ?? '',
  );
  const active = busy || extracting || pending || !!role.saved?.edits?.pending;
  const error = failed || role.saved?.extraction.status === 'failed';
  const unavailable = role.saved?.extraction.status !== 'complete';
  const label = active
    ? busy
      ? message
      : 'Updating role…'
    : error
      ? 'Role request failed'
      : unavailable
        ? 'Role details unavailable'
        : 'Role up to date';
  return (
    <RequestStatus
      busy={active}
      failed={error}
      neutral={unavailable}
      label={label}
      statusLabel="Role status"
      expandable
      feedback={
        <div className="space-y-2">
          {feedback}
          {role.saved && (
            <div className="space-y-2">
              <p>
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
          {role.saved?.parsedPosting &&
            role.saved.parsedPosting.source.normalizedUrl !==
              role.sourceUrl && (
              <p className="text-sm text-base-content/75">
                These extracted details came from the previous posting link.
                Refresh the posting to read the new link.
              </p>
            )}
        </div>
      }
    />
  );
}
