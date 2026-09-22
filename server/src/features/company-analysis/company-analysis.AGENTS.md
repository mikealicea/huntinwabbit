# Company analysis

Generate shared requirements and technology findings from one account's company and associated
roles, including Closed roles. Single usable roles produce a labeled preview; zero usable roles
complete without inference. This feature does not fetch websites, edit source roles, or provide
manual finding overrides. Cross-role evidence is observational, not verified employer policy.

## Owners and flow

[Contracts](company-analysis.schemas.ts) own status, findings, evidence, pagination and commands.
[Router](company-analysis.router.ts) enforces authenticated company ownership. Reads have no paid
side effects. The idempotent ensure command initializes existing companies without a bulk backfill;
refresh requests immediate durable work, including bypassing a pending quiet period. Reads expose
the scheduling deadline for an approximate UI countdown; a due deadline does not mean a worker has
started. Non-scheduled or disabled responses have no deadline. Operation receipts expire after seven days, bounding
request replay protection. Concurrent refreshes reuse an active generation for the same revision.

[Posting adapter](../job-postings/job-postings.analysis.ts) adds one source revision per affected
company to the transaction already saving the role, comment or update history. Reassignment marks
both companies. Extraction-only status changes do not invalidate facts. Runtime/API and extraction
composition install this adapter; operator backfill also uses it. No company analysis state or
output is an analysis input. Creation can precede membership, so creation alone may find no roles.

[Store/worker](company-analysis.store.ts) owns generation fencing, claims, paginated snapshots,
binary reduction, result publication and cleanup in the existing table. Each snapshot step reads
one role or one note/history page, retaining a durable cursor. The input adapter validates ownership
and membership. Completion checks the company revision, so intervening source writes invalidate
mixed snapshots. The scheduler coalesces changes after a quiet period; exact deadlines live in code.
[Entry point](../../analysis.ts) isolates this worker from posting extraction. The recovery entry
has no provider key and dispatches due work through new stream-job records.

[Model adapter](company-analysis.model.ts) reuses the Redpill transport, splits complete source text
into bounded batches, validates exact evidence substrings, and requires lossless candidate membership
when merging. Keep singleton candidates until the final distinct-role filter. Personal and historical
sources must remain observed qualifiers. Corrections are current; superseded extraction/history is
labeled historical. Model validation cannot prove semantic accuracy or completeness.

## Failure, privacy and compatibility

Each paid step conditionally claims its job. Duplicate events or uncertain claim acknowledgements
never authorize another call. Recovery marks overdue work failed; users explicitly retry uncertain
paid outcomes. Results publish only after every step succeeds. New revisions fence writes from older
workers and schedule replacement generations. Existing results remain visibly stale during ordinary
refresh/failure; role/comment deletion and role moves hide prior results immediately. No worker can
resurrect deleted source data through publication.

Snapshots/nodes are paginated and bounded. Candidate/evidence and record limits fail explicitly with
no partial publication; batching does not promise unlimited company size. Last successful results
remain until replaced or invalidated. Durable cleanup removes intermediate and obsolete result rows;
intermediate rows also have a seven-day TTL fallback. Terminal task metadata and request receipts
have seven-day TTLs. DynamoDB TTL is asynchronous. Backups retain the table's existing lifecycle.
See the [processor boundary](../../../../docs/company-analysis-data-boundary.md) before changing
inputs, retention or copy. Never log sources, prompts, owner IDs, company IDs or provider responses.

[Configuration](company-analysis.config.ts) is disabled by default and requires a provider key when
enabled. [Infrastructure](../../../serverless.yml) owns isolated stream filtering, scheduled recovery,
transactional update/condition permissions and alarms. Deploy API, posting workers, analysis workers
and IAM together before enabling the capability. The existing company/profile wire schemas remain
compatible. No deployment or inference backfill occurs merely by installing the code.

## Verification

[Tests](company-analysis.test.ts) cover shared/single/empty results, input paging, comments/history,
claims, duplicate delivery, lost acknowledgements, recovery, deletion/reassignment, stale completion,
cleanup, model evidence, malformed merges, ownership, schedule postponement and immediate refresh
without duplicate work. Inject storage and model boundaries;
ordinary tests never call Redpill. Run server gates/build, storage/native packaging checks,
web/browser gates and root documentation checks. Fake storage does not prove deployed IAM, stream
scheduling, or model quality; live evaluations need a separately authorized target.
