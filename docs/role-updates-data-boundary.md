# Natural-language role update data boundary

Saved-role updates accept typed or pasted text. The authenticated server stores the submitted message
before a worker sends it to Redpill. It also sends the current editable posting and tracking fields
(excluding the legacy notes field), the request's local date and a bounded selection of recent completed
conversation entries that did not change legacy notes.
The separate comment timeline and unsaved browser drafts are not sent. Notes requests in chat are
unsupported and direct users to the Notes composer; explicitly pasted chat text still goes to Redpill. Credentials remain server-side; no file upload or URL retrieval
is performed by this interaction.

This extends the existing [Redpill parsing boundary](job-parsing-data-boundary.md) from public posting
text to potentially personal correspondence and notes. The application does not enforce a provider
retention or deletion guarantee. Do not paste secrets. No message, role content, source URL, identity
or raw provider error belongs in application logs.

DynamoDB stores messages, interpretation outcomes, before/after values, concurrency snapshots and
idempotency pointers under the authenticated owner. History persists until the role is deleted, with
no automatic history expiry. Deletion immediately removes access through the role and durably cleans
its operation rows; existing backup and operational retention follows the
[saved-data boundary](job-postings-data-boundary.md). This is not account erasure or provider erasure.

The [saved-postings barrel](../server/src/features/job-postings/job-postings.AGENTS.md) owns lifecycle,
retry, Undo and conflict semantics. Executable schemas own field and size limits. Existing records
need no migration: missing edit metadata means no overrides or pending message. Setup uses the
existing parsing capability flag and provider key. Updated worker/API artifacts and transactional
worker DeleteItem permission must ship together for source-link edits; local tests do not establish
a deployed capability. Deployment and live paid inference are separate authorized operations.

When a role has an explicit company selection, the chat's current employer name reflects that
selection, so a later instruction can correct it even when the original posting named a different
company. The worker also ranks a shortlist from the account's company directory using the message
and current employer, website and description. At most twenty candidates reach the same completion,
each containing a temporary reference, bounded name and employer website hostname. Company IDs,
company comments and other roles are excluded. This adds no second inference call or new processor.
Candidates are matching evidence, not a source for filling missing posting facts; uncertain or
invalid selections fall back to ordinary company resolution. Company association snapshots stay in storage
for conflict-safe Undo. See the [company barrel](../server/src/features/companies/companies.AGENTS.md).
