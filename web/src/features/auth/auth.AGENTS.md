# Web authentication

## Purpose and boundaries

Email/password account flows use the existing shared Supabase project. Login is required for the
workspace and role routes. Supabase owns identities, credentials and sessions; application data is stored through the authenticated backend. This feature adds neither Express API authorization nor
DynamoDB persistence, account deletion, profile editing, social login or MFA enrollment/challenges.
The root [auth runbook](../../../../docs/auth-infrastructure.md) owns provider configuration and
the processor boundary. Do not relax the shared project's policies for tests.

## Owners and contracts

- [auth.server.index.ts](auth.server.index.ts) exports server composition, actions, guards and Proxy
  refresh. [auth.index.ts](auth.index.ts) exports the client sign-out control and its action type.
- [auth.operations.ts](auth.operations.ts) owns validation ordering, provider mutations and safe
  outcomes. [auth.validation.ts](auth.validation.ts) owns input and redirect boundaries.
- [auth.client.ts](auth.client.ts), [auth.config.ts](auth.config.ts) and
  [auth.session.ts](auth.session.ts) own per-request SDK construction, environment validation,
  cookies and server verification. [auth.proxy.ts](auth.proxy.ts) persists refreshes before rendering.
- [AuthPage.container.tsx](AuthPage.container.tsx) coordinates server identity and page selection;
  [AuthFrame.container.tsx](AuthFrame.container.tsx) supplies a theme-control slot to the
  [frame component](AuthFrame.component.tsx).
  The frame centers the supplied rabbit/wordmark inside the auth card, directly above its heading,
  and links home. CSS selects
  the light/dark artwork through the existing theme attribute without adding client theme state.
  Both decorative images share one accessible link label; [brand assets](../../../../assets/assets.AGENTS.md)
  owns their source and optimized exports.
- [AuthForm.container.tsx](AuthForm.container.tsx) owns action/pending lifecycles and the sign-out
  recovery slot. [AuthForm.component.tsx](AuthForm.component.tsx) owns transient local inputs and
  focus, renders supplied action feedback and emits form submissions. Credentials never enter Redux.
- [ConfirmForm.container.tsx](ConfirmForm.container.tsx) and [SignOutButton.container.tsx](SignOutButton.container.tsx)
  coordinate their action lifecycles; [confirmation](ConfirmForm.component.tsx) and
  [sign-out](SignOutButton.component.tsx) presentation receive status and submit callbacks.
  [PasswordField.component.tsx](PasswordField.component.tsx) keeps its simple show/hide state local.
  [AuthConfirmationPage.container.tsx](AuthConfirmationPage.container.tsx) composes the explicit POST flow.

## Sessions, failures and recovery

Server Actions send credentials to Supabase over server-side requests. Tokens stay in HTTP-only,
same-site cookies, secure on HTTPS; no browser SDK or application-data storage is introduced.
`getUser()` verifies identity remotely; never authorize from cookie contents or `getSession()`.
Proxy and protected server entry points fail closed. An outage goes to an independent retry page,
not a login loop. Retry performs a full document navigation because Next may serve the error
content at the original action redirect URL. Proxy copies all refreshed cookie chunks to the request and response, including
redirect responses. Absolute redirects use configured APP_ORIGIN so framework loopback normalization cannot change
cookie scope. Auth and private
responses prohibit caching. The public blog's scripts do not load in these layouts.

Login return destinations stay under `/app`. Email destinations come from configured APP_ORIGIN,
not request headers. Supabase verifies opaque token hashes; a preview GET never consumes a token.
Confirmation POST exchanges email/recovery tokens and redirects to a clean URL. Invalid, expired
and reused links offer another request. Token-bearing pages set no-referrer metadata/headers and
must not acquire analytics or request-URL logging. Next development request logging excludes the
confirmation endpoint in the framework config. Do not log action payloads or raw provider errors.

Email request feedback does not disclose whether an account exists. Client forms disable competing
submissions while pending. There is no application-level automatic retry for account mutations.
Supabase owns delivery quotas; users receive rate-limit feedback and can retry deliberately.

Password updates require a freshly verified identity. Supabase's secure-change policy may require
a new recovery email for an old session. Update success remains success even if subsequent logout
fails. Local cookies are cleared and a notice distinguishes unconfirmed remote revocation. If cookie
cleanup itself fails, the form replaces password submission with sign-out retry. The SDK also clears
its local session on remote logout errors; ordinary sign out therefore reports browser sign-out
separately from provider revocation. Only the current session is targeted; do not promise immediate
invalidation of all outstanding access tokens or other devices.

Session refresh happens on requests, not a background browser timer. Saved application data persists through the backend. Its [Redux provider](../../state/state.AGENTS.md) is keyed by verified
user ID. Auth inputs and Server Action feedback stay local; credentials and tokens never enter Redux. A server response lost after
a provider mutation can leave its outcome uncertain; this feature has no durable operation ledger.
Do not silently repeat password updates to resolve that uncertainty.

## Verification

Run the full web gate and Playwright suite in [the web guide](../../../AGENTS.md), plus `npm run
test:auth`. The coverage configuration requires all statements, branches, functions and lines in
handwritten auth implementation files; export-only barrels are excluded. [Props-based tests](auth.presentation.test.tsx) render presentation without auth/theme adapters;
[container interaction tests](auth.components.test.tsx) exercise real React action lifecycles with
controlled action boundaries. Tests cover every new component, configuration, provider failures, verification ordering, cookie refresh/cleanup,
redirect validation, token handling, and password-update partial success. Keep cases for both arms
when adding a decision; coverage is evidence of execution, not proof of provider behavior.

[Browser tests](../../../e2e/auth.spec.ts) exercise the real SDK against an isolated fake HTTP
provider, including fresh-browser confirmation/recovery, previews, reused links, forged/expired
cookies, sign-out failure, mobile themes and enlarged text. Existing workspace tests authenticate
through the real form. Do not add a runtime auth bypass. Hosted template readback and email delivery
are separate checks; record them explicitly and do not claim fake-provider tests establish delivery.
Screen-reader and physical-device checks require separate manual evidence.

## Backend forwarding

The server-only session helper verifies identity with getUser before retrieving a token for that same
user with getSession. Route Handlers can persist refreshed cookies. The token remains server-side;
the [API bridge](../job-api/job-api.AGENTS.md) validates Origin on mutations and sends bearer credentials
to the configured stage only. Failed verification does not call the application-data backend.
