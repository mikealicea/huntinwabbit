# Home redirect

[The root page](../../app/page.tsx) composes [HomePage.container.tsx](HomePage.container.tsx)
at `/`. The server container uses verified identity from the
[auth feature](../auth/auth.AGENTS.md) to redirect signed-out visitors to `/login` and signed-in
visitors to `/app`. A verification outage uses the existing authentication-unavailable page with
workspace retry; it must not masquerade as a signed-out session. No landing UI or application
state is mounted at the root.

[home.index.ts](home.index.ts) exports the server container. [Proxy](../../proxy.ts) includes `/`
so session refresh cookies persist and responses prohibit caching. Workspace routes retain their
own authentication guards.

[HomePage.test.tsx](HomePage.test.tsx) verifies the three identity outcomes.
[Auth browser tests](../../../e2e/auth.spec.ts) exercise anonymous/authenticated root navigation,
expired-session refresh, forged sessions, cache headers and outages through the real SDK and
loopback provider. [Workspace browser tests](../../../e2e/job-search.spec.ts) enter through the
root redirect. Run the full gate and browser suite in the [web guide](../../../AGENTS.md).
