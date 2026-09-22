# Saved companies

Companies give one user's saved roles a shared identity and a stable page. Company requirements/technology analysis belongs to [company analysis](../company-analysis/company-analysis.AGENTS.md). Notes, other research, contacts,
interview processes, company renaming, merging and deletion are not implemented. Records are private
to the authenticated account; matching never considers another user's companies.

## Owners and boundaries

[Contracts](companies.schemas.ts) define profiles, role associations, selection and paging input.
[Router](companies.router.ts) exposes authenticated reads and delegates role mutations to the
[posting coordinator](../job-postings/job-postings.companies.ts). The coordinator owns posting versions,
membership transactions and backfill. Source-derived employer facts remain separate from membership.
[Runtime](../../runtime.ts) injects the company adapter into API and posting composition; the
[worker](../job-postings/job-postings.worker.ts) injects it into extraction and chat completion.

[Storage](companies.store.ts) uses owner-partitioned company records and chronological role-membership
rows in the existing posting table. Strong reads validate profiles and owner boundaries. Cursors bind
the owner, query and company/prefix. Missing/foreign companies receive indistinguishable not-found
responses. Company creation serializes through a conditional registry revision, rereads contention,
and recovers a committed creation after a lost acknowledgement. No Scan or new runtime permissions
are needed. Runtime matching reads company pages within the caller's deadline; very large libraries
can exhaust that deadline rather than silently match a truncated library.

Company creation precedes the association transaction. If the role changes or disappears meanwhile,
the company can remain empty. Moving/deleting a role changes its membership in the same transaction
as the posting. Empty company records are intentionally retained without TTL; posting deletion does
not erase them. There is no company-erasure UI or account-wide deletion guarantee.

## Matching and corrections

[Pure matching](companies.matching.ts) normalizes names and employer website hostnames. Exact names
match only without conflicting domain evidence; compatible name variants can match the same domain.
Ambiguous matches create a separate company. Missing names remain unassigned. Source/ATS hosts are
never used as employer domains. Corporate suffix removal only broadens compatible names/candidates.

Durable extraction ranks a bounded shortlist from page text before the existing model call. Temporary
references, bounded names and website hostnames reach Redpill; internal IDs and application data do
not. The extractor accepts only supplied references; invalid matching metadata does not invalidate
otherwise valid job facts. The manual picker and backfill do not call the model directly; their membership writes can schedule separately enabled company analysis.

An explicit selection, creation or clear is manual and survives refreshes. Company-name chat edits
can replace it; website-only edits cannot move a manual association. Association revisions fence
chat accepted before a manual correction. Undo restores the saved association only if it has not
changed since that operation. Another role at the company is never rewritten implicitly.

## Verification and operations

[Tests](companies.test.ts) exercise identity, contention, ownership, pagination, HTTP validation,
selection, extraction, chat/Undo and migration replay using injected storage and model boundaries.
Run server gates/build, web/browser integration and documentation checks. Package checks establish
bundling/configuration only; no offline test proves deployed IAM or model accuracy.
The [rollout runbook](../../../../docs/runbooks/company-backfill.md) owns compatibility and explicit
operator migration. The [processor boundary](../../../../docs/job-parsing-data-boundary.md) explains
which matching inputs leave the server. Never log company names, domains, owner IDs or membership.
