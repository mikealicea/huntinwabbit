# Workspace Redux store

This folder composes the authenticated workspace's RTK Query cache and presentation clock.
[makeStore](state.store.ts) creates a fresh store per provider; no singleton, logger or browser
persistence exists. [Provider](StoreProvider.provider.tsx) retains the store across client navigation,
installs query focus/reconnect listeners and updates the local date each minute/on visibility changes.
Cleanup removes timers and listeners. [Clock](state.clock.ts) starts empty for deterministic hydration.

The application layout keys the provider by verified user ID. Account changes, unmounts and reloads
clear the client cache; durable records remain in the backend. Auth cookies and tokens never enter
Redux. The [API feature](../features/job-api/job-api.AGENTS.md) owns server data and mutations; there
is no separate mutable copy of application records. Local form drafts remain in their UI owners.

[Hooks](state.hooks.ts) and [index](state.index.ts) expose typed composition. DevTools are disabled in
production. Follow the [state conventions](../../docs/state-management.md) and container/component
boundaries. Tests use fresh real stores, including account-key replacement, simultaneous providers,
cache reset and deterministic hydration. Run state coverage, web gates and browser tests.
