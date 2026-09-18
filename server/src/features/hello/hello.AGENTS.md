# Hello example

This feature is inherited route scaffolding, not a huntinwabbit product endpoint. It has no input,
service, persistence, authentication, external side effects or retries. Replace it when a real feature
supersedes the example; do not create speculative infrastructure around it.

[hello.index.ts](hello.index.ts) exports `createHelloRouter` from
[hello.router.ts](hello.router.ts). [The app](../../app.ts) mounts that router and separately owns
health and error middleware. Exact route and response values belong to the router.

[hello.router.test.ts](hello.router.test.ts) exercises the hello response through an Express fixture.
It does not cover the complete application or deployed Lambda wiring. Run the mandatory server gate
from the [server guide](../../../AGENTS.md). HTTP tests bind local sockets; sandbox restrictions must
be reported or resolved at the test environment, not by skipping assertions.
