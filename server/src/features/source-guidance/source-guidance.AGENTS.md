# Shared source guidance

Help people supply pasted job descriptions before a website blocks extraction. This is advisory:
text remains optional, every URL still fetches, and guidance never changes saved-role ownership.
The registry is shared across accounts within one deployment's configured posting table; separate
stages and self-hosted installations do not share records.

## Owners and contracts

[Schemas](source-guidance.schemas.ts) own the hostname-only lookup and observation interfaces.
[Router](source-guidance.router.ts) serves authenticated lookups, mounted before saved-role ID routes.
There is no client write or enumeration API. [Store](source-guidance.store.ts) owns normalization,
seeding, validation, bounded DynamoDB reads and conditional transactions. [Index](source-guidance.index.ts)
is the cross-feature interface. API [composition](../../runtime.ts) and the
[extraction worker](../job-postings/job-postings.worker.ts) install the same observer in the parser.

Keys identify the requested hostname; the fetch adapter does not reliably expose a final redirect
destination. Do not infer or learn a redirected hostname from model output.

Hostnames are case insensitive; a trailing dot and leading www are ignored. Other subdomains stay
separate. Never generalize a tenant hostname to a parent domain or store URL paths/query strings.
Indeed is a task-requested built-in seed, not a guarantee that every Indeed request fails; other sites
are learned from this deployment's observations. Seeds are code-owned and survive successful scans.

## Learning and recovery

The [parser](../job-parsing/job-parsing.service.ts) reports HTTP access blocks and valid model
classifications of fetched pages. Expired/non-job pages, rate limits, oversized sources, cancellations,
timeouts and provider failures are not host evidence. Pasted-source success alone never clears a
warning. Combined-source inference separately classifies fetched text in the existing single call.
Model classification can be wrong; the registry is a suggestion, not an access-control policy.

Each fetch attempt has an order token from its start time and a nonce. Conditional writes accept
only newer observations, making SDK retries/replays harmless and preventing delayed older results
from replacing newer results. Concurrent observations use timestamp/nonce order, not arrival order;
this relies on runtime clocks. A usable fetched posting clears learned guidance. Inactive records
are retained, including first observations of success, to fence older in-flight blocks. No expiry,
paid retry, additional inference call or historical backfill is introduced.

Records occupy SOURCE-GUIDANCE partitions, with no user identifiers, posting IDs, raw text or full
URLs. They carry no pending-index attributes, job prefixes or TTL. Existing encrypted table retention
and backups apply; role deletion does not remove shared observations. See the
[shared data boundary](../../../../docs/job-postings-data-boundary.md).

## Failure and verification

Reads are strong and validate stored keys and values. Lookup failure returns unavailable; the UI
keeps ordinary capture and manual text disclosure usable. Seeds work without configured storage.
Writes use existing transaction-only IAM permissions and are bounded to two seconds including SDK
retries (at most three attempts). A failed observation never revokes extraction and emits only
source_guidance.observation_failed. There is no durable retry queue for advisory writes: an outage
can lose that observation, and a later scan can teach the site again. Monitor this event alongside
existing application logs; no alert recipient is configured.

[Tests](source-guidance.test.ts) cover cross-user reads, host boundaries, seed precedence, ordering,
replay, corruption, timeouts and privacy. [Parser tests](../job-parsing/job-parsing.guidance.test.ts)
cover independent fetched/pasted outcomes and ignored failures. Run server gates/build, documentation
checks and package checks. Fake storage does not establish deployed IAM or clock synchronization.
Backend/API and extraction workers should ship together; the accepting web lookup degrades safely
against an older backend. No posting migration or live provider evaluation is required.
