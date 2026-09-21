import { describe, expect, it } from 'vitest';
import { createSampleState } from './job-search.fixtures';
import {
  formatCalendarDate,
  formatSalary,
  getCompanyLabel,
  getNextAction,
  getRoleTitle,
  getSourceHost,
} from './job-search.selectors';

describe('board presentation', () => {
  it('prioritizes follow-ups, distinguishes overdue and today, and hides urgency for closed roles', () => {
    const role = {
      ...createSampleState().opportunities[0],
      followUpOn: '2026-09-18',
    };
    expect(getNextAction(role, '2026-09-18')).toEqual({
      label: 'Due today · Sep 18, 2026',
      due: true,
    });
    expect(getNextAction(role, '2026-09-19')).toEqual({
      label: 'Overdue · Sep 18, 2026',
      due: true,
    });
    expect(getNextAction(role, '2026-09-17')).toEqual({
      label: 'Follow up · Sep 18, 2026',
      due: false,
    });
    expect(getNextAction({ ...role, stage: 'closed' }, '2026-09-19')).toEqual({
      label: 'Process closed',
      due: false,
    });
    expect(formatCalendarDate('2026-01-01')).toBe('Jan 1, 2026');
  });

  it('formats missing, partial, and hourly salary data without assuming USD or annual pay', () => {
    expect(formatSalary(null)).toBe('Salary not listed');
    expect(
      formatSalary({
        minimum: 60,
        maximum: 85,
        currency: 'EUR',
        period: 'hour',
      }),
    ).toBe('60–85 EUR / hour');
    expect(
      formatSalary({
        minimum: null,
        maximum: 5000,
        currency: 'GBP',
        period: 'month',
      }),
    ).toBe('Up to 5,000 GBP / month');
    expect(
      formatSalary({
        minimum: 120000,
        maximum: null,
        currency: 'USD',
        period: 'year',
      }),
    ).toBe('From 120,000 USD / year');
    expect(
      formatSalary({
        minimum: null,
        maximum: null,
        currency: 'USD',
        period: 'year',
      }),
    ).toBe('Salary not listed');
  });
});

describe('presentation fallbacks', () => {
  it('handles missing titles, source URLs and unavailable follow-up comparison dates', () => {
    const role = createSampleState().opportunities[0];
    expect(getRoleTitle(role)).toBe('Senior Product Engineer');
    expect(getRoleTitle({ ...role, posting: null })).toBe('Saved opening');
    expect(
      getRoleTitle({
        ...role,
        posting: {
          title: '',
          location: null,
          employmentType: null,
          description: null,
          requirements: [],
          salary: null,
        },
      }),
    ).toBe('Saved opening');
    expect(getSourceHost(null)).toBeNull();
    expect(getSourceHost('not a url')).toBeNull();
    expect(getSourceHost('https://jobs.example.org/role')).toBe(
      'jobs.example.org',
    );
    expect(getNextAction({ ...role, followUpOn: '2026-09-18' }, '')).toEqual({
      label: 'Follow up · Sep 18, 2026',
      due: false,
    });
    expect(getNextAction({ ...role, posting: null }, '')).toEqual({
      label: 'Posting details unavailable',
      due: false,
    });
    expect(formatSalary(undefined)).toBe('Salary not listed');
    expect(
      formatSalary({
        minimum: 50,
        maximum: 50,
        currency: 'EUR',
        period: 'hour',
      }),
    ).toBe('50 EUR / hour');
  });
});

it('uses supplied tasks only for presentation and preserves unknown company labels', () => {
  const role = createSampleState().opportunities[0];
  expect(getNextAction(role, '').label).toBe('Find referral');
  expect(
    getNextAction(
      {
        ...role,
        tasks: role.tasks.map((task) => ({ ...task, completed: true })),
      },
      '',
    ).label,
  ).toBe('No next action set');
  expect(getCompanyLabel(role, createSampleState().companies)).toBe(
    'Northstar',
  );
  expect(getCompanyLabel({ ...role, companyId: null }, [])).toBe(
    'Company unknown',
  );
  expect(getCompanyLabel({ ...role, companyName: 'Known company' }, [])).toBe(
    'Known company',
  );
});
