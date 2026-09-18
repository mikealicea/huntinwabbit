import type { Company, Opportunity, SalaryRange } from './job-search.types';

export function getRoleTitle(role: Opportunity): string {
  return role.posting?.title || 'Saved opening';
}

export function getCompanyLabel(
  role: Opportunity,
  companies: Company[],
): string {
  return (
    companies.find((company) => company.id === role.companyId)?.name ||
    'Company unknown'
  );
}

export function getSourceHost(sourceUrl: string | null): string | null {
  if (!sourceUrl) return null;
  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return null;
  }
}

export function formatSalary(salary: SalaryRange | null | undefined): string {
  if (!salary || (salary.minimum === null && salary.maximum === null))
    return 'Salary not listed';
  const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const amount =
    salary.minimum === null
      ? `Up to ${format.format(salary.maximum as number)}`
      : salary.maximum === null
        ? `From ${format.format(salary.minimum)}`
        : salary.minimum === salary.maximum
          ? format.format(salary.minimum)
          : `${format.format(salary.minimum)}–${format.format(salary.maximum)}`;
  return `${amount} ${salary.currency} / ${salary.period}`;
}

export function toLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatCalendarDate(value: string): string {
  // Date-only values must not move to the previous day in a western timezone.
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function getNextAction(
  role: Opportunity,
  today: string,
): { label: string; due: boolean } {
  if (role.stage === 'closed') return { label: 'Process closed', due: false };
  if (role.followUpOn) {
    const prefix =
      today && role.followUpOn < today
        ? 'Overdue'
        : role.followUpOn === today
          ? 'Due today'
          : 'Follow up';
    return {
      label: `${prefix} · ${formatCalendarDate(role.followUpOn)}`,
      due: Boolean(today && role.followUpOn <= today),
    };
  }
  if (!role.posting)
    return { label: 'Posting details unavailable', due: false };
  return {
    label:
      role.tasks.find((task) => !task.completed)?.label || 'No next action set',
    due: false,
  };
}
