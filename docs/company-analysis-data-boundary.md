# Company analysis data boundary

Company analysis generates shared requirements and technologies from a user's saved information.
The [feature barrel](../server/src/features/company-analysis/company-analysis.AGENTS.md) owns its
lifecycle and links executable contracts. It is an optional capability, disabled by default through
`COMPANY_ANALYSIS_ENABLED`; operators enable it with their own Redpill key and infrastructure.

## Inputs and processors

The server reads the user's company identity and all associated roles, including Closed roles.
Inputs include effective posting facts and corrections, original extraction when superseded, saved
URLs, tracking choices, legacy notes, current comments, and role-update messages and receipts.
Original and historical information remains labeled; undone/failed changes are not current facts.
Deleted comments and previous generated company findings are excluded. Internal storage keys,
authentication credentials and owner identifiers do not enter prompts. Temporary numeric evidence
references replace internal role identifiers in model requests.

This expands the AI boundary to include personal comments and history for company analysis. The
existing posting parser and natural-language role editor retain their own input exclusions; comments
are not newly sent by those flows. No new vendor is added: analysis reuses the existing Redpill
completion adapter and configured model. Saved URLs are text inputs, not requests to fetch websites.
Redpill receives the supplied content; local deletion cannot revoke a provider request already sent.
Provider retention and deletion behavior are not guarantees enforced by this repository. See the
[existing parsing boundary](job-parsing-data-boundary.md) for the provider context.

## Storage, deletion and accuracy

AWS DynamoDB holds owner-scoped source revisions, analysis progress, temporary input chunks and
candidate findings, and completed company results. API responses are authenticated and not cached
publicly. The browser uses the account-scoped memory cache; there is no persistent browser copy.
Worker logs and alarms expose operational categories without source content or raw provider errors.

Ordinary edits mark results stale while regeneration proceeds. Deleting a role/comment or moving a
role hides the prior affected company result and schedules recomputation and cleanup. Intermediate
and obsolete result content has durable cleanup; temporary input/node rows also have a seven-day TTL
fallback. TTL deletion is asynchronous. Successful current results persist until replaced or
invalidated. Task metadata and request receipts expire after seven days. Existing backup retention
and account-erasure limitations remain described in the [saved-data boundary](job-postings-data-boundary.md).

Evidence validates against supplied excerpts and role references. This catches invented references
but cannot guarantee correct interpretation, exhaustive extraction, or employer-wide applicability.
Counts measure distinct supporting roles in the analyzed saved information. Missing data is not a
negative claim. Personal observations remain distinguishable from employer statements.

## Setup and verification

Ship the API, posting extraction/recovery, analysis/recovery functions and transactional IAM changes
together. Enable `COMPANY_ANALYSIS_ENABLED=true` and configure `REDPILL_API_KEY` in ignored deployment
configuration for the authorized stage. Use placeholders in committed examples. No schema migration
or bulk paid analysis is required; existing companies initialize when opened or changed.

Automatic changes use a short quiet period. Explicit refresh requests durable work; batches can make
multiple paid calls. Provider failures and uncertain paid outcomes require explicit retry. Large
candidate/evidence sets can exceed validated capacity and produce a safe failure rather than partial
results. Local tests and package inspection do not prove deployed provider access or model quality.
Deployment and live paid evaluation are separate authorized operations.
