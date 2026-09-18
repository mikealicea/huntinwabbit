'use client';

import { useDraggable } from '@dnd-kit/react';
import Link from 'next/link';
import {
  formatSalary,
  getCompanyLabel,
  getNextAction,
  getRoleTitle,
  getSourceHost,
  INTEREST_LABELS,
  type Opportunity,
  PRIORITY_LABELS,
  useJobSearch,
} from '@/features/job-search/job-search.index';

export function RoleCard({ role }: { role: Opportunity }) {
  const { state, today } = useJobSearch();
  const title = getRoleTitle(role);
  const company = getCompanyLabel(role, state.companies);
  const { ref, handleRef, isDragging } = useDraggable({
    id: role.id,
    data: { label: `${title} at ${company}` },
  });
  const next = getNextAction(role, today);
  return (
    <article
      ref={ref}
      aria-label={`${title} at ${company}`}
      className={`card min-w-0 border border-base-300 bg-base-100 shadow-sm ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="card-body gap-3 p-4">
        <div className="flex items-start justify-between gap-1">
          <p className="min-w-0 break-words pt-2 text-sm font-medium text-base-content/75">
            {company}
          </p>
          <button
            id={`move-${role.id}`}
            ref={handleRef}
            type="button"
            className="btn btn-ghost size-11 min-h-11 shrink-0 cursor-grab touch-none p-2 active:cursor-grabbing"
            aria-label={`Move ${title} at ${company}`}
            aria-describedby="board-move-help"
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <circle cx="7" cy="5" r="1.5" />
              <circle cx="13" cy="5" r="1.5" />
              <circle cx="7" cy="10" r="1.5" />
              <circle cx="13" cy="10" r="1.5" />
              <circle cx="7" cy="15" r="1.5" />
              <circle cx="13" cy="15" r="1.5" />
            </svg>
          </button>
        </div>
        <h3 className="text-base font-semibold leading-snug">
          <Link
            className="inline-block min-h-11 break-words hover:underline"
            href={`/app/roles/${role.id}`}
            aria-label={`Open ${title} at ${company}`}
          >
            {title}
          </Link>
        </h3>
        {!role.posting && (
          <p className="break-all text-xs text-base-content/75">
            Source: {getSourceHost(role.sourceUrl) || 'Not provided'}
          </p>
        )}
        <p
          className={`text-sm leading-relaxed ${role.posting?.salary ? 'font-medium' : 'text-base-content/75'}`}
        >
          {formatSalary(role.posting?.salary)}
        </p>
        <div>
          <span
            className={`badge h-auto min-h-6 whitespace-normal py-1 text-xs ${role.interest === 'highly-interested' ? 'badge-primary' : 'badge-outline'}`}
          >
            <span className="sr-only">Interest: </span>
            {INTEREST_LABELS[role.interest]}
          </span>
        </div>
        <p className="text-xs">
          <span className="text-base-content/75">Priority · </span>
          {PRIORITY_LABELS[role.priority]}
        </p>
        <p
          className={`mt-1 border-t border-base-300 pt-3 text-xs leading-relaxed ${next.due ? 'font-semibold' : 'text-base-content/75'}`}
        >
          {next.due && <span aria-hidden="true">◷ </span>}
          {next.label}
        </p>
      </div>
    </article>
  );
}
