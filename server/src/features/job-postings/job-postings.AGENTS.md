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
Refresh retains previous generated facts until a successful replacement; failure keeps the last good
result and tracking fields. Active requests return the pending generation; stale terminal requests
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
queries one bounded page of the owner's job keys per marker per pass, deleting only rows with the
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
