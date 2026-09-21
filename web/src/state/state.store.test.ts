import { describe, expect, it, vi } from 'vitest';
import { postingApi } from '@/features/job-api/job-api.index';
import { postingFixtures } from '@/features/job-api/job-api.test-support';
import { clockReducer, dateChanged, selectToday } from './state.clock';
import { makeStore } from './state.store';

describe('workspace store', () => {
  it.each(['development', 'production'])(
    'isolates API caches in %s',
    (environment) => {
      vi.stubEnv('NODE_ENV', environment);
      try {
        const first = makeStore();
        const second = makeStore();
        const item = postingFixtures()[0];
        first.dispatch(
          postingApi.util.upsertQueryEntries([
            { endpointName: 'posting', arg: item.id, value: item },
          ]),
        );
        expect(
          postingApi.endpoints.posting.select(item.id)(first.getState()).data,
        ).toEqual(item);
        expect(
          postingApi.endpoints.posting.select(item.id)(second.getState()).data,
        ).toBeUndefined();
        expect(JSON.parse(JSON.stringify(first.getState()))).toEqual(
          first.getState(),
        );
        first.dispatch(postingApi.util.resetApiState());
        expect(
          postingApi.endpoints.posting.select(item.id)(first.getState()).data,
        ).toBeUndefined();
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );
  it('starts with no application data and accepts explicit clock seed', () => {
    expect(Object.keys(makeStore().getState().postingApi.queries)).toEqual([]);
    expect(
      selectToday(makeStore({ clock: { today: '2026-09-21' } }).getState()),
    ).toBe('2026-09-21');
  });
  it('keeps the clock deterministic and handles unchanged actions', () => {
    const store = makeStore();
    expect(selectToday(store.getState())).toBe('');
    const before = store.getState().clock;
    const action = dateChanged('2026-09-21');
    store.dispatch(action);
    expect(selectToday(store.getState())).toBe('2026-09-21');
    expect(selectToday({ clock: before })).toBe('');
    expect(clockReducer(before, action)).toEqual(clockReducer(before, action));
    expect(clockReducer(store.getState().clock, action)).toBe(
      store.getState().clock,
    );
  });
});
