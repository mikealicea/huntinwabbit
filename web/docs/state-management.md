# Client state with Redux Toolkit

Adopted 2026-09-18 after reviewing the Redux team's guidance. Dependencies and resolved versions
are owned by [package.json](../package.json) and its lockfile; recheck npm's stable `latest` tags
when upgrading. This decision concerns the web app, not server request state or authentication.

## Ownership and purity

Use local `useState` for component-owned drafts, visibility and feedback. Updaters must be pure:
allocate IDs and read external values before calling them. A local parent may pass values and
callbacks to nearby children; that alone does not require Redux.
Move mutable feature state into an RTK slice when its ownership or lifetime extends beyond the
local interaction. Do not add custom context/reducer providers for product
state or copy slice values into synchronized local state. Props remain appropriate for data,
callbacks and composition slots. These choices follow the [Redux style guide](https://redux.js.org/style-guide/).

Use `configureStore`, `createSlice`, generated typed actions, and the app's typed React Redux hooks.
Reducers and selectors are deterministic functions of their inputs. Immer draft writes belong
only inside RTK reducers; never mutate selected objects. Keep actions and state serializable.
Clocks, random IDs, storage, DOM operations and requests belong at external boundaries, with their
results passed in actions. Keep RTK's default mutation and serializability checks enabled.
The [usage guide](https://redux-toolkit.js.org/usage/usage-guide) explains the baseline; the current
[createSlice reference](https://redux-toolkit.js.org/api/createSlice) owns exact supported APIs.

Select the smallest useful state and derive counts, labels and filtered views. Memoize selectors
that allocate arrays or objects; plain lookups and primitives do not need memoization. Do not store
derived copies. Preserve collection order and use IDs for relationships. Introduce an entity adapter
when collection operations justify it, not as a prerequisite for a small ordered collection.
See [deriving data](https://redux.js.org/usage/deriving-data-selectors) and
[typed hooks](https://react-redux.js.org/using-react-redux/usage-with-typescript).

## React coordination and presentation

Follow [container/component architecture](react-architecture.AGENTS.md). Containers own Redux
subscriptions and dispatch, and pass selected data and intent callbacks to components. Presentational
components must not reach Redux through a helper, hook or public barrel. Keep selectors and reducers
pure; container code coordinates them rather than becoming another business-logic layer.

Local drafts and UI state may live in a component or a container, whichever owns the interaction.
Simple toggles remain local. `useActionState` belongs in action-coordinating containers; credentials
and form feedback must not move into Redux. Third-party browser state remains in its vendor adapter.

## App Router lifetime and boundaries

Create a store per mounted workspace provider; never export a module-global store. The verified
user ID keys the provider. Navigation within the workspace keeps edits; a new account or unmount
creates a new session. Server Components authorize and compose children without reading or writing
Redux. Server and first-client initial state must agree; the date clock starts after hydration.
This follows [RTK's Next.js guidance](https://redux-toolkit.js.org/usage/nextjs).

Third-party contexts are adapters with separate responsibilities: `next-themes` owns pre-paint theme
resolution, system preference and theme storage; dnd-kit owns drag sensors and accessibility.
Do not mirror their state in Redux or replace these mechanics with product-state providers.
Auth inputs remain local and credentials/sessions stay at the existing server boundary. Routes stay
in Next's router. Redux does not add persistence, authorization, extraction or a backend integration.
Production Redux DevTools are disabled; do not add payload logging or persist personal workspace data.

Live server-data caching uses RTK Query in the job-api feature. Use thunks for
one-shot orchestration and listener middleware for workflows reacting to actions. Define cancellation,
stale responses, retries and account reset behavior with the feature; never start durable work from
a page effect. These choices follow [Redux's effects guidance](https://redux.js.org/usage/side-effects-approaches).
Do not duplicate API records in a second mutable feature slice.

## Verification policy

Render connected features with a fresh real store and the real provider. Do not mock Redux hooks,
actions, reducers or selectors. Test user-visible outcomes through Testing Library and browser
navigation. This adopts [Redux's testing guidance](https://redux.js.org/usage/writing-tests).

Additionally, this repository requires tests for every handwritten branch in providers, actions,
reducers and selectors: success, empty/no-op, missing IDs, repeated events and cleanup where applicable.
Use action creators in tests to exercise their contracts with reducer behavior, not just action strings.
Check immutable inputs, unrelated state, submitted snapshots and store/account isolation. Fix dates
and IDs in unit tests; exercise clock updates and timer/listener cleanup with fake time.

`npm run test:state` enforces complete branch/function/line/statement coverage of the state owners
and theme adapter. Coverage complements behavioral assertions; never exclude a reachable branch to
make the gate pass. Extend the coverage inventory when adding state owners. Run this alongside the
full web, browser and documentation gates in [the web guide](../AGENTS.md).

The implementation map and current failure semantics live in the
[state barrel](../src/state/state.AGENTS.md) and
[job-search barrel](../src/features/job-search/job-search.AGENTS.md).
