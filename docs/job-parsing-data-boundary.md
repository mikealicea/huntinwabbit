# Job parsing: processor and data boundary

The backend parses public job postings on demand. The [feature barrel](../server/src/features/job-parsing/job-parsing.AGENTS.md)
owns current behavior and limitations; its linked schemas and adapters are the executable contracts.
The [saved-posting API](job-postings-data-boundary.md) owns web capture persistence and durable
extraction jobs; its worker calls this parser and stores the validated result.

## Data flow

1. The authenticated client sends a posting URL to the backend. Supabase bearer verification
   establishes identity; the token and user identifier are not forwarded to either extraction adapter.
2. A fresh child process runs the pinned [agent-fetch](https://github.com/teng-lin/agent-fetch)
   dependency. Posting sites and any destinations reached by its redirects or extraction fallbacks
   receive ordinary retrieval traffic, including the submitted path/query and the server's network
   address. No user-supplied browser cookies or credentials are supported. Agent-fetch is a local
   library, not a hosted parsing service.
3. The backend sends extracted posting text, including its embedded links or contact details, to
   Redpill with a fixed extraction prompt and schema. The Redpill key authenticates only that trusted
   API request. Resumes, application notes, interest, priority and Supabase credentials are not inputs.
4. Schema-validated job facts return to the caller. This parsing operation does not persist URLs, raw pages,
   prompts, model output or parsed jobs. Vendor stdout/stderr is discarded; application logs contain
   operational status and timing rather than content. Process isolation does not sandbox network access.

This describes application behavior, not provider retention guarantees. Redpill and its routing
providers can process the submitted text; this repository does not implement vendor deletion,
retention verification, attestation or encryption beyond the HTTPS transport to Redpill. Do not
describe all processing as private, confidential, zero-retention or TEE-protected.

## External capability evidence

Checked 2026-09-19 against the [Redpill model catalog](https://api.redpill.ai/v1/models) and live
synthetic requests: the selected DeepSeek V4.1 Flash identifier exists; JSON object mode returned
HTTP 200 with valid JSON. A strict JSON Schema request returned HTTP 400. The catalog advertised
no structured-output capabilities for this entry and marked it as non-TEE. These are observations
of that route at that time, not guarantees for later provider routing or model revisions.
An extraction probe also confirmed that `reasoning_effort: none` produces valid schema-checked
output with zero reported reasoning tokens; the adapter uses that mode for bounded extraction.

[DeepSeek's API reference](https://api-docs.deepseek.com/api/create-chat-completion/) documents JSON
object mode. JSON syntax alone does not enforce our fields, types or factual fidelity: the
[Redpill adapter](../server/src/features/job-parsing/job-parsing.redpill.ts) validates the response
and rejects invalid results. Credentials and public request routes remain server-owned configuration.

## Operational boundaries

Enable the capability explicitly and store local keys in ignored `.env` files. The checked-in
example contains only placeholders. Lambda keys are supplied as runtime environment variables;
Serverless variable resolution can place plaintext in local generated templates/state and the
configured Lambda environment. Treat those generated artifacts as sensitive, keep them ignored,
and package with an empty key for offline verification. Runtime secret-store retrieval is not
implemented.

Requests have no durable ledger or idempotency guarantee. A retry can repeat paid inference;
cancellation does not establish cancellation or refund at the provider. Transport hardening and
distributed usage limits remain separate work. There is no feature-owned stored dataset to delete
or retention migration to run.

## Readability and compatibility

The existing model completion extracts explicitly named technologies and formats the complete
substantive description using Markdown headings, paragraphs and lists. It is instructed to preserve
source wording and qualifications rather than summarize; schema validation cannot establish fidelity.
The frontend renders Markdown without evaluating HTML or MDX, blocks embedded images, and restricts
description links to credential-free HTTP(S) URLs. This introduces no additional processor or model call.

Existing records keep their descriptions and may lack a technology list. Reading them does not trigger
inference. Manual refresh replaces generated content only on success, retaining user corrections;
there is no automatic or bulk reprocessing. Descriptions remain in the same editable string field.

Deploy the updated frontend readers before enabling the new backend extraction contract: older strict
frontend validators reject job payloads containing technologies. The version-one response envelope is
unchanged, and the updated readers accept both old and new records. API and extraction workers must
use matching updated schemas. Once new records or overrides are stored, rolling either application
back requires readers that still accept technologies; do not drop saved facts to enable a rollback.
