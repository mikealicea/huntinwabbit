# huntinwabbit web

The authenticated job-search workspace at `/app` uses your deployed backend for saved roles,
application tracking and background posting extraction. No sample dataset is loaded at runtime.

## Available flows

- Email/password login, signup, confirmation and recovery through your configured Supabase project.
- Six-stage board with saved roles, salary, interest, priority and follow-up dates.
- Batch link capture: save immediately, then extract details in a durable backend worker.
- Direct role workspaces with persistent stage, interest, priority, follow-up and explicit note saving.
- Refresh extracted details or retry failures while retaining notes and tracking choices.
- Confirm permanent deletion from the role workspace; deleted links can be saved again.
- Drag handles and a stage selector; responsive layouts and light/dark themes.

Tasks, resumes, submitted materials and shared company research are visibly unavailable. Unsaved drafts
are temporary; accepted backend saves survive navigation and reload. Deleted postings have no restore or undo.
The [product README](../README.md) records broader intended behavior.

The inherited MDX blog remains available at `/blog` outside application navigation.

## Start locally

Run from `web/` with mise activated, or prefix npm commands with `mise exec --`:

```bash
mise install
npm ci
cp .env.example .env.local
# Configure your own Supabase project, APP_ORIGIN, APP_STAGE=dev and API_BASE_URL_DEV.
npm run dev
```

Deploy your own backend using the [server guide](../server/README.md), then put its dev Function URL
in `API_BASE_URL_DEV` in ignored `.env.local`. `APP_STAGE=dev|prod` selects `API_BASE_URL_DEV` or
`API_BASE_URL_PROD` at runtime. Local `next dev` defaults to dev; production-mode servers require an
explicit stage. Production builds can target dev. No hosted endpoint is built into the source or
used as a fallback. Keep actual deployment targets and credentials out of checked-in examples.
The [auth runbook](../docs/auth-infrastructure.md) describes authentication configuration.

Keep both stage URLs in `.env.local` using the slots in [.env.example](.env.example). After a prod
backend deployment, set `API_BASE_URL_PROD` to its API Function URL. Keep `APP_STAGE=dev` for ordinary
local work; select `APP_STAGE=prod` and restart the web server when intentionally using production
data. Git branch selection does not select the API stage. For a hosted production frontend, configure
`APP_STAGE=prod`, `API_BASE_URL_PROD`, the matching Supabase settings and its public `APP_ORIGIN`
in the hosting environment. Extraction and recovery are backend workers; their function names are
not frontend environment inputs.

Open [the app](http://localhost:3000/app). Node and npm versions come from
[mise.toml](mise.toml) and [package.json](package.json). This is an independent npm package;
there is no root workspace. Commit the lockfile when changing dependencies.

## Architecture

App Router files compose flat feature slices under `src/features/`. Each slice exports a public
`<feature>.index.ts`, colocates tests and maintains a feature guide. The application layout owns the
account-keyed Redux provider. [The API feature](src/features/job-api/job-api.AGENTS.md) owns validated
server data in RTK Query. Next.js Route Handlers forward verified tokens server-side; browsers only
call same-origin routes. Posting facts stay separate from application tracking. Feature presentation
components receive props, while containers coordinate networking and navigation.

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
separate `.next-e2e/` build output and ports 3100 (Next.js) and 3101 (fake Supabase and posting API); both ports must be free. Chromium installation is required once per browser version.
See the [browser test guide](e2e/e2e.AGENTS.md) for coverage and limitations. Test results and traces
are ignored. Root documentation changes also require both checks in the [root guide](../AGENTS.md).

`npm run test:watch` runs Vitest interactively. `npm run check:fix` and `npm run format` write changes;
review their diffs. The ordinary check command is read-only.

## Guides

[AGENTS.md](AGENTS.md) indexes feature ownership and the focused Next.js, design and accessibility
guides. The stack uses Next.js App Router, React, TypeScript, Tailwind, daisyUI, next-themes,
dnd-kit, Redux Toolkit, React Redux, Vitest, Testing Library and Playwright.
[Client state conventions](docs/state-management.md) explain local state, feature slices and
`npm run test:state`, the complete state-branch coverage gate. The [blog guide](src/features/blog/blog.AGENTS.md)
owns MDX authoring and Nextra/Pagefind integration.
