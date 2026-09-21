# huntinwabbit server

The backend uses Node 24, strict TypeScript, native ESM and Express 5 via Serverless Framework v4.
It provides authentication and opt-in synchronous job URL parsing. It does not yet persist the
job-search workspace described in the [product README](../README.md).

See `AGENTS.md` for architecture, conventions, and the Definition of Done.

## Getting started

```sh
mise install   # pinned Node 24 and its bundled npm
npm ci
cp .env.example .env  # auth needs no API/signing secret; parsing starts disabled
npm run dev    # local server on http://localhost:3001 with the example environment
```

Run commands from `server/` with mise activated, or use `mise exec -- npm ...`. This is an
independent npm project with its own `package-lock.json`; there is no npm workspace. Use
`npm install` when changing dependencies and commit the updated lockfile.

`GET /` requires a Supabase user access token and returns `{ "message": "Hello, world!" }`.
`GET /health` is public and returns `{ "message": "ok" }`. Both local and Lambda entry points
require valid SUPABASE_URL configuration. Missing or invalid credentials return 401; key-discovery
outages return 503 when cached keys cannot be used. Protected responses prohibit caching.

Use a current access token from a dedicated development account for a deliberate smoke test.
Supply it through an ephemeral ACCESS_TOKEN variable from a trusted local client; do not paste it
into source, shell history, tickets or logs. This API does not accept publishable/service keys,
refresh tokens, cookies or legacy HS256 tokens. Keep verbose HTTP tracing off. To keep the token
out of curl's command-line arguments, pass its header through standard input:

```sh
curl --fail-with-body http://localhost:3001/health
printf 'Authorization: Bearer %s\n' "$ACCESS_TOKEN" | curl --fail-with-body --header @- http://localhost:3001/
unset ACCESS_TOKEN
```

Without the header, the hello request must return 401. Automated tests use local signing keys and
fake discovery responses; they do not establish live token compatibility. An unsupported hosted
signing algorithm needs separately scoped provider setup, not an automatic rotation. See the
[auth barrel](src/features/auth/auth.AGENTS.md) and [shared runbook](../docs/auth-infrastructure.md)
for verification, failure and revocation boundaries. Web-to-API calls and data persistence remain
future work.

## Available scripts

- `dev` / `start` — run the local server (watch mode / no watch)
- `check-types` — type-check without emitting output
- `check` — verify Biome formatting, lint and import organization without writing
- `check:fix` — apply safe Biome fixes
- `lint` / `format` — lint only / write formatting only
- `test` / `test:watch` / `test:coverage` — Vitest
- `test:e2e` — opt-in live API tests with a dedicated Supabase development account
- `build` — type-check and transpile to `build/` (not used for deploys — Serverless v4 bundles
  `src/` with esbuild)

## Live end-to-end verification

From `server/`, copy `.env.e2e.example` to ignored `.env.e2e` and fill in this project's publishable
key. The example selects the deployed dev API and the existing ignored development-account file.
Alternatively supply E2E_EMAIL and E2E_PASSWORD together from your environment/secret store.

```sh
mise exec -- npm run test:e2e
```

This command signs in once, checks health, successful authentication, invalid credential rejection
and concurrent request isolation, then signs out its test session. Missing configuration fails the
run. It does not provision users or deploy code. The ordinary `npm test` stays offline. See the
[E2E guide](e2e/e2e.AGENTS.md) for credentials, coverage and limits.

## Deploying

Deployment is a separate authorized operation, not a verification step. The dev target is
`huntinwabbit-dev` in the `builtinspace` AWS account. Read
[the deployment guide](docs/SERVERLESS-V4.AGENTS.md), select the intended stage and access boundary,
and verify packaging before deploying:

```sh
npx --no-install serverless deploy --stage <authorized-stage>
```

Set SUPABASE_URL in the packaging/deployment environment; Serverless passes it to Lambda.
The API enforces bearer authentication in Express behind the existing Function URL.

Requires `SERVERLESS_ACCESS_KEY` (or a license key). See `docs/SERVERLESS-V4.AGENTS.md` for
Serverless Framework v4 specifics.

## Parse a job posting

In ignored `server/.env`, set `JOB_PARSING_ENABLED=true` and `REDPILL_API_KEY` to a valid key.
The capability is disabled by default; enabling it without a key fails startup. The model and
provider URL are fixed in the [configuration](src/features/job-parsing/job-parsing.config.ts).

Send an authenticated JSON request to `POST /job-postings/parse`:

```sh
printf 'Authorization: Bearer %s\n' "$ACCESS_TOKEN" | \
  curl --request POST http://localhost:3001/job-postings/parse --header @- \
  --header 'Content-Type: application/json' \
  --data '{"url":"jobs.example.com/role"}'
```

Full HTTP(S), `www` and bare links are accepted. The response contains versioned source metadata,
job facts and missing-fact warnings; see the [executable schemas](src/features/job-parsing/job-parsing.schemas.ts)
for exact fields and [errors](src/features/job-parsing/job-parsing.errors.ts) for codes. Missing
facts remain null/empty; blocked, expired or unusable pages produce explicit failures. Requests can
take up to the application deadline and are independent: retries can repeat paid inference.
No parsed results are stored, and the web app does not call this endpoint yet.

See the [feature barrel](src/features/job-parsing/job-parsing.AGENTS.md) for agent-fetch limitations
and the [processor boundary](../docs/job-parsing-data-boundary.md) for what is sent to Redpill.
The opt-in `npm run test:job-parsing:live` suite reads `.env`, contacts the four example sites and
can make one paid inference call per retrieved posting. See [live-test guidance](e2e/e2e.AGENTS.md).
