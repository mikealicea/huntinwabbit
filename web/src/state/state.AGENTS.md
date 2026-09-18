# Workspace Redux store

## Purpose and boundaries

This folder composes shared client state for the authenticated sample workspace. It is not a router,
auth session, persistent database or API cache. Follow the adopted
[state and testing conventions](../../docs/state-management.md); the [web guide](../../AGENTS.md)
owns gates and feature boundaries. New shared product state belongs in feature-owned RTK slices.

## Owners and lifetime

- [state.store.ts](state.store.ts) creates a fresh configured store, infers types from the combined
  reducers and accepts optional serializable initial state. Default RTK middleware stays enabled.
  Redux DevTools are available outside production only; no logger or persistence middleware exists.
- [StoreProvider.provider.tsx](StoreProvider.provider.tsx) creates one store with a lazy initializer and supplies the
  standard React Redux provider. Initial props seed a new mount, not subsequent rerenders.
- [state.hooks.ts](state.hooks.ts) owns typed dispatch and selector hooks. [state.index.ts](state.index.ts)
  is the public composition surface. Never export a singleton store or import the factory to dispatch
  from arbitrary modules. Features export reducers/actions/selectors through their own barrels;
  hooks import store types only so reducers never depend on provider runtime.
- [state.clock.ts](state.clock.ts) owns the shared local calendar date used by due labels. The provider
  reads the clock after mount, every minute and on visibility changes, dispatching a date string.
  It removes timers and listeners on cleanup, including React Strict Mode remounts. Reducers never
  read the clock. Empty initial dates keep server and first-client markup deterministic.
- The [job-search slice](../features/job-search/job-search.slice.ts) owns application data and
  synchronous transitions; its [barrel](../features/job-search/job-search.AGENTS.md) defines behavior.

The [application layout](../app/app/layout.tsx) requires a verified identity before rendering this
provider and keys it by user ID. Client navigation within `/app` preserves edits. Account key changes,
unmounts and reloads discard them. Do not hoist the provider above authentication or share a store
across requests. Server Components compose children but do not read or dispatch to Redux.

The date clock is presentation-only and has no network or durable work. No retries, persistence or
recovery beyond a fresh sample session exist. Authentication cookies and form credentials never
enter Redux. Theme storage remains owned by [the theme adapter](../features/theme/theme.AGENTS.md).

## Verification

[state.store.test.ts](state.store.test.ts) exercises real generated actions, immutable transitions,
missing IDs, unchanged updates, clock replay, selector results and store isolation.
[StoreProvider.test.tsx](StoreProvider.test.tsx) verifies simultaneous providers, rerenders, account
key changes, hydration and timer/listener cleanup. Rendered features use this real provider.

Run `npm run test:state` for full handwritten branch/function/line/statement coverage, then the
web and browser gates. [vitest.state.config.ts](../../vitest.state.config.ts) owns the coverage
inventory: add new state modules to it rather than leaving owners unmeasured. Tests fix IDs/time
and do not mock Redux hooks. Browser tests verify navigation, capture, drag and theme integration;
jsdom cannot establish layout, physical-device behavior or screen-reader usability.
