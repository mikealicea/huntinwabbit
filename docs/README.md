# Repository documentation

The [product README](../README.md) owns huntinwabbit-boilerplate's intended experience. Executable code,
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

- [Local socket verification](runbooks/local-socket-verification.md) — running local test/build
  commands under a restricted sandbox and recovering a cached Turbopack permission failure.
- [Development practices and parity](development-process.md) — the adopted process, its local owners,
  deliberate differences from the reference app, and current implementation gaps.
- [Authentication infrastructure](auth-infrastructure.md) — shared Supabase configuration, localhost
  setup, web account flows, deployment preparation and the authentication data boundary.

The [API auth barrel](../server/src/features/auth/auth.AGENTS.md) and
[web hello barrel](../web/src/features/hello/hello.AGENTS.md) own the protected demonstration.
