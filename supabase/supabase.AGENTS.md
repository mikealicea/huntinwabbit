# Shared Supabase authentication

Read the [root guide](../AGENTS.md) for branch workflow. This folder owns hosted auth configuration;
the [cross-stack runbook](../docs/auth-infrastructure.md) owns setup and the processor boundary.

## Purpose and boundaries

Use the user's existing hosted project for email/password authentication in local development,
deployed dev and production. There is one shared user directory, session authority and auth policy.
Never create a second project or a Supabase preview branch as part of routine development.
Auth changes and account deletion affect both environments. Use dedicated development accounts;
do not bulk-reset users or weaken production auth settings for tests.

Supabase's internal Postgres supports Auth. Application records belong in DynamoDB behind the
backend, with separate dev/prod resources when persistence is implemented. This setup provisions
no DynamoDB tables or resource-ownership policies. The [web auth feature](../web/src/features/auth/auth.AGENTS.md)
implements account flows and protects the live workspace. The [API auth feature](../server/src/features/auth/auth.AGENTS.md)
protects the hello endpoint using public-key JWT verification; it does not mutate this configuration.

## Owners and operation

- [config.toml](config.toml) owns the shared auth settings and redirect allowlist. It enables email
  confirmation, secure password changes and refresh-token rotation. Existing TOTP capability is
  retained; this does not implement an MFA flow in the app.
  The production origin and exact confirmation callback use `env(...)` references alongside localhost.
  Copy [.env.example](.env.example) to ignored `supabase/.env` and supply your own production URLs
  before pushing. Shell variables override this file. These are CLI inputs, separate from Vercel's
  environment and the web app's local environment; keep them aligned with production APP_ORIGIN.
  Checked-in settings describe the intended configuration, not proof of remote convergence.
- [Root mise.toml](../mise.toml) pins the CLI and owns the push command. The task reads
  SUPABASE_PROJECT_REF from `supabase/.env`, with an exported shell value taking precedence.
  Node's dotenv loader supplies the value before the shell builds the CLI arguments; the task does
  not look for a `.env.local` override for the project reference.
  Missing or empty references stop before calling Supabase; no linked or maintainer project is a fallback.
  Run its task from the repository root. Do not substitute a linked project or a stage-based target.
- The confirmation and recovery templates referenced by config send users to the caller’s allowlisted
  `/auth/confirm` endpoint. Token hashes are opaque provider values, including PKCE-prefixed hashes;
  server verification exchanges them for sessions without the original browser’s verifier cookie.
- No migrations, seed users, Storage buckets, Edge Functions or app credentials are managed here.

The pinned CLI reviews multiple service categories, not only auth. Inspect all proposed changes
before accepting prompts. Omitting a setting can select a CLI default; omission does not always
preserve dashboard state. The CLI's displayed local issuer/external URL is not the hosted JWT issuer.
Do not use it as backend runtime configuration. Use the hosted project URL described in the runbook.

Pushes compare local and remote settings. A repeated push should report auth up to date. A declined
prompt can still exit successfully, so exit zero alone is not proof of convergence. On API failures,
inspect readback before retrying; there is no cross-service transaction or automatic rollback.
Recover a mistaken setting by restoring the intended configuration and pushing it again. Never use
a database reset or project deletion as configuration recovery.

## Verification and limitations

Run the [documentation gates](../scripts/scripts.AGENTS.md) for config/runbook changes, then review
the live CLI diff when project access is available. After an authorized push, rerun the same command
and require `Remote Auth config is up to date.` Report remote checks separately from local gates.
These checks do not create accounts, send emails, validate app login, prove email delivery, or test
future DynamoDB IAM. No browser UI changes belong to this setup.

CLI authentication stays in its local credential store or `SUPABASE_ACCESS_TOKEN`; never commit
tokens, user payloads, resolved secret configuration or CLI debug logs. Generated linkage is ignored.
The production email-delivery limitation and the future domain steps belong to the runbook.
