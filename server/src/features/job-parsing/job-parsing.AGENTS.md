# Job posting parsing

## Purpose and boundary

Turn a public job-posting link into consistent, validated facts through an authenticated synchronous
REST request. This feature does not save an opportunity, update the web board, persist posting
content, or own background work. Each request is independent, including repeated URLs. Missing
facts remain missing; extraction is not verification of an employer's claims.

The [router](job-parsing.router.ts) owns the route and HTTP lifecycle. The executable request,
response, compensation and model-output contracts live in [schemas](job-parsing.schemas.ts);
do not maintain a second field inventory here. The response's version allows future clients to
distinguish incompatible contracts. The web maps this richer contract into board summaries while preserving full details. The [saved-postings feature](../job-postings/job-postings.AGENTS.md)
accepts supplied parse responses and owns durable extraction jobs whose worker calls this service. The synchronous parse endpoint itself never saves automatically.

## Owners and flow

- [index](job-parsing.index.ts) is the cross-feature interface. [Runtime composition](../../runtime.ts)
  chooses the concrete adapters. The capability is explicitly disabled by default; when enabled,
  missing or malformed key configuration fails construction. [Configuration](job-parsing.config.ts)
  owns the model, trusted provider endpoint and deadlines.
- [URL normalization](job-parsing.url.ts) accepts explicit HTTP(S), protocol-relative links, `www`
  links and bare hosts with paths. It trims surrounding whitespace, rejects credentials and invalid
  schemes, defaults omitted schemes to HTTPS, removes fragments and preserves query parameters.
  This is input normalization, not a complete network security boundary.
- [Service](job-parsing.service.ts) sequences normalization, fetching, extraction and response
  validation. Page classifications distinguish a usable job from blocked, expired and unrelated
  pages. Successful partial jobs have missing-fact warnings; amounts are not annualized and company
  identity is never derived merely from the source hostname.
- [Fetch adapter](job-parsing.fetch.ts) starts one credential-free Node child per request, sends
  only the URL and content limit over IPC, validates its reply, and waits for process closure.
  The [worker program](job-parsing.worker.ts) calls the pinned, unmodified agent-fetch package.
  Its program is a static string so bundlers cannot introduce unavailable closures; input never
  becomes executable source or shell arguments. All child stdout/stderr is discarded because
  upstream logs include URLs. Only the allowlisted IPC result leaves the child.
- [Redpill adapter](job-parsing.redpill.ts) exposes a bounded JSON-completion transport reused by
  saved-role updates. The URL extractor sends extracted page text with a schema-oriented prompt
  using JSON object mode with reasoning disabled. Source text is untrusted, tools are unavailable, output is bounded, and
  the completion envelope, finish reason, JSON and job schema must all validate. Prompt isolation
  reduces instruction confusion; schema validation does not prove factual accuracy.

## Lifetimes, failure and recovery

The server invocation owns the operation while it runs. Fetching has a hard subprocess deadline;
completion, cancellation and timeout kill/reap that child before the adapter settles. The Redpill
transport has its own abortable deadline. The router propagates disconnects and the overall deadline.
The Lambda timeout exceeds the application budget. Local and deployed environments share these
owners; a page or capture component does not own the work.

There is at most one model call per request, with no repair call, automatic model retry, result
cache, database ledger or idempotency key. Agent-fetch retains its internal retrieval retries and
fallbacks within the subprocess deadline. Cancelling inference cannot promise a refund or that the
provider stops computing. A lost response has no durable recovery; an explicit caller retry can
incur another charge. No user content or per-user result survives intentionally after a request.

[Errors](job-parsing.errors.ts) own safe status/code/message mappings. Malformed or incomplete model
output is a provider failure, never a fabricated job. Oversize sources fail instead of being silently
truncated. The shared middleware maps malformed JSON and oversized bodies without exposing them;
existing unrelated errors retain their previous envelope. Authentication runs before body parsing,
and all protected responses prohibit caching.

## Known limitations and operations

The user explicitly deferred transport hardening: agent-fetch is used as published. Its initial
destination checks are not a complete defense against redirects or DNS rebinding, and its size
checks do not establish a hard download-memory bound. The child process provides lifecycle and
logging isolation, **not a network or filesystem sandbox**. Its native memory use is not independently
capped. Hostile-site egress protection is follow-up work before broad untrusted use.

There is no browser rendering, custom ATS fallback, supplied cookie support, quota or distributed
rate limiter. Login walls, removed pages and bot checks can produce explicit failures. The library
does not reliably expose a resolved final destination, so the response identifies the normalized
requested URL rather than claiming it is canonical or redirect-resolved. Classification of a page
returned with HTTP 200 depends on the model and can be wrong.

The [processor boundary](../../../../docs/job-parsing-data-boundary.md) describes what leaves the
server and the observed JSON-mode capability. Keys stay in ignored local environment files or
runtime configuration. Runtime configuration through Serverless environment variables can appear
in rendered deployment output: never commit or print that output. No provider-readiness call runs
at app startup. Health is not a Redpill or fetching readiness guarantee.

Native packaging and Linux checks belong to the [Serverless guide](../../../docs/SERVERLESS-V4.AGENTS.md)
and [package verification](../../../scripts/scripts.AGENTS.md). Ordinary npm scripts do not deploy.
Structured request logs give total latency and HTTP outcome without URLs, identities, bodies or raw
causes; no persistent extraction audit trail or provider billing reconciliation exists.

## Verification

[Contract/service tests](job-parsing.test.ts) cover normalization, authentication, malformed bodies,
partial facts, classification, repeat calls and log privacy. [Model tests](job-parsing.redpill.test.ts)
exercise the real adapter with an injected transport, schema failures, prompt boundaries, stream
limits and cancellation. [Fetch tests](job-parsing.fetch.test.ts) exercise real subprocess lifetimes,
IPC failures and actual native library loading with a blocked loopback URL.

Run the server gates, build and documentation gates. Packaging plus `npm run check:package` verifies
the actual archive in a network-disabled AWS Linux runtime image. The opt-in
[live suite](../../../e2e/job-parsing.live.ts) uses the four supplied public links with real adapters
and potentially paid inference. It records safe outcomes and accepts documented source failures;
passing it does not mean every site parsed, or prove deployed authentication. See the
[E2E guide](../../../e2e/e2e.AGENTS.md) before running it.
