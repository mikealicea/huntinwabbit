import { expect, it, vi } from 'vitest';
import { helloApi } from '@/features/hello/hello.index';
import { makeStore } from './state.store';

it.each(['development', 'production'])(
  'isolates and resets serializable caches in %s',
  (environment) => {
    vi.stubEnv('NODE_ENV', environment);
    try {
      const first = makeStore();
      const second = makeStore();
      first.dispatch(
        helloApi.util.upsertQueryEntries([
          {
            endpointName: 'hello',
            arg: undefined,
            value: { message: 'Hello, world!' },
          },
        ]),
      );
      expect(
        helloApi.endpoints.hello.select()(first.getState()).data?.message,
      ).toBe('Hello, world!');
      expect(
        helloApi.endpoints.hello.select()(second.getState()).data,
      ).toBeUndefined();
      expect(JSON.parse(JSON.stringify(first.getState()))).toEqual(
        first.getState(),
      );
      expect(makeStore(first.getState()).getState()).toEqual(first.getState());
      first.dispatch(helloApi.util.resetApiState());
      expect(
        helloApi.endpoints.hello.select()(first.getState()).data,
      ).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  },
);
