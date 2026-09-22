'use client';

import { useEffect, useState } from 'react';
import type { CompanyAnalysis } from '@/features/job-api/job-api.index';
import { RequestStatus } from '@/shared/shared.index';

export function CompanyAnalysisStatus({
  data,
  pending,
  failed,
  onAnalyze,
}: {
  data?: CompanyAnalysis;
  pending: boolean;
  failed: boolean;
  onAnalyze: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  const scheduledFor = data?.status === 'scheduled' ? data.scheduledFor : null;
  useEffect(() => {
    if (!scheduledFor) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [scheduledFor]);
  const seconds =
    scheduledFor && now !== null
      ? Math.max(0, Math.ceil((Date.parse(scheduledFor) - now) / 1000))
      : null;
  const error = failed || data?.status === 'failed';
  const busy = pending || data?.status === 'processing' || (!data && !failed);
  const label = pending
    ? 'Requesting analysis…'
    : error
      ? 'Analysis unavailable'
      : !data
        ? 'Loading analysis…'
        : data.status === 'scheduled'
          ? seconds === 0
            ? 'Waiting to start'
            : 'Analysis scheduled'
          : data.status === 'processing'
            ? 'Analyzing…'
            : data.status === 'disabled'
              ? 'Analysis disabled'
              : data.status === 'not-started'
                ? 'Preparing analysis…'
                : data.stale
                  ? 'Analysis out of date'
                  : 'Analysis up to date';
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="text-right text-sm">
        <p aria-hidden="true" className="font-medium">
          {label}
        </p>
        {!pending && !error && seconds !== null && seconds > 0 && (
          <p
            role="timer"
            aria-live="off"
            className="tabular-nums text-base-content/70"
          >
            Starts in about {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, '0')}
          </p>
        )}
      </div>
      <button
        type="button"
        className="btn btn-sm min-h-11"
        disabled={
          !data ||
          pending ||
          data.status === 'processing' ||
          data.status === 'disabled'
        }
        onClick={onAnalyze}
      >
        {data?.status === 'complete' ? 'Refresh analysis' : 'Analyze now'}
      </button>
      <RequestStatus
        busy={busy}
        failed={error}
        neutral={data?.status !== 'complete' || data.stale}
        label={label}
        statusLabel="Company analysis status"
        expandable
        feedback={
          <p>
            {error
              ? 'Analysis could not be updated. Reload or retry below; your saved roles are still available.'
              : data?.status === 'scheduled'
                ? 'Nearby changes are combined before analysis starts. The countdown is approximate; Analyze now skips the wait.'
                : data?.status === 'processing'
                  ? 'Analysis has begun. Results will appear automatically when it finishes.'
                  : data?.status === 'disabled'
                    ? 'Company analysis is not enabled on this server.'
                    : data?.status === 'complete'
                      ? 'Review the shared requirements and common tech stack below, along with their supporting evidence.'
                      : 'Preparing company analysis. Your saved roles remain available below.'}
          </p>
        }
      />
    </div>
  );
}
