import { describe, expect, it, vi } from 'vitest';
import {
  applicationUpdated,
  linksCaptured,
  selectActiveRoleCount,
  selectCompanies,
  selectCompany,
  selectCompanyRoleCount,
  selectOpportunities,
  selectOpportunity,
  selectResumes,
  selectRolesByStage,
  taskCompletionSet,
} from '@/features/job-search/job-search.index';
import { clockReducer, dateChanged, selectToday } from './state.clock';
import { makeStore } from './state.store';

describe('workspace store and generated actions', () => {
  it.each(['development', 'production'])(
    'isolates stores in %s without touching input state',
    (environment) => {
      vi.stubEnv('NODE_ENV', environment);
      try {
        const first = makeStore();
        const second = makeStore();
        const before = first.getState();
        first.dispatch(
          applicationUpdated({
            id: 'northstar-product',
            changes: { notes: 'Only this session' },
          }),
        );
        expect(
          selectOpportunity(first.getState(), 'northstar-product')?.notes,
        ).toBe('Only this session');
        expect(second.getState()).toEqual(before);
        expect(selectOpportunity(before, 'northstar-product')?.notes).toBe('');
        expect(JSON.parse(JSON.stringify(first.getState()))).toEqual(
          first.getState(),
        );
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it('accepts an empty seed and appends a batch in order without inventing facts', () => {
    const seed = { opportunities: [], companies: [], resumes: [] };
    const store = makeStore({ jobSearch: seed });
    const links = [
      {
        id: 'first',
        sourceUrl: 'https://example.org/job',
        interest: 'not-set' as const,
      },
      {
        id: 'second',
        sourceUrl: 'https://example.org/job',
        interest: 'highly-interested' as const,
      },
    ];
    const originalLinks = structuredClone(links);
    const action = linksCaptured(links);
    store.dispatch(action);
    expect(
      selectOpportunities(store.getState()).map((role) => role.id),
    ).toEqual(['first', 'second']);
    expect(selectOpportunity(store.getState(), 'second')).toMatchObject({
      companyId: null,
      posting: null,
      priority: 'not-set',
      followUpOn: null,
      notes: '',
      plannedResumeId: null,
      submittedMaterial: null,
      tasks: [{ id: 'second-referral', kind: 'referral', completed: false }],
    });
    expect(seed.opportunities).toEqual([]);
    expect(action.payload).toEqual(originalLinks);
    const before = store.getState();
    store.dispatch(linksCaptured([]));
    expect(store.getState()).toBe(before);
  });

  it('treats missing roles, missing tasks, unchanged updates and unknown actions as no-ops', () => {
    const store = makeStore();
    const before = store.getState();
    store.dispatch(
      applicationUpdated({ id: 'missing', changes: { notes: 'ignored' } }),
    );
    store.dispatch(
      applicationUpdated({ id: 'northstar-product', changes: {} }),
    );
    store.dispatch(
      applicationUpdated({
        id: 'northstar-product',
        changes: { stage: 'collected' },
      }),
    );
    store.dispatch(
      taskCompletionSet({ id: 'missing', taskId: 'missing', completed: true }),
    );
    store.dispatch(
      taskCompletionSet({
        id: 'northstar-product',
        taskId: 'missing',
        completed: true,
      }),
    );
    store.dispatch({ type: 'other/unrelated' });
    expect(store.getState()).toBe(before);
  });

  it('completes and reopens exactly one task and handles repeated events', () => {
    const store = makeStore();
    const before = store.getState();
    const role = before.jobSearch.opportunities[0];
    const payload = { id: role.id, taskId: role.tasks[0].id, completed: true };
    store.dispatch(taskCompletionSet(payload));
    const completed = store.getState();
    expect(selectOpportunity(completed, role.id)?.tasks[0].completed).toBe(
      true,
    );
    expect(role.tasks[0].completed).toBe(false);
    expect(completed.jobSearch.opportunities[1]).toBe(
      before.jobSearch.opportunities[1],
    );
    store.dispatch(taskCompletionSet(payload));
    expect(store.getState()).toBe(completed);
    store.dispatch(taskCompletionSet({ ...payload, completed: false }));
    expect(
      selectOpportunity(store.getState(), role.id)?.tasks[0].completed,
    ).toBe(false);
  });

  it('derives stage counts, companies, resumes and missing selections from canonical state', () => {
    const store = makeStore();
    const state = store.getState();
    expect(selectActiveRoleCount(state)).toBe(5);
    expect(selectRolesByStage(state, 'offer')).toEqual([]);
    const collected = selectRolesByStage(state, 'collected');
    expect(collected).toHaveLength(2);
    expect(selectRolesByStage(state, 'collected')).toBe(collected);
    expect(selectCompanyRoleCount(state, 'northstar')).toBe(2);
    expect(selectCompanyRoleCount(state, 'missing')).toBe(0);
    expect(selectCompany(state, 'northstar')?.name).toBe('Northstar');
    expect(selectCompany(state, null)).toBeUndefined();
    expect(selectCompany(state, 'missing')).toBeUndefined();
    expect(selectOpportunity(state, 'missing')).toBeUndefined();
    expect(selectCompanies(state)).toBe(state.jobSearch.companies);
    expect(selectResumes(state)).toBe(state.jobSearch.resumes);
    store.dispatch(dateChanged('2026-09-20'));
    expect(selectRolesByStage(store.getState(), 'collected')).toBe(collected);
    store.dispatch(
      applicationUpdated({ id: collected[0].id, changes: { stage: 'closed' } }),
    );
    expect(selectActiveRoleCount(store.getState())).toBe(4);
    expect(selectRolesByStage(store.getState(), 'collected')).toHaveLength(1);
    expect(selectCompanyRoleCount(store.getState(), 'northstar')).toBe(2);
  });

  it('keeps the clock serializable, replayable and independent of application edits', () => {
    const store = makeStore();
    expect(selectToday(store.getState())).toBe('');
    const before = store.getState();
    const action = dateChanged('2026-09-19');
    store.dispatch(action);
    expect(selectToday(store.getState())).toBe('2026-09-19');
    expect(selectToday(before)).toBe('');
    expect(store.getState().jobSearch).toBe(before.jobSearch);
    expect(clockReducer(before.clock, action)).toEqual(
      clockReducer(before.clock, action),
    );
    const current = store.getState();
    store.dispatch(action);
    expect(store.getState()).toBe(current);
  });
});
