# Repository documentation

The [product README](../README.md) owns huntinwabbit's intended experience. Executable code,
configuration and tests establish implemented behavior. The [root guide](../AGENTS.md) owns
repository workflow; [web](../web/AGENTS.md) and [server](../server/AGENTS.md) guides index feature
barrels and platform conventions.

## Where a document belongs

| Job | Owner |
|---|---|
| Current cross-stack explanation, adopted decision, external-fact inventory or reusable runbook | `docs/` |
| Research, alternatives, plans and decisions in formation | [product-workspace](../product-workspace/product-workspace.AGENTS.md) |
| Implemented feature intent, architecture, failure semantics and verification | Barrel beside the feature |
| Silent, non-obvious trap learned from an actual incident | Root `.agents/` with an index when introduced |

Begin uncertain work in the workspace. Once adopted, distill the smallest lasting explanation here
or into the feature barrel, link executable owners, replace duplicate deliverables with links, and
update inbound indexes. Keep evidence and rejected alternatives only where they explain provenance.
Do not maintain a second implementation in prose.

## Current explanations

- [Development practices and parity](development-process.md) — the adopted process, its local owners,
  deliberate differences from the reference app, and current implementation gaps.
- [Authentication infrastructure](auth-infrastructure.md) — shared Supabase configuration, localhost
  setup, web account flows, deployment preparation and the Supabase/DynamoDB data boundary.

- [Job parsing processor boundary](job-parsing-data-boundary.md) — public posting retrieval, Redpill
  inference, observed JSON support, credentials and stateless extraction.
- [Saved job posting data boundary](job-postings-data-boundary.md) — user-owned DynamoDB records,
  retained data, deployment separation and account-deletion limitations.

The [API auth barrel](../server/src/features/auth/auth.AGENTS.md) owns the initial protected hello
contract. The [saved-postings barrel](../server/src/features/job-postings/job-postings.AGENTS.md) owns
implemented storage behavior and links its schemas/configuration.

## Product evidence and prototypes

- [Search-board prototype](prototype/search-board.html) — sample-data design exploration; no live
  parsing or persistence. This is not the implemented web application.
- [Initial product notes](<oneOff/Sanctum 2026-09-17 11.27.44 Job application tracking tool.combined.md>)
  — original source notes retained under their existing filename. Their title does not define this
  product's identity; use the root README for current intent.

Source notes under `oneOff/` are historical evidence, not current specifications. Keep their original
body; distill adopted decisions into the current owners. The
[documentation gate](../scripts/scripts.AGENTS.md) checks current Markdown structure and ownership,
not product truth or the behavior of prototypes.
