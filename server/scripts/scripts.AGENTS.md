# Server package verification

This directory owns local checks of deployable artifacts. Follow the [server guide](../AGENTS.md)
and [packaging guide](../docs/SERVERLESS-V4.AGENTS.md).

[check-package.mjs](check-package.mjs), exposed as `npm run check:package`, unpacks the existing
Serverless archive into a temporary directory, checks for the Linux native fetch dependency and
accidentally packaged dotenv files, then exercises the packaged Lambda handler in the AWS Node 24
Linux image. It requires `unzip` and a running Docker engine; the first use can pull the public image.

The container has networking disabled. It constructs and closes a native HTTP session, generates an ephemeral signing key, injects only public
JWKS discovery, sends a signed synthetic request through the real auth middleware and parsing
route, and verifies that agent-fetch rejects a loopback URL. This establishes native loading and
worker IPC without contacting a posting site, Supabase, AWS, or Redpill. It also checks the unsigned
request rejection. The image tag follows the AWS Node 24 runtime; record actual test results rather
than claiming they establish a deployed runtime. Temporary files and the container are removed on
ordinary success or failure; interrupted processes may require manual removal of their temporary
`huntinwabbit-package-` directory.

Build a local package first using the packaging guide. Never change required runtime dependencies
or skip assertions to make this check pass. This check does not deploy, test IAM, exercise real
provider inference, or prove safe fetching for arbitrary Internet destinations.

[check-storage-package.mjs](check-storage-package.mjs), exposed as `npm run check:storage-package`,
reads the generated CloudFormation template and archive source map to verify the saved-posting
table, retention/recovery configuration, table reference, scoped IAM (including transactional deletes for API/recovery and source-link updates in the worker) and bundled DynamoDB SDK.
It does not print rendered secrets, run Docker, contact AWS or exercise a real database. It requires
the ordinary Serverless package artifacts and `unzip`; no temporary files are created.

[migrate-posting-ids.ts](migrate-posting-ids.ts) is an explicit operator migration for the dev table.
It scans legacy posting rows and conditionally backfills ID pointers without modifying posting data.
Run with operator credentials and `JOB_POSTINGS_TABLE` set to the explicit dev table only. It reports
only a count. Runtime roles have no Scan permission. Repeating the migration is safe; conflicting
pointers fail rather than overwrite another target.

[migrate-companies.ts](migrate-companies.ts) performs explicit, account/region/table/user-scoped
company backfill. It defaults to dry-run, checks AWS account identity, checkpoints completed pages,
and uses conditional association writes. It never calls inference or fetches postings. The
[runbook](../../docs/runbooks/company-backfill.md) owns target selection, replay and rollout order.

Storage package checks also verify company-analysis handler/stream configuration and transactional
update/condition permissions. Company backfill invalidates analysis revisions transactionally; if
analysis workers are enabled, applied membership changes can schedule paid analysis. Keep analysis
disabled during an association-only migration. Dry-run remains read-only.

[reassign-company.ts](reassign-company.ts) corrects one explicitly reviewed role association. It
requires account, region, table, role, source company, target company and expected record version,
with the owner supplied through the operator environment. The default is read-only dry-run. Applied
corrections use the picker coordinator and analysis-invalidation adapter, preserving company records
and role content. Repeating an already-applied correction does not write again. It does not merge
company notes or retry extraction; configured background company analysis can run after reassignment.
[Tests](reassign-company.test.ts) cover dry-run, target/owner/version guards, concurrent changes and
replay. Follow the [targeted correction procedure](../../docs/runbooks/company-backfill.md).
