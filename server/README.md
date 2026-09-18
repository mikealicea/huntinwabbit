# huntinwabbit server

The backend currently contains an HTTP API skeleton: Node 24, strict TypeScript, native ESM and
Express 5 via Serverless Framework v4. It does not yet implement the job-search experience in
the [product README](../README.md).

See `AGENTS.md` for architecture, conventions, and the Definition of Done.

## Getting started

```sh
mise install   # pinned Node 24 and its bundled npm
npm ci
npm run dev    # local server on http://localhost:3000
```

Run commands from `server/` with mise activated, or use `mise exec -- npm ...`. This is an
independent npm project with its own `package-lock.json`; there is no npm workspace. Use
`npm install` when changing dependencies and commit the updated lockfile.

`GET /` returns `{ "message": "Hello, world!" }` and `GET /health` returns `{ "message": "ok" }`.
The `hello` feature (`src/features/hello/`) is example scaffolding — copy it as the template for
your first real feature, then delete it.

## Available scripts

- `dev` / `start` — run the local server (watch mode / no watch)
- `check-types` — type-check without emitting output
- `check` — verify Biome formatting, lint and import organization without writing
- `check:fix` — apply safe Biome fixes
- `lint` / `format` — lint only / write formatting only
- `test` / `test:watch` / `test:coverage` — Vitest
- `build` — type-check and transpile to `build/` (not used for deploys — Serverless v4 bundles
  `src/` with esbuild)

## Deploying

Deployment is a separate authorized operation, not a verification step. The current service/org
values are inherited setup. Read [the deployment guide](docs/SERVERLESS-V4.AGENTS.md), select the
intended account, stage and access boundary, and verify packaging before deploying:

```sh
npx --no-install serverless deploy --stage <authorized-stage>
```

Requires `SERVERLESS_ACCESS_KEY` (or a license key). See `docs/SERVERLESS-V4.AGENTS.md` for
Serverless Framework v4 specifics.
