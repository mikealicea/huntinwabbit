# huntinwabbit — web application

Read the [root guide](../AGENTS.md) first for branch workflow, documentation ownership, product
boundaries and handoff. This package is huntinwabbit's primary user interface. It currently contains
an authenticated live job-search application under `/app`, a minimal landing entry at `/`, and an inherited
MDX blog. [The product README](../README.md) distinguishes implemented flows from longer-term intent.

## Executable owners

| Concern | Owner |
|---|---|
| Dependencies, npm scripts and runtime requirements | [package.json](package.json), [package-lock.json](package-lock.json), [mise.toml](mise.toml) |
| Framework composition and Nextra alias | [next.config.ts](next.config.ts) |
| TypeScript and import alias | [tsconfig.json](tsconfig.json) |
| Lint, formatting and exclusions | [biome.json](biome.json) |
| Root layout, provider lifetime and fonts | [src/app/layout.tsx](src/app/layout.tsx) |
| Brand artwork, icons and social previews | [brand asset guide](../assets/assets.AGENTS.md) |
| Tailwind and daisyUI themes | [src/app/globals.css](src/app/globals.css) |
| Test environment and cleanup | [vitest.config.ts](vitest.config.ts), [vitest.setup.ts](vitest.setup.ts) |
| Browser verification | [playwright.config.ts](playwright.config.ts), [browser test guide](e2e/e2e.AGENTS.md) |
| Application shell and state lifetime | [application layout](src/app/app/layout.tsx), [job-search barrel](src/features/job-search/job-search.AGENTS.md) |

## Architecture

- Keep App Router files in `src/app/` thin: routing, layouts, metadata and feature composition.
- Feature folders under `src/features/` are flat vertical slices. Export through
  `<feature>.index.ts`; another feature must not import their internals. Prefix support files with
  the feature name. Use the `@/*` alias for imports rooted at `src/`.
- Shared UI primitives live in `src/shared/` and export through `shared.index.ts`. Promote code
  there when it has a shared behavioral contract, not just similar markup.
- Prefer React Server Components. Keep client boundaries at the smallest useful owner of browser
  state, events or effects. The theme provider and switch are existing client components.
- Use named exports and function declarations for components. Framework-required default exports
  are the exception. Prefer children and composition to deep prop chains.
- Keep state at the narrowest owner with the right lifetime. Navigation uses Next's route system;
  do not create a parallel router in feature state. Async results must not overwrite a newer user
  choice. Durable work needs an explicit lifecycle beyond the component that displays it.
- Isolate vendor integration in the feature or adapter that owns it. UI components should not
  choose provider credentials or duplicate backend business rules. Define the web/server contract
  before introducing a real integration. The auth feature integrates directly with Supabase from
  the Next.js server; the application-data backend is accessed through the server-only API bridge.

## Container/component architecture

Read [the React architecture guide](docs/react-architecture.AGENTS.md) before changing React code.
These conventions apply across workspace, authentication, theme, navigation, public pages and shared UI.

- Use `Name.container.tsx` and a named `NameContainer` export for coordination. Containers connect
  Redux, server data, Server Actions, navigation decisions and stateful vendor adapters, and select
  which views to render. Keep substantive business decisions in pure helpers, selectors and reducers.
- Use `Name.component.tsx` and a named `Name` export for presentation. Components render typed props
  and emit callbacks. Small local `useState`, refs and UI effects are allowed; Redux connections,
  service access and workflow orchestration are not. A component needs no container unless there
  is coordination to separate.
- Presentation components must not import containers, providers or external-state adapters, even
  through feature barrels or custom hooks. Containers assemble connected children through explicit
  slots or `children`; presentation contracts must be testable without application providers.
- Keep a parent's local state local when it serves a nearby child. Use Redux for mutable feature
  state that needs broader ownership or lifetime, not simply because a prop crosses a boundary.
- Keep Server/Client Component boundaries separate from the container/component distinction.
  Preserve server composition and small client boundaries; filenames do not establish rendering mode.
  Providers and adapters use explicit `.provider.tsx`/`.adapter.tsx` roles. Next.js route filenames
  and the existing MDX integration retain their required names.
- Test components with props and observable callbacks. Test connected containers using fresh real
  stores with deterministic initial data and real actions; mock external boundaries rather than Redux.
  The [architecture checks](src/architecture/architecture.AGENTS.md) enforce naming and dependency
  rules in `npm test`; run `npm run test:architecture` for a focused check.

## State and testing conventions

Read [Client state with Redux Toolkit](docs/state-management.md) before changing state ownership.
Use pure local `useState` for component-owned state, including nearby children receiving props,
and RTK slices for mutable feature state requiring broader ownership or lifetime. Custom product-state
context/reducer providers are deprecated; use the typed Redux
hooks and generated slice actions. Keep effects outside reducers and selectors, and test every
handwritten branch in providers, actions, reducers and selectors with real stores.
The [state barrel](src/state/state.AGENTS.md) owns composition, account isolation and clock lifetime.
Run `npm run test:state` when changing state or its adapters, in addition to the gates below.

## Product, copy and data boundaries

The root README describes intended product behavior; starter content is not a product decision.
Use direct, human copy and visible labels that describe the user's task. Avoid generic marketing
language and unsupported claims about availability, privacy, accounts, storage or retention.

Do not add analytics, embeds, contact forms or third-party scripts as incidental page work. Include
the processor and data flow in the authorized feature scope and its documentation. Keep private
application data out of URLs, logs, analytics and browser-exposed configuration. If authenticated
surfaces are introduced, review script loading separately from public pages; do not inherit a
marketing script into a private layout by default.

Show truthful empty, loading, error, disabled and partial-success states. Keep missing salary or
posting details visibly unknown. Do not turn a failed operation into apparent success or discard
unrelated saved work. These are requirements for new product features, not claims of current support.

## Design and accessibility

Use Tailwind's CSS-first configuration and daisyUI semantic tokens. The current light/dark mapping
and hydration behavior belong to the theme barrel. Fonts load once in the root layout. Do not copy
Sanctum's palette, typography or single-theme policy into this app.

Read these focused guides before related changes:

| Work | Guide |
|---|---|
| React coordination, presentation and import boundaries | [React architecture](docs/react-architecture.AGENTS.md) |
| Routes, server/client boundaries, metadata and caching | [Next.js](docs/nextjs.AGENTS.md) |
| Layout, Tailwind, themes and shared visual primitives | [Design](docs/design.AGENTS.md) |
| Controls, focus, responsive text, motion and UI verification | [Accessibility](docs/accessibility.AGENTS.md) |

## Feature barrels

Read and update the narrowest barrel when behavior, interfaces, failure handling or verification
changes. Exact shapes remain in executable owners; barrels explain intent and important constraints.

| Area | Owner |
|---|---|
| Shared presentation | [shared.AGENTS.md](src/shared/shared.AGENTS.md) |
| Authentication | [auth.AGENTS.md](src/features/auth/auth.AGENTS.md) |
| Landing entry | [home.AGENTS.md](src/features/home/home.AGENTS.md) |
| Live API and stage configuration | [job-api.AGENTS.md](src/features/job-api/job-api.AGENTS.md) |
| Job-search presentation contracts | [job-search.AGENTS.md](src/features/job-search/job-search.AGENTS.md) |
| Search board and dragging | [search-board.AGENTS.md](src/features/search-board/search-board.AGENTS.md) |
| Batch link capture | [job-capture.AGENTS.md](src/features/job-capture/job-capture.AGENTS.md) |
| Role workspace | [role-workspace.AGENTS.md](src/features/role-workspace/role-workspace.AGENTS.md) |
| Navigation | [header.AGENTS.md](src/features/header/header.AGENTS.md) |
| Light/dark theme and hydration | [theme.AGENTS.md](src/features/theme/theme.AGENTS.md) |
| MDX blog, metadata and Pagefind | [blog.AGENTS.md](src/features/blog/blog.AGENTS.md) |

## Local development and verification

Run from `web/` with mise activated, or prefix npm commands with `mise exec --`:

```bash
mise install
npm ci
npm run dev
```

This is an independent npm package. Commit its lockfile when dependencies change; there is no npm
workspace. Node and its bundled npm come from `mise.toml`. Use a different local port for the server
when running both apps; each otherwise defaults to 3000.

The mandatory web gate is:

```bash
npm run check-types && npm run check && npm test && npm run build
```

`check-types` generates route types before TypeScript checking. `check` runs Biome without writing;
`check:fix` applies safe fixes, `format` writes formatting, and `lint` only lints. Review written
diffs. Markdown/MDX are reviewed manually and Tailwind utility sorting is not enabled.

The build includes Pagefind via `postbuild`; it verifies route, MDX and static-generation integration.
Unit tests do not replace it. Generated `.next/`, `next-env.d.ts`, TypeScript caches and Pagefind
output are local artifacts, not source to commit.

For application interaction changes, also run `npm run test:e2e`. Install its browser once with
`npx playwright install chromium`. The [browser test guide](e2e/e2e.AGENTS.md) explains the isolated
local server on port 3100 and ignored test artifacts. The suite does not need the backend.

Tests are colocated with features. Vitest defaults to Node; rendered tests opt into jsdom. Test
user-visible outcomes through accessible roles and labels, with deterministic data and narrow mocks
for external framework/content boundaries. Cover meaningful errors and state transitions. Do not
commit `.only` or `.skip`, or claim browser accessibility from jsdom tests alone. For UI changes,
record the browser, viewport, states and manual accessibility checks actually exercised.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
