# Protected hello endpoint

This is the backend's first authenticated application endpoint: a fixed hello-world response proving
that a caller passed the API auth boundary. It has no input, service, persistence or external side
effects. It returns no account details and does not demonstrate resource ownership authorization.

[hello.index.ts](hello.index.ts) exports `createHelloRouter` from
[hello.router.ts](hello.router.ts), which owns the exact route and successful response.
[The app](../../app.ts) mounts this router after [authentication](../auth/auth.AGENTS.md), and separately
owns public health and error middleware. The router must not be mounted publicly in runtime
composition. No extra hello service layer is needed.

[hello.router.test.ts](hello.router.test.ts) tests the response in isolation.
[Auth composition tests](../auth/auth.test.ts) establish protected/public route behavior, and
[Lambda tests](../../lambda.test.ts) cover Function URL composition. Run the mandatory server gate
from the [server guide](../../../AGENTS.md). HTTP tests bind local sockets; sandbox restrictions must
be reported or resolved at the test environment, not by skipping assertions.

The opt-in [live E2E suite](../../../e2e/e2e.AGENTS.md) verifies this response with a real hosted-user
token through the configured deployed endpoint, along with public health and authentication failures.
