# Authenticated Hello World

This feature demonstrates the web-to-API boundary without application persistence or product policy.
The protected `/app` renders [HelloContainer](Hello.container.tsx), which connects RTK Query to the
props-only [Hello](Hello.component.tsx). The view shows idle, pending, success or safe failure and
allows an explicit retry. Pending requests disable the button; errors supersede previous results.

[hello.client.ts](hello.client.ts) owns the lazy GET and its account-local query cache. There is no
polling, automatic retry, browser credential handling or durable work. The [state provider](../../state/state.AGENTS.md)
is keyed by verified user ID, so account changes replace the cache. Repeated clicks after completion
make a new request. The client timeout exceeds the bridge's upstream deadline.

[hello.server.index.ts](hello.server.index.ts) exposes composition to the fixed
[Route Handler](../../app/api/hello/route.ts). [hello.server.ts](hello.server.ts) validates stage
configuration and uses the existing auth session helper. [hello.bridge.ts](hello.bridge.ts) injects
session verification and fetch for deterministic tests. Unverified sessions never call the backend.
Only a bearer header goes to the configured origin's root; request URLs cannot choose the target.
Redirects are rejected. Responses are private/no-store and contain only a validated hello message
or a safe error. No raw provider bodies or causes reach the browser or logs.

[hello.config.ts](hello.config.ts) owns dev/prod target selection, with no infrastructure fallback.
Loopback HTTP is permitted only for dev. [hello.types.ts](hello.types.ts) owns response validation.
Missing configuration and auth/network failures deny success; backend failures are mapped to safe
errors. A session rejected by the API asks the user to log in again. There is no mutation endpoint.

Tests cover props, a real Redux store, deliberate retry, account isolation, malformed responses,
configuration, forwarding and failures. [Browser tests](../../../e2e/hello.spec.ts) use the real
web bridge against a loopback fake backend; server tests separately exercise real JWT verification.
Run the web, state, architecture, browser and documentation gates. Local checks do not prove deployment.
