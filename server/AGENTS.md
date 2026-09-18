# huntinwabbit — server

Read the [root guide](../AGENTS.md) first. It owns branch workflow, documentation ownership and
product boundaries. Shared web/server explanations belong in [root docs](../docs/README.md);
server-specific architecture and operations belong here or in the narrowest feature barrel.

## Platform and current scope

The server uses strict TypeScript, Node 24, native ESM, Express 5, Vitest, Biome and Serverless
Framework v4. Versions and commands live in [package.json](package.json),
[package-lock.json](package-lock.json) and [mise.toml](mise.toml).

This is a walking skeleton: a hello route, health route, error middleware, request logging, local
listener and Lambda wrapper. It has no database, auth boundary, queue, provider adapter or connection
to the web app. The service/org in `serverless.yml` are inherited setup values, not evidence of a
huntinwabbit deployment. Do not claim the starter is ready to accept private application data.

## Architecture and ownership

The intended boundary as real features are added is:

```text
entry point -> app composition -> feature router -> feature service -> injected adapter
```

| Concern | Executable owner |
|---|---|
| HTTP composition and middleware ordering | [src/app.ts](src/app.ts) |
| Local process and port | [src/local.ts](src/local.ts) |
| Lazy Lambda handler construction | [src/lambda.ts](src/lambda.ts) |
| Deployment entry points and AWS resources | [serverless.yml](serverless.yml) |
| ESM bundling compatibility | [esbuild.config.mjs](esbuild.config.mjs) |
| Error types and public envelope | [src/shared/shared.errors.ts](src/shared/shared.errors.ts) |
| Request logging | [src/shared/shared.middleware.ts](src/shared/shared.middleware.ts) |
| Compilation and test type checking | [tsconfig.json](tsconfig.json), [tsconfig.vitest.json](tsconfig.vitest.json) |

- Routers parse external input, invoke product logic and shape responses. Services accept plain
  values, never Express types, and use the shared typed errors. Do not invent a service layer for
  the trivial hello example.
- Construct dependencies at entry-point/app composition. As dependencies appear, inject interfaces
  into services and substitute fakes in tests; only composition chooses concrete adapters.
- Keep provider SDKs, transport details and persistence implementations behind narrow adapters.
  There is no `providers/` tree to import yet; add it only for an actual integration.
- Parse required environment at construction time and fail clearly when an enabled capability is
  misconfigured. An intentionally disabled capability differs from a configured-but-broken one.
  The current local entry point reads only `PORT`; a centralized environment parser does not exist.
- Avoid import-time I/O, network calls and credential reads in reusable modules. Entry points own
  process lifetime. The Lambda wrapper caches its constructed handler; do not cache per-user state.

## Source layout and conventions

Features are flat slices under `src/features/<feature>/`. Use `<feature>.index.ts` for public exports,
`<feature>.router.ts` for HTTP, and add `.service.ts`, `.schemas.ts` or `.types.ts` only when needed.
Tests sit beside the exercised source as `<source>.test.ts`. Shared interfaces may use
`shared.<name>.ts` and implementations `shared.<name>.<implementation>.ts`.

Import other features only through their public barrel. Shared infrastructure does not import
features. Use named exports, prefer top-level function declarations, and name booleans as predicates.
Use `unknown` and validate/narrow it at untrusted boundaries; avoid `any` and unchecked assertions.
Relative ESM imports include `.ts`; TypeScript rewrites them in emitted builds. Direct Node execution
uses erasable syntax, so avoid enums, namespaces and constructor parameter properties.

## Errors, ordering and durable work

- Validate external input at the edge and untrusted persisted values when reading them. Runtime
  validation is a behavior requirement; a TypeScript type is not input validation. Choose a schema
  library when a feature needs one rather than documenting an uninstalled dependency.
- Preserve error causes; never throw strings. Public messages must be safe for display without
  provider prose, internal identifiers, secrets or stack traces. Express 5 forwards rejected async
  handlers to error middleware; keep the final error middleware after routers.
- If jobs or paid calls are introduced, define durable ownership, idempotency and retry semantics
  before publishing work. Claim or persist required cleanup records before irreversible side effects.
  Test replay, ordering and compensation, not just the successful call sequence.
- Workers must validate messages and distinguish retryable infrastructure failure from terminal
  product failure. Keep worker budgets, provider deadlines, Lambda timeout, queue visibility and
  dead-letter handling consistent. These are future design rules; no queue exists today.
- Best-effort cleanup must not revoke a successful user result. It still needs bounded retry or
  retention and an operator-visible failure path. Avoid silent catches and unowned background work.

## Security and operations

- Never commit credentials, `.env` files, authorization headers, user content or rendered deployment
  output. Logging and observability must not expose resumes, contact details, posting URLs, application
  notes or raw provider payloads. Current logging limitations are documented in the shared barrel.
- Before adding private-data endpoints, implement and test authentication and resource ownership.
  A local development bypass must be explicit and unavailable in deployed composition. No auth
  provider or development key has been selected here.
- Keep IAM least-privilege. Reconcile actual adapter commands, resource ARNs, entry points and
  deployment tests when adding an AWS resource. Passing tests against a fake does not prove IAM.
- Distinguish build/deploy credentials from runtime secrets. A deploy-time secret lookup may expose
  plaintext in rendered configuration; use runtime retrieval when that boundary matters.
- Follow the [Serverless guide](docs/SERVERLESS-V4.AGENTS.md) before deployment/configuration work.
  Do not add conflicting build plugins or point handlers at local `build/` output.
- Deployment, vendor convergers, publication and live paid evaluations require an authorized target
  and action. Do not deploy as verification. Keep operational configuration reproducible in code;
  prefer dry-run/readback checks and import production contracts into probes rather than copying them.

## Feature and support barrels

| Area | Owner |
|---|---|
| Hello example | [hello.AGENTS.md](src/features/hello/hello.AGENTS.md) |
| HTTP composition, errors and logging | [shared.AGENTS.md](src/shared/shared.AGENTS.md) |
| Packaging, deployment configuration and IAM | [SERVERLESS-V4.AGENTS.md](docs/SERVERLESS-V4.AGENTS.md) |

Update barrels when behavior, interfaces, persistence, failure handling, ordering or operational
requirements change. Shared contracts explain the cross-stack agreement and link executable owners;
they do not duplicate exact schemas. Record suspected defects separately during documentation work.

## Development and verification

Run from `server/` with mise activated, or prefix npm commands with `mise exec --`:

```bash
mise install
npm ci
npm run dev
```

Use `PORT=3001 npm run dev` alongside the web app's default port. This is an independent npm package
with its own lockfile. Update and commit that lockfile when changing dependencies.

The mandatory server gate is:

```bash
npm run check-types && npm run check && npm test
```

`check` is read-only Biome validation; `check:fix` applies safe fixes, `format` formats, and `lint`
only lints. This repository has no automated secret scanner yet; Biome does not supply one. Review
staged additions for credentials without echoing values. Markdown and YAML need manual review too.

For compiler, entry-point and build changes also run `npm run build`. It verifies the emitted local
build, not the Serverless deployment bundle. Packaging checks belong to the deployment guide.

Tests are colocated. Test services through injected interfaces and routers through Express. Cover
meaningful guards, public errors, stored-value validation and, where present, replay, ordering and
adapter failures. Keep fixtures deterministic, avoid `.only`/`.skip`, and keep live vendor calls out
of unit tests. Do not infer implemented coverage from these requirements: current tests cover the
hello router and selected error mappings only.
