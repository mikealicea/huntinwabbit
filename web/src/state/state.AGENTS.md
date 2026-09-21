# Application Redux store

[makeStore](state.store.ts) creates a fresh RTK Query cache per [provider](StoreProvider.provider.tsx).
The protected layout keys the provider by verified user ID. Rerenders preserve results; account
changes, unmounts and reloads start fresh. There is no singleton, browser persistence, clock or logger.
No credential, cookie or access token enters Redux.

The [hello feature](../features/hello/hello.AGENTS.md) owns requests; state composition does not
duplicate results in another slice. The demo uses explicit requests without polling or automatic
focus/reconnect refresh. Auth form inputs and action feedback stay local; next-themes owns themes.
[Hooks](state.hooks.ts) and [public exports](state.index.ts) provide typed access. Production
DevTools are disabled. Server and client initial state agree for hydration.

Tests use fresh real stores and cover serialization, preloaded state, reset, simultaneous providers,
account-key replacement and hydration. Follow [state conventions](../../docs/state-management.md)
and run `npm run test:state`, web gates and browser tests when changing ownership.
