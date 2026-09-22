# Company rollout and existing-role backfill

The [company barrel](../../server/src/features/companies/companies.AGENTS.md) owns identity and
membership semantics. [The operator script](../../server/scripts/migrate-companies.ts) assigns
existing roles without fetching postings or calling a model. It preserves IDs, application fields,
source facts, overrides and extraction state. Existing assignments are never replaced.

## Release order

1. Prepare a compatibility-only web release with the updated saved-posting and update-history schemas,
   retaining the currently deployed UI. Its readers must tolerate absent and present associations
   before the backend writes them. This is a separate release artifact, not a runtime feature flag.
2. Release API and extraction/recovery workers with the same updated stored schemas. Stop old worker
   versions from processing jobs before writing associations; old strict readers reject new fields.
   Include the role-comment handlers and AI note-exclusion changes from the same revision.
3. Release the complete frontend, including company pages and the role-comment timeline. Both APIs
   are now available; enabling comments follows the notes feature's backend-first requirement.
4. Review and run the targeted migration for each account that needs its existing roles linked.
   New extractions and explicit selection already establish associations through runtime code.

Rollbacks must retain readers supporting company associations and chat snapshots. Do not delete saved
associations or company records to force an older artifact to accept them. This runbook is not evidence
that any deployment or migration has run.

## Operator procedure

Use operator credentials for the intended AWS account and region, the AWS CLI, and the server's mise
runtime. The script checks STS account identity before accessing the configured table. Set
`COMPANY_MIGRATION_USER_ID` in the operator environment to the verified user's subject; never commit
it. Existing legacy records need the ID-pointer prerequisite described in the posting barrel.

From `server/`, review the dry-run count first:

```sh
mise exec -- node scripts/migrate-companies.ts \
  --table YOUR_TABLE --region YOUR_REGION --account YOUR_ACCOUNT_ID \
  --checkpoint /private/tmp/company-preview.json
```

Apply only to the reviewed target, using a separate checkpoint:

```sh
mise exec -- node scripts/migrate-companies.ts \
  --table YOUR_TABLE --region YOUR_REGION --account YOUR_ACCOUNT_ID \
  --checkpoint /private/tmp/company-apply.json --apply
```

The default is dry-run; it counts eligible roles without writing companies or memberships. Checkpoints
bind account, region, table, user and mode using a digest. They contain counts and opaque cursors,
not company facts. Keep them outside the repository, with owner-only access; remove them when no
longer needed. A dry-run checkpoint cannot authorize an apply run.

Progress checkpoints after complete pages. An interrupted page can be replayed safely; concurrent
posting edits cause a conflict instead of being overwritten. Rerun with the same checkpoint after
resolving the failure. Counts describe that run's writes, not an inventory or guaranteed count across
an interruption between database commit and checkpoint write. To inspect newly added earlier pages,
start another run with a new checkpoint.

Matching uses effective names and employer website domains conservatively. Ambiguous names remain
separate; manually correct associations from role pages. No inference or remote migration executes
as part of ordinary tests, builds, packaging or PR creation. Verify the deployed company page and
multiple-role membership with a dedicated test account only when that target is authorized.
