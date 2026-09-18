# HTTP composition, errors and logging

## Purpose and owners

The starter shares HTTP error mapping and request logging. There is no persistence, authentication,
telemetry SDK or durable worker system. The [server guide](../../AGENTS.md) owns conventions for
adding those boundaries.

[app.ts](../app.ts) constructs Express, installs JSON parsing and request logging, adds health and
the hello router, then installs the final error middleware. [local.ts](../local.ts) owns the process
listener; [lambda.ts](../lambda.ts) lazily constructs and caches the Lambda adapter.

[shared.errors.ts](shared.errors.ts) owns `AppError`, its constructors and the public error envelope.
Known application errors return their status and message. Unknown errors return a generic response.
Preserve four-argument error-middleware arity; Express uses it to recognize an error handler.

[shared.middleware.ts](shared.middleware.ts) emits request-in and request-done JSON lines with
method/path and completion status/duration. It does not log request bodies or query strings.

## Known limitations and required boundaries

Current request logs contain raw paths, and the error middleware logs raw error objects/causes.
Those are starter behaviors, not a privacy guarantee. Before handling personal data, design safe
route identifiers and error metadata, redact sensitive fields, and test that logging boundary.
Do not add application IDs, posting URLs, filenames, resumes or provider payloads to operational
records. No Sentry SDK or automated secret scanner currently enforces these rules.

The JSON parser runs before request logging, so parser failures do not receive the normal request
log pair. Non-`AppError` failures, including parser errors, currently become the generic server error;
there is no dedicated malformed-input mapping. Record changes to this behavior as an implementation
change, not as a silent documentation correction.

No central environment parser exists. `local.ts` converts `PORT` directly; new required configuration
needs explicit validation at construction time. Do not describe future dependency injection or
configuration gates as implemented.

## Verification

[shared.errors.test.ts](shared.errors.test.ts) covers selected application-error mappings and the
unknown-error public response. It does not prove log redaction, request logging, parser behavior,
health, full app composition or Lambda packaging. Run the server gate; add focused regression tests
when implementing those contracts. Follow the deployment guide for packaging/entry-point changes.
