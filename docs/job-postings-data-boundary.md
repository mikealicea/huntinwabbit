# Saved job posting data boundary

The frontend saves, lists and edits user-owned job postings through a server-side authenticated bridge to DynamoDB. The [feature barrel](../server/src/features/job-postings/job-postings.AGENTS.md)
explains behavior and links the executable contracts; [Serverless](../server/serverless.yml) owns
resources and access configuration. Checked-in resources are not evidence of a deployed table.

## Data flow and ownership

Authenticated callers supply a posting URL, optional parsed facts and application choices. The
backend validates the data and binds ownership to the verified Supabase subject. AWS DynamoDB stores
that identity in the partition key, the normalized URL, supplied facts, tracking data, generated IDs
and timestamps. Supabase remains the identity provider; application data is not sent to its user
metadata. AWS runtime credentials remain server-side and are never accepted from a request.

When explicitly requested, saving atomically creates a background extraction job; the save request itself does not fetch the URL or call Redpill. Supplying a previous parse response is a
separate explicit save; parsing itself remains stateless. Parsed facts arriving from a client are
untrusted supplied data, even when they have the parser's schema. No authenticity or factual accuracy
claim follows from schema validation. Raw fetched pages and provider responses are not stored by
this feature. See the [parsing processor boundary](job-parsing-data-boundary.md) for extraction.

The Lambda role can access its stage's table; application ownership enforcement is the API adapter's
responsibility, not per-user AWS credentials. Dev and prod tables are distinct even though the
Supabase identities are shared. Request logs omit identities, URLs, notes, bodies, cursors and raw
provider errors. AWS hosting and administrator access require their own operational controls.

## Retention and recovery

Posting records have no automatic expiry. The authenticated API supports permanent deletion of an
individual posting after a tracking-version check; the frontend requires confirmation. The live record,
URL pointer, ID pointer and current extraction job are removed atomically. A durable content-free
cleanup marker removes historical job metadata through scheduled recovery. There is no trash or undo;
the same URL can be saved again as a new record. Deleting or signing out a Supabase account does not
delete DynamoDB data. Outstanding valid access tokens retain the existing
[authentication limitations](auth-infrastructure.md). Do not advertise complete account erasure.

The table configuration enables point-in-time recovery and retains resources on stack deletion or
replacement. These settings are recovery aids, not an implemented restoration workflow or evidence
of a tested backup. Individual deletion does not purge existing backups, provider-held data or retained
stream/failure metadata; their configured retention still applies. Restoring a backup can restore
previously deleted records and requires an operator to reconcile deletions before use. No account-wide
erasure or deletion-aware restoration workflow is implemented. Table migrations and restores need
an authorized target, ownership validation and a deliberate cutover; no migration runs at startup.

Verified against AWS documentation on 2026-09-21: [transactional writes](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html)
are atomic, [queries](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html)
use continuation keys, and [transaction IAM](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html)
uses permissions for the underlying operations. Offline fake-adapter tests cannot establish live
permissions, transaction contention behavior, deployment configuration or a successful restore.

## Extraction and frontend boundaries

DynamoDB also holds job generation/status records linked to each saved role. KEYS_ONLY streams trigger
native Lambda workers; raw page content and model responses are not written to the job ledger.
Generated facts are retained in the saved posting, separately from tracking choices. Terminal job
records receive seven-day TTL (deletion is asynchronous). The encrypted failure queue retains stream
invocation metadata for fourteen days. Recovery exposes stalled work as failed and permits explicit
retry or refresh of completed postings; it does not automatically repeat an uncertain paid attempt.
Refresh keeps the previous generated facts until successful replacement and never replaces tracking
fields. A request in flight when deletion occurs may finish at the provider, but its result is discarded.
Historical extraction jobs for a deleted posting are cleaned in bounded pages; the marker and cursor
remain until cleanup completes, with recovery errors surfaced through the existing alarm.

The Next.js server verifies Supabase identity before forwarding a session bearer token to the selected
API origin. API responses prohibit caching; the browser retains only an account-isolated memory cache.
Unsaved note drafts and unsubmitted batch rows can be lost on navigation/reload. Stage configuration
selects developer-owned infrastructure, with no maintainer target baked into public defaults.
