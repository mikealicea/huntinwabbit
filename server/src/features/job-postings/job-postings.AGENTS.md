# Saved job postings

## Purpose and boundary

Save a job link independently of extraction and list the authenticated user's saved jobs for a future
board integration. Posting facts remain separate from application choices. This feature persists
URLs, optional supplied parsing results and tracking choices; it does not fetch URLs or call an LLM.
There is no frontend integration, edit/delete endpoint, company research, task or resume storage.
A link-only save is valid. Enriching it later requires future update support: saving the same link
again returns its existing data without replacing facts or choices.

[schemas](job-postings.schemas.ts) owns the public contracts, defaults and bounds;
[router](job-postings.router.ts) owns routes, statuses and HTTP body limits. The feature sits after
authentication and before the smaller parser JSON middleware in [app composition](../../app.ts).
All protected responses prohibit caching. Missing storage is an explicit unavailable capability,
never a fictional or empty collection. [Errors](job-postings.errors.ts) owns safe error mappings.

## Owners and data flow

- [index](job-postings.index.ts) exposes the feature boundary; [runtime](../../runtime.ts) selects the
  real adapter using [configuration](job-postings.config.ts). No network requests run at construction.
  The optional table name is trusted configuration; malformed values fail startup.
- [service](job-postings.service.ts) reuses the parser's public URL normalizer, requires supplied
  extraction source to match, allocates IDs/timestamps and bounds serialized record bytes. Schemas
  validate supplied facts, not their truth or provenance. Missing data stays null or empty.
- [DynamoDB adapter](job-postings.dynamodb.ts) owns all storage commands and pagination. Its transport
  is injectable. Records live under a partition derived only from the verified subject. Table names
  come from runtime configuration; client owners, tables and arbitrary query fields are rejected.
- Each record has a chronological sort key and a bounded JSON payload. A separate URL-hash pointer
  in the same partition enforces uniqueness. A conditional transaction creates both or neither.
  JSON avoids unbounded DynamoDB map/list overhead; storage envelopes and payloads validate on read.
  Returned record keys, owner and source URLs are checked before returning public data.

Lists use strongly consistent descending queries over the record prefix, excluding uniqueness
pointers. Cursors contain a version, owner digest and last record key; they are encoded, not encrypted
or signed. They are validated and bound to the current owner, and database partition keys are rebuilt
from authentication. Cursor tampering cannot select another user's partition. Clients must treat
cursors as opaque. DynamoDB may stop before the requested count at its byte limit; follow the cursor
until null. There is no total count or snapshot guarantee across pages. Concurrent new records can
appear only after restarting pagination.

## Duplicates, failures and recovery

URL identity is the existing normalizer's exact output. Query parameters are preserved; tracking
variants or HTTP versus HTTPS can therefore be distinct records. No ATS-specific canonicalization
or cross-user deduplication is performed. Repeated saves return the original timestamps and data.
A hash match must also match the stored URL; a mismatched or orphaned pointer fails safely.

The transaction request token remains stable across SDK retries of that operation. After a failed
write, a strongly consistent read can recover an existing winner or a committed write whose response
was lost. Unresolved contention and outages return temporary unavailability, allowing a caller retry
without duplicate creation. A database failure is never a successful empty list. Invalid stored data
fails the request rather than silently omitting records or repairing missing fields with input defaults.

The request owns a bounded database operation, including credential resolution and SDK retries.
The SDK makes at most three attempts per command; there is no application transaction retry loop.
A timeout can occur after a transaction commits. Retrying the same normalized URL recovers that record.
Client disconnection does not cancel an accepted save: it continues within its operation deadline,
independently of browser lifetime. No background worker or durable job ledger exists.

## Retention, deployment and verification

[Serverless configuration](../../../serverless.yml) owns stage-specific tables, on-demand billing,
encryption, point-in-time recovery, retention on stack removal/replacement and least-privilege IAM.
Only reads, queries and transactional puts are granted to the runtime. No scans, indexes or local
Docker database are required. The AWS SDK is bundled from the lockfile. Local operation uses the
standard AWS credential chain and an explicitly configured table/region; tests use an injected fake.

The [shared data boundary](../../../../docs/job-postings-data-boundary.md) owns retained data,
account-deletion limitations and recovery constraints. Never log owners, URLs, cursors, notes,
stored records, authorization or raw SDK errors. Shared logs expose only request outcome and timing.

[Tests](job-postings.test.ts) cover public API behavior, ownership, normalization, tracking, rich facts,
route body budgets, duplicate/concurrent saves, uncertain-write recovery, bounded operations and
corrupt storage. The in-memory transport exercises actual SDK command construction but is not a
DynamoDB emulator and does not prove AWS transaction scheduling, IAM or deployed compatibility.
Fixtures are fictional. Run server gates/build, documentation checks and package storage inspection
(`npm run check:storage-package`). Deployment and live persistence checks require a separately
authorized target; ordinary tests never write to AWS or call the parser's providers.
