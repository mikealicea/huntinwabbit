# Authentication infrastructure

Supabase owns identities and sessions. The [web auth feature](../web/src/features/auth/auth.AGENTS.md)
implements account flows and protects `/app`; the [API auth feature](../server/src/features/auth/auth.AGENTS.md)
independently verifies bearer JWTs. The [hello bridge](../web/src/features/hello/hello.AGENTS.md)
verifies web identity before forwarding a token server-side. There is no application data storage.

## Configuration and shared project

Use an existing hosted project through ignored environment files. Web needs SUPABASE_URL,
SUPABASE_PUBLISHABLE_KEY and APP_ORIGIN; the API needs SUPABASE_URL. See the
[web example](../web/.env.example) and [server example](../server/.env.example).
The API accepts HTTPS provider origins; the web also permits loopback HTTP for its isolated test fixture.
Management and service-role credentials never belong in application configuration or browser code.

Dev, production and the starter may share users, signing authority and auth policy. A separate AWS
service name does not isolate Supabase. Use dedicated test accounts. Sign-out targets its own
session; password changes and provider configuration can affect other applications using the project.

[Supabase configuration](../supabase/supabase.AGENTS.md) owns the checked-in settings and email
templates. Existing hosted settings are not changed by starting either app. Confirmation/recovery
requires the app's exact `/auth/confirm` URL in the provider allowlist. APP_ORIGIN must match where
users open the frontend. Templates use the request's RedirectTo, not a hard-coded application host.

The explicit `mise run auth:push` operation reads its project reference and production URLs from
ignored `supabase/.env` or the shell. It can change a shared live project, including email branding.
Review the complete CLI diff and obtain authorization for that target/action before pushing.
Do not push merely to test login. After an authorized push, repeat the comparison and require the
up-to-date message; declining a prompt can still exit successfully. No new project is required.

## Data boundary and failures

The Next.js server processes email/password forms and forwards them to Supabase. Supabase processes
account identifiers, authentication data, sessions and request metadata. Tokens remain in HTTP-only
cookies; credentials, sessions and tokens never enter Redux. Do not log form bodies, cookie/header
values, provider error causes, or token-bearing confirmation URLs in app or hosting logs.

Web access uses provider-verified identity. Failed verification denies access or shows the independent
retry page. Confirmation preview GETs do not consume tokens; the explicit POST exchanges them and
redirects to a clean URL. Server-side backend requests prohibit redirects and caching.

The API fetches public signing keys without sending user tokens to discovery. Local JWT verification
does not promise immediate logout/account-deletion revocation; valid tokens and cached keys have
finite lifetimes owned by the verifier. No account deletion, profile editing or MFA UI is implemented.

## Verification

Local auth/unit/browser tests use controlled boundaries and fictional credentials. They do not
prove hosted email delivery, SMTP configuration, quotas or deployed logging behavior.
The [API smoke suite](../server/e2e/e2e.AGENTS.md) can sign in an existing dedicated development
account, exercise the chosen API and sign out that test session. It does not provision users or
change policies. Keep actual test credentials in ignored files or environment variables.

For an explicitly authorized email-flow test, verify signup confirmation in a fresh browser,
password recovery, and login after reset using a dedicated account. Such tests mutate account state
and consume provider email quota. The starter makes no guarantee about an existing project's email
sender; verify its configuration before public signup.
