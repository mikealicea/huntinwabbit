import { describe, expect, it } from 'vitest';
import { createSampleState } from './job-search.fixtures';
import {
  formatCalendarDate,
  formatSalary,
  getCompanyLabel,
  getNextAction,
} from './job-search.selectors';
import { jobSearchReducer } from './job-search.state';

describe('application state boundaries', () => {
  it('moves a role without changing interest, priority, or another role', () => {
    const original = createSampleState();
    const role = original.opportunities[0];
    const next = jobSearchReducer(original, {
      type: 'update-application',
      id: role.id,
      changes: { stage: 'offer' },
    });
    expect(next.opportunities[0]).toMatchObject({
      stage: 'offer',
      interest: role.interest,
      priority: role.priority,
    });
    expect(original.opportunities[0].stage).toBe('collected');
    expect(next.opportunities[1]).toEqual(original.opportunities[1]);
  });

  it('keeps a submitted snapshot unchanged when the planned resume changes', () => {
    const original = createSampleState();
    const role = original.opportunities.find(
      (item) => item.id === 'northstar-platform',
    );
    const next = jobSearchReducer(original, {
      type: 'update-application',
      id: 'northstar-platform',
      changes: { plannedResumeId: 'general-v5', stage: 'collected' },
    });
    expect(
      next.opportunities.find((item) => item.id === 'northstar-platform')
        ?.submittedMaterial,
    ).toEqual(role?.submittedMaterial);
    expect(
      next.opportunities.find((item) => item.id === 'northstar-platform')
        ?.plannedResumeId,
    ).toBe('general-v5');
  });

  it('captures links without inventing posting facts or companies', () => {
    const next = jobSearchReducer(createSampleState(), {
      type: 'capture',
      links: [
        {
          id: 'new-role',
          sourceUrl: 'https://jobs.example.org/123',
          interest: 'interested',
        },
      ],
    });
    const role = next.opportunities.at(-1);
    expect(role).toMatchObject({
      id: 'new-role',
      stage: 'collected',
      interest: 'interested',
      priority: 'not-set',
      posting: null,
      companyId: null,
      submittedMaterial: null,
    });
    expect(
      getCompanyLabel(
        next.opportunities[next.opportunities.length - 1],
        next.companies,
      ),
    ).toBe('Company unknown');
    expect(next.companies).toHaveLength(5);
  });

  it('shares company research while retaining independent application records', () => {
    const state = createSampleState();
    const roles = state.opportunities.filter(
      (role) => role.companyId === 'northstar',
    );
    expect(roles).toHaveLength(2);
    expect(roles.map((role) => getCompanyLabel(role, state.companies))).toEqual(
      ['Northstar', 'Northstar'],
    );
    const next = jobSearchReducer(state, {
      type: 'update-application',
      id: roles[0].id,
      changes: { notes: 'A note for this role only.' },
    });
    expect(
      next.opportunities.find((role) => role.id === roles[1].id)?.notes,
    ).toBe('');
  });

  it('does not retain edits in a new sample session', () => {
    const state = createSampleState();
    state.opportunities[0].notes = 'Temporary';
    state.companies[0].contacts[0].name = 'Changed';
    const fresh = createSampleState();
    expect(fresh.opportunities[0].notes).toBe('');
    expect(fresh.companies[0].contacts[0].name).toBe('Alex');
  });
});

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

  it('updates the next action when tasks are completed and follow-ups are removed', () => {
    let state = createSampleState();
    const role = state.opportunities[0];
    expect(getNextAction(role, '2026-09-18').label).toBe('Find referral');
    state = jobSearchReducer(state, {
      type: 'set-task-completed',
      id: role.id,
      taskId: role.tasks[0].id,
      completed: true,
    });
    expect(getNextAction(state.opportunities[0], '2026-09-18').label).toBe(
      'No next action set',
    );
    state = jobSearchReducer(state, {
      type: 'update-application',
      id: role.id,
      changes: { followUpOn: '2026-09-18' },
    });
    expect(getNextAction(state.opportunities[0], '2026-09-18').due).toBe(true);
    state = jobSearchReducer(state, {
      type: 'update-application',
      id: role.id,
      changes: { followUpOn: null },
    });
    expect(getNextAction(state.opportunities[0], '2026-09-18').label).toBe(
      'No next action set',
    );
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
