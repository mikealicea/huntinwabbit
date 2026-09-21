import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import {
  type ApplicationFields,
  getSourceHost,
  INTEREST_LABELS,
  INTERESTS,
  type Interest,
  type Opportunity,
  PRIORITIES,
  PRIORITY_LABELS,
  type Priority,
  STAGE_LABELS,
  STAGES,
  type Stage,
} from '@/features/job-search/job-search.index';
import { LoadingPulse } from '@/shared/shared.index';
import { type DeleteOutcome, DeletePosting } from './DeletePosting.component';
import { JobDetails } from './JobDetails.component';
export interface RoleWorkspaceProps {
  role: Opportunity;
  roleName: string;
  companyLabel: string;
  nextActionLabel: string;
  onApplicationChange: (changes: Partial<ApplicationFields>) => unknown;
  saving?: boolean;
  deleting?: boolean;
  deleteDisabled?: boolean;
  onDelete?: (version: number) => Promise<DeleteOutcome>;
  extracting?: boolean;
  onExtract?: () => void;
  onTaskCompletionChange: (taskId: string, completed: boolean) => void;
  updates?: ReactNode;
  materials: ReactNode;
  company: ReactNode;
}
export function RoleWorkspace({
  saving = false,
  deleting = false,
  deleteDisabled = false,
  onDelete,
  extracting = false,
  onExtract,
  role,
  roleName,
  companyLabel,
  nextActionLabel,
  onApplicationChange,
  onTaskCompletionChange,
  updates,
  materials,
  company,
}: RoleWorkspaceProps) {
  const [notes, setNotes] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/app" className="btn btn-ghost -ml-3 mb-5 min-h-11">
        <span aria-hidden="true">←</span> Search board
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-base-content/75">
            {companyLabel}
          </p>
          <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">
            {roleName}
          </h1>
          {!role.posting && (
            <p className="mt-2 break-all text-sm text-base-content/75">
              Source: {getSourceHost(role.sourceUrl) || 'Not provided'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge badge-outline h-auto py-2">
            {STAGE_LABELS[role.stage]}
          </span>
          {onDelete && role.saved && (
            <DeletePosting
              roleName={roleName}
              version={role.saved.applicationVersion}
              pending={deleting}
              disabled={deleteDisabled}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="fieldset p-0">
          <label htmlFor="role-stage" className="fieldset-legend py-1">
            Stage
          </label>
          <select
            disabled={saving}
            id="role-stage"
            className="select min-h-11 w-full text-base"
            value={role.stage}
            onChange={(event) =>
              onApplicationChange({ stage: event.target.value as Stage })
            }
          >
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </div>
        <div className="fieldset p-0">
          <label htmlFor="role-interest" className="fieldset-legend py-1">
            Interest
          </label>
          <select
            disabled={saving}
            id="role-interest"
            className="select min-h-11 w-full text-base"
            value={role.interest}
            onChange={(event) =>
              onApplicationChange({ interest: event.target.value as Interest })
            }
          >
            {INTERESTS.map((interest) => (
              <option key={interest} value={interest}>
                {INTEREST_LABELS[interest]}
              </option>
            ))}
          </select>
        </div>
        <div className="fieldset p-0">
          <label htmlFor="role-priority" className="fieldset-legend py-1">
            Priority
          </label>
          <select
            disabled={saving}
            id="role-priority"
            className="select min-h-11 w-full text-base"
            value={role.priority}
            onChange={(event) =>
              onApplicationChange({ priority: event.target.value as Priority })
            }
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <JobDetails
            role={role}
            onExtract={onExtract}
            extracting={extracting && !deleting}
            disabled={deleting}
          />
          <section
            className="card border border-base-300 bg-base-100 shadow-sm"
            aria-labelledby="tasks-title"
          >
            <div className="card-body gap-5 p-5 sm:p-6">
              <p className="text-sm text-base-content/75">
                Task management is not available yet.
              </p>
              <div>
                <h2 id="tasks-title" className="card-title">
                  Follow-up & notes
                </h2>
                <p className="mt-2 text-sm text-base-content/75">
                  Next: {nextActionLabel}
                </p>
              </div>
              <div className="space-y-1">
                {role.tasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={task.completed}
                      onChange={(event) =>
                        onTaskCompletionChange(task.id, event.target.checked)
                      }
                    />
                    <span
                      className={
                        task.completed
                          ? 'text-base-content/70 line-through'
                          : ''
                      }
                    >
                      {task.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="fieldset p-0">
                <label htmlFor="follow-up" className="fieldset-legend py-1">
                  Next follow-up
                </label>
                <input
                  disabled={saving}
                  id="follow-up"
                  type="date"
                  className="input min-h-11 w-full text-base"
                  value={role.followUpOn ?? ''}
                  onChange={(event) =>
                    onApplicationChange({
                      followUpOn: event.target.value || null,
                    })
                  }
                />
              </div>
              <div className="fieldset p-0">
                <label htmlFor="role-notes" className="fieldset-legend py-1">
                  Prep & interview notes
                </label>
                <textarea
                  disabled={saving}
                  id="role-notes"
                  className="textarea min-h-40 w-full text-base leading-relaxed"
                  placeholder="Rounds, questions, things to prepare…"
                  maxLength={20000}
                  value={notes ?? role.notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setSavedNotice(false);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary mt-2"
                  disabled={saving || notes === null}
                  onClick={async () => {
                    const draft = notes;
                    const success = await onApplicationChange({
                      notes: draft ?? role.notes,
                    });
                    if (success !== false) {
                      setNotes((current) =>
                        current === draft ? null : current,
                      );
                      setSavedNotice(true);
                    }
                  }}
                >
                  Save notes
                </button>
                <p role="status" className="mt-1 text-sm text-base-content/75">
                  {saving && !deleting && <LoadingPulse />}
                  {saving
                    ? deleting
                      ? 'Deleting…'
                      : 'Saving…'
                    : notes !== null
                      ? 'You have unsaved notes.'
                      : savedNotice
                        ? 'Notes saved.'
                        : 'Notes are saved to this role.'}
                </p>
              </div>
            </div>
          </section>
        </div>
        <div className="contents min-w-0 space-y-5 lg:block">
          {updates}
          {materials}
          {company}
        </div>
      </div>
    </div>
  );
}
