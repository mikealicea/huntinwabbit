# Live API end-to-end tests

This suite checks the complete hosted path: dedicated-user password sign-in with Supabase, HTTPS
requests through the deployed API's front door, Lambda composition, public-key verification and
the hello response. It does not use a fake provider or bypass authentication. It is an explicit
external operation, separate from the offline server gate. Run only against an authorized target.

## Owners and setup

- [auth.e2e.ts](auth.e2e.ts) owns the live scenarios and session lifecycle.
- [live-client.ts](live-client.ts) loads configuration, validates origins, bounds requests and
  removes sensitive provider/network details from failures. It imports the production Supabase
  configuration parser rather than reimplementing issuer construction.
- [vitest.e2e.config.ts](../vitest.e2e.config.ts) selects only live tests, without retries or parallel
  files. [The normal configuration](../vitest.config.ts) explicitly excludes this directory.
- [The environment example](../.env.e2e.example) owns the inputs with placeholder targets. Copy it to
  ignored `.env.e2e` in `server/` and fill your own dev API URL, Supabase URL and publishable key.
  Run `mise exec -- npm run test:e2e` there.

Configure an ignored dedicated account file, or supply E2E_EMAIL and E2E_PASSWORD together through a
secret store/environment. File paths are relative to the server working directory. CI must supply
its own credentials; the example contains none. The suite fails visibly when configuration or
credentials are unavailable instead of skipping checks. It uses no admin credentials, creates no
users, sends no emails and changes no shared-project policy. Do not use a personal account.

## Coverage and lifecycle

One password sign-in supplies an access token and refresh token held in memory. Tests check public
health, the exact successful hello response, case-insensitive bearer handling, missing/malformed
credentials, a modified real signature, wrong credential types/schemes, cookie/query rejection,
comma-joined credentials and interleaved authenticated/unauthenticated requests. Protected responses
must be non-cacheable and have the generic expected body. Failure assertions do not print bodies,
tokens, account identifiers or provider error payloads.

Requests have bounded deadlines and reject redirects so credentials cannot follow a redirect to
another destination. Real tokens never enter test names, URLs, snapshots or persisted test output.
The query-string probe uses an invalid marker, not a real token. Account files and dotenv files
must remain ignored. No provider keys are retrieved automatically.

Teardown signs out only the session created by this run, including after failed assertions. A
teardown failure fails the suite; a killed process or provider outage may leave a session active.
There are no automatic retries for sign-in or other provider mutations. Logout is not tested as
immediate access-token revocation because the API verifies JWTs locally until expiry.

## Verification limits

The bearer challenge may arrive under the standard header locally or the observed AWS remapped
header on the Function URL. Both are accepted explicitly; this does not fix the transport limitation
recorded in the [deployment guide](../docs/SERVERLESS-V4.AGENTS.md). Actual repeated HTTP header fields
were manually checked there; the automated suite checks their comma-joined representation.

Expiry, wrong issuer/audience/role, key rotation, discovery outage/recovery and concurrent key fetches
remain deterministic [auth tests](../src/features/auth/auth.test.ts). The live suite does not mutate
provider keys, wait for token expiry, simulate an outage, test resource ownership, exercise a browser,
or prove email delivery. The web API bridge has its own isolated browser suite. Passing a live run verifies the
deployed artifact at that time, not that un-deployed source changes have reached AWS.

Run the offline server gate and documentation gates for changes here, then the live command when
authorized. Neither test command deploys the service.

## Opt-in live job parsing

[job-parsing.live.ts](job-parsing.live.ts) is a separate vendor smoke suite selected only by
[vitest.job-parsing.config.ts](../vitest.job-parsing.config.ts). Run `npm run test:job-parsing:live`
with `JOB_PARSING_ENABLED=true` and a valid `REDPILL_API_KEY` in ignored `.env`. This is an explicitly
paid external check of the four supplied public links, with no automatic model retries. It invokes
the production service and adapters directly; it does not authenticate against Supabase, call the
deployed API, save opportunities or deploy. Normal `npm test` and `npm run test:e2e` exclude it.

Results contain only the site label, outcome code and elapsed time, never URLs, page content or raw
errors. A valid parsed result or documented source failure passes; model/worker integration errors
fail. Report outcomes individually because passing does not establish four successful extractions.
Deterministic HTTP and Lambda package tests separately cover authentication and route composition.

## Explicit saved-posting smoke

[job-postings.live.ts](job-postings.live.ts) is an opt-in operator script, outside the ordinary test
and auth E2E suites. Run `LIVE_JOB_URL=https://jobs.example.com/role mise exec -- node
--env-file=.env.e2e e2e/job-postings.live.ts` only against an authorized target with the dedicated account.
It saves one real link without requesting parsing, verifies duplicates, detail, updates, stale-version
conflicts and list privacy, then revokes its own session. The saved smoke record is retained because
there is no delete API. It never logs payloads, tokens or account identifiers. Browser extraction
checks are separate paid operations and must name their attempt budget and target.
