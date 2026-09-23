# Saved job postings and extraction jobs

## Purpose and contracts

Persist a user's saved roles, tracking choices and generated posting facts. [Schemas](job-postings.schemas.ts)
own save/list/detail/update/delete/extraction contracts; [router](job-postings.router.ts) validates HTTP input
after authentication. Every record key is scoped to the verified subject. Missing and other-owner IDs
return the same 404. Lists paginate newest first using owner-bound opaque cursors; failures never
return a successful empty collection. Cursors are encoded, not signed or encrypted.

[Service](job-postings.service.ts) normalizes URLs using the parser's public normalizer and bounds
serialized records. Exact normalized URLs determine duplicate identity; queries are preserved and
HTTP/HTTPS remain distinct. A duplicate returns existing choices/facts without restarting extraction.
A disabled parser does not prevent link capture. Supplied parsed facts remain accepted for compatibility
and are schema-validated, not independently verified.

## Storage and concurrency

[DynamoDB adapter](job-postings.dynamodb.ts) creates a chronological record, URL pointer, ID pointer
and optional extraction job in one conditional transaction. [Operations](job-postings.operations.ts)
resolve IDs with strong reads and perform bounded compare-and-swap transactions. JSON payloads stay
below the record byte limit. Every read validates the envelope, owner, source URL and stored contract.

Application versions protect tracking updates; record versions include extraction changes. Concurrent
fact changes can be reread/rebased without replacing tracking. Stale application edits return conflict.
A lost update acknowledgement can be recovered by a strong read of the exact resulting version and
values. Otherwise the caller refreshes and deliberately retries. API storage operations have a bounded
deadline; SDK commands make at most three attempts. Disconnect does not revoke an accepted write.

Legacy records are explicitly decoded as version zero without extraction jobs. The operator-only
[migration](../../../scripts/migrate-posting-ids.ts) backfills ID pointers idempotently for the explicit
dev table. Runtime roles have no Scan permission. Existing posting data and IDs are preserved; legacy
links do not silently trigger paid extraction.

## Durable extraction

[Dot-free Lambda entry](../../extraction.ts) exports the [worker](job-postings.worker.ts), which consumes INSERT events for job keys from a KEYS_ONLY DynamoDB stream.
The job and posting already exist atomically before any provider request. A conditional transition
claims each generation, preventing duplicate stream events from repeating inference. An uncertain
claim is never treated as permission to spend again. Results and terminal job state commit together,
with conditional rereads preserving concurrent tracking changes. A newer generation fences old workers.

The native Node worker reuses the existing agent-fetch/Redpill adapters. Parsing has a 60-second budget
inside a 90-second Lambda. Provider failures become safe saved failure codes; no automatic paid retry
or model repair occurs. Explicit user retry or refresh of completed details creates a new generation.
Refresh retains previous generated facts until a successful replacement; user overrides are applied
separately and survive replacement. This includes technology lists and formatted description corrections.
Older records and pending update baselines can omit technologies; no default list is injected into
saved overrides. Refresh is explicit, with no bulk backfill. Failure keeps the last good result and tracking fields. Active requests return the pending generation; stale terminal requests
conflict. Completing inference without
persisting its result is an uncertain outcome, not permission to repeat the model request.

The sparse pending-job index supports a minute-based recovery task: unclaimed jobs older than fifteen
minutes and claimed jobs older than three minutes become failed/retryable. Terminal jobs lose their
index attributes and receive seven-day TTL; DynamoDB expiry is asynchronous. Posting records do not
expire. Stream delivery retries twice with a one-hour maximum age; the encrypted failure queue retains
invocation metadata for fourteen days. Alarms expose stream lag, discarded invocations and recovery
errors; no notification recipients are configured. See [AWS stream delivery](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html)
and [failure destinations](https://docs.aws.amazon.com/lambda/latest/dg/services-dynamodb-errors.html),
reviewed 2026-09-21. At-least-once delivery is why conditional claims are required.

## Permanent deletion

The versioned DELETE route removes only the authenticated owner's posting. Missing IDs are idempotent
success, including another owner's IDs. Tracking-version conflicts require review; background fact
changes can be rebased within the bounded transaction retry. There is no trash or undo.

Operations atomically remove the chronological record, both lookup pointers and current job while
creating a content-free deletion cleanup marker. Pointer conditions prevent deleting a replacement
record. A lost acknowledgement is recovered through a strong ID-pointer read. The URL can immediately
be saved again with a new ID. Existing legacy records still require the documented ID-pointer backfill.

[Cleanup](job-postings.cleanup.ts) runs through scheduled recovery and the existing pending index. It
queries bounded job and role-note pages per marker per pass, deleting only rows with the
original record key. Deletions and cursor progress commit atomically; concurrent/replayed cleanup
checks the marker revision. Interrupted cleanup remains durable without a TTL and is exposed by the
recovery error alarm. Older job metadata persists until cleanup succeeds; no source URL or notes enter
the marker. API and recovery roles have transaction-only DeleteItem permission; no Scan is needed.

Worker claims, results and recovery tolerate already-deleted jobs/postings. A provider request already
in flight may finish, but a missing record or generation mismatch prevents resurrection. Cleanup of an
old ID never touches a newly saved posting for the same URL. Existing backups and operational metadata
retain their configured lifecycle; deletion is not an account-erasure or backup-purge guarantee.

## Privacy, operations and verification

Never log owners, URLs, notes, cursors, stored records, stream payloads or raw SDK/provider errors.
Worker logs contain only outcome categories; uncaught boundary errors are replaced with safe messages.
[Infrastructure](../../../serverless.yml) owns separate API/worker/recovery roles, retained encrypted
storage, PITR, stream/index configuration, schedules and alarms. [Shared data boundary](../../../../docs/job-postings-data-boundary.md)
owns retention and deletion limitations. The parser's external data boundary remains separate.

[Existing tests](job-postings.test.ts) cover save/list, normalization, corruption and uncertain writes;
[lifecycle tests](job-postings.lifecycle.test.ts) cover ownership, version conflicts, duplicate delivery,
concurrent edits, refresh/failure/retry, uncertain claims, stale workers, deletion races, replay,
URL reuse and paginated cleanup. In-memory command adapters do not
prove AWS transaction scheduling, IAM or native runtime compatibility. Run server gates/build,
documentation gates and package inspection. Deployment/live checks require an authorized target;
ordinary tests never write hosted records or call paid providers.

## Natural-language role updates

The [update router](job-postings.updates.router.ts) accepts text and returns a durable operation,
with owner-scoped paginated history and explicit Undo. [Update schemas](job-postings.updates.schemas.ts)
own request, history, model and stored-job contracts; [posting schemas](job-postings.schemas.ts)
own editable fields, overrides and revision stamps. Internal metadata, notes/comments and unimplemented materials,
tasks and shared company research are not editable. Company changes affect only this saved role.

[Update operations](job-postings.updates.ts) atomically persist a message, idempotency pointer and
posting pending marker before inference. History and pointers use distinct JOB prefixes so the
existing deletion cleanup removes them. History has no TTL and survives reloads; extraction-job TTL
is unchanged. Only one update is pending per role. Reusing an operation ID with different content
conflicts. Accepted work survives navigation, and no client cancellation is a rollback guarantee.

The extraction worker dispatches update jobs to a conditional claim, then one bounded
[Redpill update parser](job-postings.updates.redpill.ts) call. Idempotency-pointer inserts never
invoke a provider. Uncertain claims do not authorize inference; scheduled recovery marks overdue
jobs failed. Explicit retries create a linked new operation; stream retries never repeat a claimed
paid call. Completion, field edits and the change receipt commit together. Failure exposes safe
copy, clears pending state and leaves role data unchanged. Provider billing cannot be reversed.

[Pure field logic](job-postings.updates.logic.ts) resolves extracted facts with user overrides,
including explicit clears. Missing values stay missing. Tracking remains independent; existing
tracking writes also stamp fields to detect changes away and back. Clear changes are applied while
invalid, ambiguous or concurrently changed fields are reported as skipped. No follow-up questions
or external actions are performed. Model validation bounds values but does not prove interpretation
accuracy. Input and recent history are bounded; the entire conversation is not sent on each turn.

Undo needs no inference and restores the previous override presence as well as tracking values.
It checks every changed field and refuses the whole Undo if a later edit touched any of them.
Removing an override exposes the latest extracted fact. Other fields remain unchanged. Duplicate
Undo requests return the existing receipt. Unsaved browser note drafts are not server data.

Source URL changes atomically move URL uniqueness pointers and remove/fence the prior extraction
job. They do not fetch automatically. The prior extracted snapshot retains its original source
provenance until refreshed; a saved record's current URL may therefore differ from its extraction
source. Undo cannot reclaim a URL subsequently saved as a different role. Deletion prevents late
claims/results from resurrecting the posting; history is inaccessible immediately and removed by
existing durable cleanup. [Processor boundary](../../../../docs/role-updates-data-boundary.md)
describes the newly included personal text and notes.

[Update tests](job-postings.updates.test.ts) cover edits, overrides, partial results, undo, conflicts,
replay, uncertain claims, recovery, history, source identity, deletion and authenticated routes.
Run server/build, documentation and package gates; fake storage does not prove AWS IAM or scheduling.

## Company associations

[Posting-company coordination](job-postings.companies.ts) owns versioned selection, membership reads
and association backfill. Backfill invalidation can schedule paid company analysis when enabled. [Companies](../companies/companies.AGENTS.md) own identity and matching.
Save/extraction/chat commits maintain membership transactionally with posting data; deletion removes
membership but retains the company. Manual assignment/clear survives extraction. Chat company-name
edits can reassign only this role, with association snapshots/revisions protecting Undo and newer
manual selections. Generated employer facts are never rewritten merely to change membership.
Chat supplies owner-scoped company candidates to its existing completion, recognizing employer-name
variants from posting context without another paid call. Invalid matching metadata falls back to
ordinary resolution without discarding valid edits. Unrelated edits never apply a suggestion, and
skipped identity edits or conflicting employer domains prevent using it. Undo checks the applied
source name separately from the selected company's display name. Candidate lookup shares the
completion deadline; a lookup failure fails the operation without submitting inference.
See [matching tests](../companies/companies.chat-matching.test.ts) and the
[role-update data boundary](../../../../docs/role-updates-data-boundary.md).
## Role comments

[Note schemas](job-postings.notes.schemas.ts) and [router](job-postings.notes.router.ts) own direct
create/list/edit/delete contracts; [operations](job-postings.notes.ts) enforce ownership and parent-version updates while the
[shared comment store](../../shared/shared.notes.ts) owns paging, mutations and replay recovery in the existing table. Notes are not posting extraction jobs. When company analysis is enabled, comment changes invalidate and schedule that company’s analysis.
The timeline is independently paginated, newest first, with owner/role-bound cursors. Stored entries
and lookup pointers are validated. Missing and other-owner roles share the same unavailable response.

Separate chronological rows hold Markdown bodies, timestamps and per-note revisions. ID pointers
hold the original submission hash for replay checks. Deleted entries leave pointers without body
content, preventing delayed create retries from resurrecting them. There is no comment trash or Undo.
Edits and deletes compare note revisions. A repeated edit can recover only the exact next revision
and body; other conflicts require review. Body whitespace is preserved, but blank entries are rejected.

Each mutation conditionally updates the parent posting and advances its application/record versions.
Unrelated role changes can be rebased; role deletion fences late writes. A deletion confirmation
reviewed before a comment mutation therefore conflicts. Cleanup markers advance from historical jobs
to role-specific note rows and pointers, with paginated progress committed atomically. Old markers
without a phase start with jobs; the existing recovery error alarm covers failed cleanup.

The legacy application notes field remains decodable and compatible with the old tracking API but
is not displayed by the timeline. No migration is required. Role-update AI input excludes this field and historical
receipts that changed it; new model output cannot change it. Legacy receipts remain readable, but
Undo containing a notes change is refused as a whole. Comments remain excluded from role-update AI input. The separately enabled [company analysis](../company-analysis/company-analysis.AGENTS.md) includes comments and history.
[Notes tests](job-postings.notes.test.ts) cover ownership, replay, conflicts, pagination and cleanup.
Ship the API and extraction/recovery workers together before enabling the notes frontend. Follow the
[company rollout](../../../../docs/runbooks/company-backfill.md) when also introducing associations. No new infrastructure
or processor is introduced; packaging and deployed IAM verification remain separate from local tests.

## Retained posting source

[Source operations](job-postings.source.ts) retain the latest optional pasted page text in a separate
owner-scoped table row, avoiding competition with generated facts for the posting record byte budget.
The source is bound to the posting ID, record key, normalized URL and a revision. The authenticated
source read returns text on demand; ordinary posting list/detail responses exclude it. Existing
records have no source row and need no migration.

Save persists text with the posting transaction. Explicit source replacement/removal and its new
extraction generation also commit together, incrementing the application version so stale source edits
and deletion reviews conflict. Input omission reuses retained text; URL mismatches require replacement
or removal. Parsing-disabled source changes remain durable without publishing inference work.
Pending work cannot accept competing source changes. Generation jobs pin a source revision; workers
validate it before parsing and retain the usual claim and result fencing.

Content-free operation receipts retain input hashes under a distinct JOB prefix, until role deletion.
They recover exact submissions after uncertain acknowledgements, reject changed input under a reused
ID, and never trigger inference. The worker skips receipt inserts; existing durable cleanup removes
receipts. Raw source text is never copied into historical jobs. Removal and role deletion erase the
live source row transactionally; table backups retain their existing lifecycle.

[Source tests](job-postings.source.test.ts) exercise source isolation, duplicate saves, replay, uncertain
writes, replacement/removal, disabled parsing, version and URL conflicts, worker revision fences,
authentication, payload bounds and deletion cleanup. Existing lifecycle tests continue to cover
concurrent tracking updates, uncertain claims and late results.

## Company analysis coordination

[Analysis adapter](job-postings.analysis.ts) decorates posting transactions with atomic company source
revision changes. Runtime and worker composition install it; do not bypass it for new mutation paths.
The same module paginates validated role, comment and update-history inputs through a narrow reader
interface. [Company analysis](../company-analysis/company-analysis.AGENTS.md) owns paid work, stale
results, deletion invalidation and cleanup. Test mutation effects through the decorated transport.
The [storage fake](job-postings.test-support.ts) rejects unaliased `hidden` in update expressions,
matching DynamoDB's reserved-word constraint for analysis invalidation and publication.

## Shared source guidance

Worker runtime composition injects the [shared guidance observer](../source-guidance/source-guidance.AGENTS.md)
into parsing. It retains hostname-only access outcomes outside user partitions; role deletion and
cleanup never target these records. Guidance transactions do not carry JOB prefixes or pending-index
attributes and do not trigger extraction or company analysis. Advisory write failures do not change
a posting's extraction result or authorize a retry. No saved-role schema or migration changes.
