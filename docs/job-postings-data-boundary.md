# Saved job posting data boundary

The backend can store and list user-owned job postings in DynamoDB. The frontend still uses
in-memory fixtures. The [feature barrel](../server/src/features/job-postings/job-postings.AGENTS.md)
explains behavior and links the executable contracts; [Serverless](../server/serverless.yml) owns
resources and access configuration. Checked-in resources are not evidence of a deployed table.

## Data flow and ownership

Authenticated callers supply a posting URL, optional parsed facts and application choices. The
backend validates the data and binds ownership to the verified Supabase subject. AWS DynamoDB stores
that identity in the partition key, the normalized URL, supplied facts, tracking data, generated IDs
and timestamps. Supabase remains the identity provider; application data is not sent to its user
metadata. AWS runtime credentials remain server-side and are never accepted from a request.

The save endpoint does not fetch the URL or call Redpill. Supplying a previous parse response is a
separate explicit save; parsing itself remains stateless. Parsed facts arriving from a client are
untrusted supplied data, even when they have the parser's schema. No authenticity or factual accuracy
claim follows from schema validation. Raw fetched pages and provider responses are not stored by
this feature. See the [parsing processor boundary](job-parsing-data-boundary.md) for extraction.

The Lambda role can access its stage's table; application ownership enforcement is the API adapter's
responsibility, not per-user AWS credentials. Dev and prod tables are distinct even though the
Supabase identities are shared. Request logs omit identities, URLs, notes, bodies, cursors and raw
provider errors. AWS hosting and administrator access require their own operational controls.

## Retention and recovery

There is no automatic expiry, API deletion or synchronized Supabase account deletion. Records remain
until explicitly removed through separately authorized operational work. Deleting or signing out a
Supabase account does not delete DynamoDB data. Outstanding valid access tokens retain the existing
[authentication limitations](auth-infrastructure.md). Do not advertise complete account erasure.

The table configuration enables point-in-time recovery and retains resources on stack deletion or
replacement. These settings are recovery aids, not an implemented restoration workflow or evidence
of a tested backup. Any future record/account deletion must remove both chronological records and
URL-uniqueness pointers, and explicitly address backup retention. Table migrations and restores need
an authorized target, ownership validation and a deliberate cutover; no migration runs at startup.

Verified against AWS documentation on 2026-09-21: [transactional writes](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html)
are atomic, [queries](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html)
use continuation keys, and [transaction IAM](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html)
uses permissions for the underlying operations. Offline fake-adapter tests cannot establish live
permissions, transaction contention behavior, deployment configuration or a successful restore.
