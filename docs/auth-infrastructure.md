# Authentication infrastructure

The adopted split is Supabase Auth for identities and sessions, and DynamoDB for application data
behind the Express/Lambda backend. The [Supabase barrel](../supabase/supabase.AGENTS.md) describes
the configuration boundary. Login UI, session handling, API JWT verification, ownership checks and
DynamoDB tables are separate implementation work; current app data remains mock data.

## One shared project

The remote target is pinned in [mise.toml](../mise.toml). Dev and prod share users, auth policies,
email quotas and signing authority. A dev token cannot be distinguished from a production token by
project issuer alone. Future backend authorization must verify signature, issuer, audience and
expiry, derive ownership from the verified user ID, and select DynamoDB resources from trusted
deployment configuration. Do not accept a client-selected table or environment.

Use dedicated development accounts. A password reset, user deletion, provider change or signing-key
rotation affects the shared project. Keep dev/prod application data separate when adding DynamoDB
resources to [serverless.yml](../server/serverless.yml); its current skeleton has no tables.

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
Allowed URLs do not implement callback routes. When deploying the app:

1. Set `auth.site_url` to the canonical HTTPS production origin.
2. Add the exact dev/prod callback and recovery destinations implemented by the app to
   `auth.additional_redirect_urls`, retaining localhost entries. Avoid broad hosted-domain wildcards.
3. Push once to the shared project, then verify readback. There are no separate dev/prod pushes.
4. Have each app deployment explicitly request its own allowlisted redirect destination; the shared
   Site URL is the fallback and cannot vary by caller.

The app integration will use `https://zjwbikkvzexdplwudzqy.supabase.co` and a publishable API key.
The hosted issuer is that URL plus `/auth/v1`, and its public JWKS endpoint is the issuer plus
`/.well-known/jwks.json`. Check the project's signing-key configuration when implementing JWT
verification; this setup does not rotate keys or establish an authentication middleware.
The management token and secret/service-role keys must never enter browser configuration.

## Data and email boundary

Supabase processes account identifiers, password-derived authentication data, sessions, tokens and
authentication request metadata. Application notes, resumes, company research and contacts must
not be placed in Supabase user metadata or logs. DynamoDB is the chosen application database, not a
claim of implemented storage or retention. Account deletion across Supabase and future application
data needs an explicit recovery/retention contract before implementation.

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
