# huntinwabbit web

The initial job-search frontend lives at `/app`. It uses fictional data and in-memory edits;
reloading restores the sample dataset. Login through the shared Supabase project is required; the
Express application-data backend is not required.

## Available flows

- `/` — reserved landing page with a top-right **Open app** link.
- `/login`, `/signup`, `/forgot-password` — email/password account flows.
- `/auth/confirm`, `/reset-password` — email confirmation and password recovery.
- `/app` — six-stage board, role counts, salary, interest, priority and next actions.
- `/app/roles/[roleId]` — posting details, application choices, tasks, follow-ups, notes and materials.
- Batch capture with optional interest per link and immediate saving to Collected.
- Drag handles for moving roles between stages, plus a workspace stage selector.
- Shared company research and contacts, seeded resume choices, and separate submitted-copy metadata.
- Responsive daisyUI components, Emerald/Forest themes, and system theme preference.

Edits survive navigation within `/app`, but reloads and leaving the application can discard them.
Newly captured URLs have unknown posting details; no URLs are fetched or parsed. Resume records are
metadata only: there are no uploaded files or working document downloads. There is no persistent application storage, application-data API integration, company editor or
resume-library manager yet.
The [product README](../README.md) records the broader intended experience.

The inherited MDX blog remains available at `/blog` outside application navigation.

## Start locally

Run from `web/` with mise activated, or prefix npm commands with `mise exec --`:

```bash
mise install
npm ci
cp .env.example .env.local
# Fill SUPABASE_PUBLISHABLE_KEY in .env.local before starting.
npm run dev
```

The [auth runbook](../docs/auth-infrastructure.md) explains the shared project, email restrictions,
local environment values, and confirmation/recovery verification.

Open [the app](http://localhost:3000/app). Node and npm versions come from
[mise.toml](mise.toml) and [package.json](package.json). This is an independent npm package;
there is no root workspace. Commit the lockfile when changing dependencies.

## Architecture

App Router files compose flat feature slices under `src/features/`. Each slice exports a public
`<feature>.index.ts`, colocates tests and maintains a feature guide. The application layout owns the
mock-state provider so route changes do not discard edits. Posting facts are separate from application
choices; [job-search.types.ts](src/features/job-search/job-search.types.ts) owns the frontend contracts.
These types are not yet a server API contract. Shared behavior lives in `src/shared/` only when it
has a reusable contract.

## Verification

```bash
npm run check-types
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:auth
```

The build includes the blog's Pagefind index. Browser tests start an isolated development server on
separate `.next-e2e/` build output and ports 3100 (Next.js) and 3101 (fake Supabase); both ports must be free. Chromium installation is required once per browser version.
See the [browser test guide](e2e/e2e.AGENTS.md) for coverage and limitations. Test results and traces
are ignored. Root documentation changes also require both checks in the [root guide](../AGENTS.md).

`npm run test:watch` runs Vitest interactively. `npm run check:fix` and `npm run format` write changes;
review their diffs. The ordinary check command is read-only.

## Guides

[AGENTS.md](AGENTS.md) indexes feature ownership and the focused Next.js, design and accessibility
guides. The stack uses Next.js App Router, React, TypeScript, Tailwind, daisyUI, next-themes,
dnd-kit, Vitest, Testing Library and Playwright. The [blog guide](src/features/blog/blog.AGENTS.md)
owns MDX authoring and Nextra/Pagefind integration.
