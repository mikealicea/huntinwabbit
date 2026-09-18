'use client';

import {
  formatCalendarDate,
  type Opportunity,
  useJobSearch,
} from '@/features/job-search/job-search.index';

export function ApplicationMaterials({ role }: { role: Opportunity }) {
  const { state, dispatch } = useJobSearch();
  return (
    <section
      className="card border border-base-300 bg-base-100 shadow-sm"
      aria-labelledby="materials-title"
    >
      <div className="card-body gap-4 p-5 sm:p-6">
        <h2 id="materials-title" className="card-title">
          Application materials
        </h2>
        <div className="fieldset p-0">
          <label htmlFor="planned-resume" className="fieldset-legend py-1">
            Planned resume
          </label>
          <select
            id="planned-resume"
            className="select min-h-11 w-full text-base"
            value={role.plannedResumeId ?? ''}
            onChange={(event) =>
              dispatch({
                type: 'update-application',
                id: role.id,
                changes: { plannedResumeId: event.target.value || null },
              })
            }
          >
            <option value="">None selected</option>
            {state.resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-base-content/75">
            Sample resume choices. No files are stored here.
          </p>
        </div>
        <div className="border-t border-base-300 pt-4">
          <h3 className="text-sm font-semibold">Submitted resume</h3>
          {role.submittedMaterial ? (
            <div className="mt-3 space-y-2">
              <p className="break-words text-sm font-medium">
                {role.submittedMaterial.fileName}
              </p>
              <p className="text-sm text-base-content/75">
                {role.submittedMaterial.resumeLabel}
                <br />
                Submitted{' '}
                {formatCalendarDate(role.submittedMaterial.submittedOn)}
              </p>
              <span className="badge badge-outline badge-sm">
                Sample submission record
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-base-content/75">
              No submitted copy recorded.
            </p>
          )}
          <p className="mt-3 text-sm text-base-content/75">
            Changing your planned resume leaves this submission record
            unchanged.
          </p>
        </div>
      </div>
    </section>
  );
}
