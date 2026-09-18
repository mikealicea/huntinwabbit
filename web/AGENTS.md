# huntinwabbit — web application

Read the [root guide](../AGENTS.md) first for branch workflow, documentation ownership, product
boundaries and handoff. This package is huntinwabbit's primary user interface. It currently contains
starter home, navigation, theme and MDX blog features, not the job-search experience described in
[the product README](../README.md).

## Executable owners

| Concern | Owner |
|---|---|
| Dependencies, npm scripts and runtime requirements | [package.json](package.json), [package-lock.json](package-lock.json), [mise.toml](mise.toml) |
| Framework composition and Nextra alias | [next.config.ts](next.config.ts) |
| TypeScript and import alias | [tsconfig.json](tsconfig.json) |
| Lint, formatting and exclusions | [biome.json](biome.json) |
| Root layout, provider lifetime and fonts | [src/app/layout.tsx](src/app/layout.tsx) |
| Tailwind and daisyUI themes | [src/app/globals.css](src/app/globals.css) |
| Test environment and cleanup | [vitest.config.ts](vitest.config.ts), [vitest.setup.ts](vitest.setup.ts) |

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
  before introducing a real integration; no API client or authentication flow exists here yet.

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
| Routes, server/client boundaries, metadata and caching | [Next.js](docs/nextjs.AGENTS.md) |
| Layout, Tailwind, themes and shared visual primitives | [Design](docs/design.AGENTS.md) |
| Controls, focus, responsive text, motion and UI verification | [Accessibility](docs/accessibility.AGENTS.md) |

## Feature barrels

Read and update the narrowest barrel when behavior, interfaces, failure handling or verification
changes. Exact shapes remain in executable owners; barrels explain intent and important constraints.

| Area | Owner |
|---|---|
| Starter home | [home.AGENTS.md](src/features/home/home.AGENTS.md) |
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

Tests are colocated with features. Vitest defaults to Node; rendered tests opt into jsdom. Test
user-visible outcomes through accessible roles and labels, with deterministic data and narrow mocks
for external framework/content boundaries. Cover meaningful errors and state transitions. Do not
commit `.only` or `.skip`, or claim browser accessibility from jsdom tests alone. For UI changes,
record the browser, viewport, states and manual accessibility checks actually exercised.
