# Authentication infrastructure

The adopted split is Supabase Auth for identities and sessions, and DynamoDB for application data
behind the Express/Lambda backend. The [Supabase barrel](../supabase/supabase.AGENTS.md) describes
the configuration boundary. The [web auth feature](../web/src/features/auth/auth.AGENTS.md) implements
login, signup, email confirmation, recovery, session handling and protected workspace routes. The
[API auth feature](../server/src/features/auth/auth.AGENTS.md) verifies bearer JWTs for the
protected API endpoints. The [saved-postings feature](../server/src/features/job-postings/job-postings.AGENTS.md)
implements user-owned DynamoDB storage. Web-to-API calls remain separate work; current web data is fictional.

## One shared project

The remote target is pinned in [mise.toml](../mise.toml). Dev and prod share users, auth policies,
email quotas and signing authority. A dev token cannot be distinguished from a production token by
project issuer alone. Backend authentication verifies signature, issuer, audience and expiry. Resource authorization must derive ownership from the verified user ID and select DynamoDB resources from
trusted deployment configuration. Do not accept a client-selected table or environment.

Use dedicated development accounts. A password reset, user deletion, provider change or signing-key
rotation affects the shared project. Keep dev/prod application data separate when adding DynamoDB
resources in [serverless.yml](../server/serverless.yml); saved-posting tables are stage-specific.

## Setup and configuration changes

From the repository root:

```sh
mise trust
mise install
mise exec -- supabase login
mise run auth:push
```

The existing CLI login can be reused. Automation may supply `SUPABASE_ACCESS_TOKEN` from a secret
store instead. This is a management credential, not an application API key. The task explicitly
targets the existing project and requires neither database credentials nor `supabase link`.
No Terraform state, new hosted compute, local Docker stack or root npm package is needed.

Review each CLI diff before accepting its prompt. The pinned CLI also considers API, database and
Storage configuration; keep unrelated changes out of an auth push. Do not use `--yes` for unattended
pushes without reviewing the complete change. Rerun `mise run auth:push` after applying and require
the auth up-to-date message; a successful exit after declining a prompt does not verify deployment.
Use `mise run docs:check` for local documentation validation.

## Localhost now, deployed URLs later

[config.toml](../supabase/config.toml) contains the current localhost Site URL and redirect allowlist.
The web app implements `/auth/confirm` for both confirmation and recovery emails. When deploying the app:

1. Set `auth.site_url` to the canonical HTTPS production origin.
2. Add the exact dev/prod callback and recovery destinations implemented by the app to
   `auth.additional_redirect_urls`, retaining localhost entries. Avoid broad hosted-domain wildcards.
3. Push once to the shared project, then verify readback. There are no separate dev/prod pushes.
4. Set each web deployment’s APP_ORIGIN to its own HTTPS origin. The app explicitly requests
   APP_ORIGIN plus `/auth/confirm`; templates use RedirectTo rather than the shared Site URL.

The app integration uses `https://zjwbikkvzexdplwudzqy.supabase.co` and a publishable API key.
The hosted issuer is that URL plus `/auth/v1`, and its public JWKS endpoint is the issuer plus
`/.well-known/jwks.json`. The Express API verifies asymmetric access tokens against these public keys;
web route protection uses Supabase’s verified user lookup. Public discovery advertised an ES256 key when
read on 2026-09-19. A dedicated development user's password sign-in and authenticated call to the
deployed API later passed with an ES256 token on that date; the
[deployment guide](../server/docs/SERVERLESS-V4.AGENTS.md) records the checks and their limits.
This setup does not rotate signing keys.
The management token and secret/service-role keys must never enter browser configuration.

## API environment and verification

A dedicated Codex development account is available for deliberate live smoke tests. Its credentials
are kept in the ignored root `.env.codex-dev.json` file with owner-only permissions, not in application
configuration or fixtures. Only the test user's credentials are retained there; administrative keys
and access/refresh tokens are not saved. The account was individually confirmed through the admin
API, so its creation does not establish that signup emails work. Shared auth policies were unchanged.
The opt-in [API E2E suite](../server/e2e/e2e.AGENTS.md) uses this account, or explicit environment
credentials, to sign in and verify the configured live API. It signs out its own session afterward;
it neither provisions accounts nor changes provider settings.

[The server environment example](../server/.env.example) supplies the shared hosted URL. The API
needs no publishable key, management token, signing secret or service-role credential. Local and
Lambda composition use the same verifier; [serverless.yml](../server/serverless.yml) supplies the
runtime URL from deployment configuration. The [server README](../server/README.md) describes
local startup and bearer-token smoke testing. There is no browser API integration yet; web session
credentials remain in HTTP-only cookies, and future calls should preserve that boundary.

The API verifies each request locally with discovered public keys. It does not query current user
or session state, so logout and account deletion do not promise immediate access-token revocation.
Signing-key discovery is cached; rotation/revocation visibility is delayed. The auth implementation
owns exact cache and timeout settings. Unsupported legacy tokens fail authentication; this feature
does not migrate or rotate shared keys. Provider failures deny access when usable keys are absent.

The API receives user access tokens and retrieves public keys from Supabase; discovery does not
send those tokens to Supabase. Only verified user IDs enter downstream request context. Request
and error logs omit paths, credentials, payloads and raw provider causes. Hosted infrastructure
logging still needs separate verification. Authentication adds no application-data storage; the separate
[saved-data boundary](job-postings-data-boundary.md) describes DynamoDB processing and retention.

## Web environment and team smoke test

Copy [the web environment example](../web/.env.example) to ignored `web/.env.local`, then fill its
publishable key from this project's API settings. Do not use a management, secret or service-role
key. These values are server-only; the browser uses Next.js Server Actions. APP_ORIGIN defaults to
localhost in the example and must match the origin where the app is opened. Use the same shared
Supabase URL/key in hosted dev and production, with different APP_ORIGIN values.

The checked-in confirmation and recovery templates are applied by `mise run auth:push`. Review the
complete diff and require an up-to-date second run. They use the per-request `/auth/confirm`
destination and a token hash; a confirmation page button consumes the token. Opening the link in
another browser works without copying the original browser’s session. Localhost links still require
the app to be reachable on that device; they do not make a local server remotely accessible.

For a deliberate live check with an eligible team address:

1. Start the web app on the configured origin; create a dedicated development account at `/signup`.
2. Confirm the delivered email in another browser on the same machine. Verify that `/app` opens and
   the URL no longer contains the token. Sign out and verify protected role links return to login.
3. Request recovery at `/forgot-password`, open the email, continue and set a new password.
4. Verify the new password logs in and the old password fails. Avoid repeated attempts that consume
   the shared sender quota. Never reset or delete unrelated shared-project accounts.

`npm run test:auth` checks components and every auth-code branch. `npm run test:e2e` uses local fake
provider credentials, sends no remote email, and needs neither the shared project nor the Express
backend. These checks do not validate actual SMTP delivery. The automated fixture is not a full
Supabase emulator; secure password-change enforcement, shared quotas and sender eligibility require
provider verification.

## Data and email boundary

The Next.js server processes submitted email/password forms and forwards authentication requests
to Supabase. Session credentials are stored in HTTP-only browser cookies. Do not enable request-body
logging or token-bearing confirmation-URL logging in hosting infrastructure.

Supabase processes account identifiers, password-derived authentication data, sessions, tokens and
authentication request metadata. Application notes, resumes, company research and contacts must
not be placed in Supabase user metadata or logs. DynamoDB stores saved postings through the backend. Account deletion across Supabase and application
data is not implemented; the [saved-data boundary](job-postings-data-boundary.md) records retention
and recovery limitations.

Email confirmation is enabled even for local development against this shared project. Custom SMTP
is not configured. Supabase's default sender is restricted and is not a production delivery setup;
use eligible team addresses while testing. Before public signup, add a chosen SMTP provider's
configuration and secret references to the owning config, document its processor boundary here,
and verify confirmation, recovery and email-change delivery. Do not disable confirmation merely to
bypass delivery configuration.

## Provider references

Checked 2026-09-18 against official documentation and CLI v2.111.0 source:

- [CLI config push and authentication](https://supabase.com/docs/reference/cli/supabase-config-push)
  describes hosted configuration updates and CLI login.
- [Pinned push implementation](https://github.com/supabase/cli/blob/v2.111.0/apps/cli/src/legacy/commands/config/push/push.handler.ts)
  establishes service ordering, prompts and comparison behavior.
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) explains the Site URL fallback
  and exact production destinations.
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) describes default-sender restrictions.
- [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys) describes hosted key discovery.

- [Server-side sessions](https://supabase.com/docs/guides/auth/server-side/creating-a-client) describes
  cookie refresh, verified identity and response-cache requirements.
- [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates) documents RedirectTo
  and token-hash verification.
