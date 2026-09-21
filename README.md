# huntinwabbit-boilerplate

An authenticated Next.js frontend and Express/Serverless API starter, with reusable development
practices, feature guides, tests, and a product research workspace.

## What is included

- Email/password signup, login, confirmation, recovery, session refresh and sign-out through Supabase.
- A public entry page and a protected `/app` with a Hello World API demonstration.
- A server-only web bridge, independent API JWT verification, and account-isolated Redux Toolkit state.
- Light/dark themes, container/component architecture checks, colocated tests and browser tests.
- Independent npm/mise projects, documentation validation, deployment configuration and research tools.

There is no application database, job-search functionality, blog, AI integration or background worker.
Supabase owns accounts and sessions. The demo stores no application records.

## Local setup

Read [AGENTS.md](AGENTS.md) for workflow and verification. Run `mise install` and `npm ci`
separately inside `web/` and `server/`, using `mise exec --` if mise is not active in your shell.
There is no root npm workspace.

1. Copy `server/.env.example` to ignored `server/.env` and set your existing Supabase project URL.
2. Copy `web/.env.example` to ignored `web/.env.local`. Supply that project's URL and publishable key,
   set `APP_ORIGIN=http://localhost:3000`, `APP_STAGE=dev`, and `API_BASE_URL_DEV=http://localhost:3001`.
3. In `server/`, run `mise exec -- npm run dev`; in `web/`, run `mise exec -- npm run dev`.
4. Open `http://localhost:3000`, sign in, and select **Call API**. Success displays **Hello, world!**.

An existing Supabase project can be reused; no new instance is necessary. Account mutations affect
that shared project. For signup/recovery, the callback must be allowlisted by the provider.
See [authentication setup and privacy](docs/auth-infrastructure.md). Keep actual project identifiers,
API endpoints and credentials out of source control.

## Infrastructure and verification

The Serverless service is `huntinwabbit-boilerplate`, separate from the original application.
This source does not claim a deployed boilerplate. Deployment and Supabase config pushes are explicit
operator actions, never required to run local tests. Shared Supabase settings remain shared even
when AWS service names differ. See [deployment guidance](server/docs/SERVERLESS-V4.AGENTS.md).

Use the gates in the [web guide](web/AGENTS.md), [server guide](server/AGENTS.md), and
[documentation guide](scripts/scripts.AGENTS.md). Browser tests use an isolated fake provider;
live auth testing is separate and opt-in.

Start new product research in [product-workspace](product-workspace/product-workspace.AGENTS.md).
The [documentation index](docs/README.md) describes where durable explanations belong.
