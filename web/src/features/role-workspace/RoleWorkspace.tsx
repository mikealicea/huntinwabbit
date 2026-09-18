'use client';

import Link from 'next/link';
import {
  type ApplicationFields,
  applicationUpdated,
  getCompanyLabel,
  getNextAction,
  getRoleTitle,
  getSourceHost,
  INTEREST_LABELS,
  INTERESTS,
  type Interest,
  PRIORITIES,
  PRIORITY_LABELS,
  type Priority,
  STAGE_LABELS,
  STAGES,
  type Stage,
  selectCompanies,
  selectOpportunity,
  taskCompletionSet,
} from '@/features/job-search/job-search.index';
import {
  selectToday,
  useAppDispatch,
  useAppSelector,
} from '@/state/state.index';
import { ApplicationMaterials } from './ApplicationMaterials';
import { CompanyContext } from './CompanyContext';
import { JobDetails } from './JobDetails';

export function RoleWorkspace({ roleId }: { roleId: string }) {
  const dispatch = useAppDispatch();
  const today = useAppSelector(selectToday);
  const companies = useAppSelector(selectCompanies);
  const role = useAppSelector((state) => selectOpportunity(state, roleId));
  if (!role)
    return (
      <section className="mx-auto max-w-xl py-16">
        <h1 className="text-3xl font-bold">Role not found</h1>
        <p className="my-5 leading-relaxed">
          This role is not in the current sample workspace. Links you add are
          cleared when you reload or leave the app.
        </p>
        <Link href="/app" className="btn btn-primary min-h-11">
          Return to search board
        </Link>
      </section>
    );
  const next = getNextAction(role, today);
  const roleName = getRoleTitle(role);
  function updateApplication(changes: Partial<ApplicationFields>) {
    dispatch(applicationUpdated({ id: roleId, changes }));
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/app" className="btn btn-ghost -ml-3 mb-5 min-h-11">
        <span aria-hidden="true">←</span> Search board
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-base-content/75">
            {getCompanyLabel(role, companies)}
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
        <span className="badge badge-outline h-auto py-2">
          {STAGE_LABELS[role.stage]}
        </span>
      </div>
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="fieldset p-0">
          <label htmlFor="role-stage" className="fieldset-legend py-1">
            Stage
          </label>
          <select
            id="role-stage"
            className="select min-h-11 w-full text-base"
            value={role.stage}
            onChange={(event) =>
              updateApplication({ stage: event.target.value as Stage })
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
            id="role-interest"
            className="select min-h-11 w-full text-base"
            value={role.interest}
            onChange={(event) =>
              updateApplication({ interest: event.target.value as Interest })
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
            id="role-priority"
            className="select min-h-11 w-full text-base"
            value={role.priority}
            onChange={(event) =>
              updateApplication({ priority: event.target.value as Priority })
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
          <JobDetails role={role} />
          <section
            className="card border border-base-300 bg-base-100 shadow-sm"
            aria-labelledby="tasks-title"
          >
            <div className="card-body gap-5 p-5 sm:p-6">
              <div>
                <h2 id="tasks-title" className="card-title">
                  Tasks & follow-up
                </h2>
                <p className="mt-2 text-sm text-base-content/75">
                  Next: {next.label}
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
                        dispatch(
                          taskCompletionSet({
                            id: role.id,
                            taskId: task.id,
                            completed: event.target.checked,
                          }),
                        )
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
                  id="follow-up"
                  type="date"
                  className="input min-h-11 w-full text-base"
                  value={role.followUpOn ?? ''}
                  onChange={(event) =>
                    updateApplication({
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
                  id="role-notes"
                  className="textarea min-h-40 w-full text-base leading-relaxed"
                  placeholder="Rounds, questions, things to prepare…"
                  value={role.notes}
                  onChange={(event) =>
                    updateApplication({ notes: event.target.value })
                  }
                />
                <p className="mt-1 text-sm text-base-content/75">
                  Changes apply immediately to this sample session.
                </p>
              </div>
            </div>
          </section>
        </div>
        <div className="min-w-0 space-y-5">
          <ApplicationMaterials role={role} />
          <CompanyContext role={role} />
        </div>
      </div>
    </div>
  );
}
