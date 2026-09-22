# HTTP composition, errors and logging

## Purpose and owners

Shared infrastructure provides HTTP error mapping and request logging. The [server guide](../../AGENTS.md)
owns architecture, and the [auth barrel](../features/auth/auth.AGENTS.md) owns authentication.
Saved job persistence belongs to the [job-postings feature](../features/job-postings/job-postings.AGENTS.md).
There is no telemetry SDK or durable worker system.

[app.ts](../app.ts) constructs Express, installs request logging, adds public health, authentication,
the authenticated [source-guidance router](../features/source-guidance/source-guidance.AGENTS.md) before saved-role ID matching,
the saved-posting router with its own bounded JSON parser, then smaller JSON parsing, the hello router and the [job parsing router](../features/job-parsing/job-parsing.router.ts),
then installs final error middleware. [runtime.ts](../runtime.ts) validates auth, storage and parsing configuration
and chooses the concrete adapters. [local.ts](../local.ts) owns the
listener; [lambda.ts](../lambda.ts) lazily constructs and caches the Lambda adapter. Invalid auth
configuration fails construction. Public health bypasses token checks once the app is constructed;
it is not a provider-readiness check.

[shared.errors.ts](shared.errors.ts) owns AppError, its constructors and the public message envelope.
Known application errors return their status and safe message, with an optional machine-readable code.
Unauthorized responses include a bearer challenge at the application boundary. The deployed Function URL remaps that header, as
recorded in the [deployment guide](../../docs/SERVERLESS-V4.AGENTS.md). Unknown errors return a generic response. Preserve four-argument error-middleware
arity; Express uses it to recognize an error handler.

[shared.middleware.ts](shared.middleware.ts) emits request-in and request-done JSON lines containing
method and completion status/duration. It omits all paths, query strings, bodies and headers.
Error logs contain only a fixed event/category and status. Raw errors, messages and causes are not
logged; internal causes remain attached for programmatic inspection. Application error messages
are public contracts and must not contain provider prose, secrets or personal data.

## Limitations

Authentication runs before body parsing, so unauthenticated malformed input fails authentication.
Authenticated malformed-JSON and body-size failures return safe client errors with codes, never
the submitted body. Unknown parser failures retain the generic server-error mapping. All requests
passing through Express logging now receive the ordinary request log pair,
including parser failures. No Sentry SDK or automated secret scanner enforces these boundaries.
Hosting infrastructure has separate logging settings and must not log token-bearing requests.

The local listener still converts PORT directly; the auth parser validates only its own capability.
There is no application-wide readiness system or general environment schema.

## Verification

[shared.errors.test.ts](shared.errors.test.ts) covers selected error mappings, safe logging and the
unknown-error response. [Auth tests](../features/auth/auth.test.ts) exercise logging privacy, response caching,
health, auth failures and complete app ordering. [Runtime tests](../runtime.test.ts) and
[Lambda tests](../lambda.test.ts) check construction and entry-point composition. Run the server
gate and build; follow the deployment guide for packaging checks. Local tests do not prove deployed
access controls, hosting log redaction or live provider compatibility.

## Shared comment mechanics

[Comment schemas](shared.notes.schemas.ts), [store](shared.notes.ts) and
[router](shared.notes.router.ts) provide the common role/company comment contract. The store owns
bounded paging, conditional entry/pointer writes, replay recovery and content-free deletion tombstones.
Features inject owner lookup, namespace, parent transaction writes, deadlines and error mapping; shared
code never imports a feature. The router receives its authenticated route and feature error mapping.
Role and company suites verify these mechanics through their adapters, preserving existing role
versions, cleanup keys and cursor compatibility.
