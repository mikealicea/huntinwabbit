# API authentication

## Purpose and boundaries

Authenticate application API requests using access tokens from the shared Supabase project. The
public health route precedes this boundary; all remaining routes require authentication. This is
identity verification, with no application storage or resource ownership model. The web hello bridge
forwards verified credentials; the API independently checks the bearer token. There is no development
bypass, cookie authentication or session mutation in this API.

The [cross-stack runbook](../../../../docs/auth-infrastructure.md) owns the provider boundary and
shared-project setup. Do not rotate shared signing keys or change hosted auth policies as a test.

## Owners and data flow

- [auth.index.ts](auth.index.ts) is the feature's public interface. [auth.types.ts](auth.types.ts)
  defines the verifier contract and request-local identity. Only the verified subject becomes userId;
  no client-supplied ownership identifier or raw claims object is exposed to downstream code.
- [auth.config.ts](auth.config.ts) validates trusted configuration and derives issuer/key discovery.
  [runtime.ts](../../runtime.ts) constructs the verifier once per app; both local and lazy Lambda
  entry points use it. Configuration errors fail construction without echoing supplied values.
- [auth.verifier.ts](auth.verifier.ts) uses jose for signature and claim validation with an injected
  fetch boundary. It accepts only asymmetric user tokens. API keys, anonymous users and legacy
  shared-secret tokens are not supported. Exact algorithms, claims, timeout and cache settings live
  in that implementation, not a second configuration table here.
- [auth.middleware.ts](auth.middleware.ts) accepts a single bearer Authorization header, rejects
  duplicates using native raw headers or comma-joined Function URL headers, sets no-store and places
  identity in typed response locals. The serverless-http adapter leaves rawHeaders empty; never
  require its presence to accept an otherwise valid Lambda request. Bearer
  tokens in query strings, cookies or request bodies are never authentication inputs.
- [app.ts](../../app.ts) mounts public health, authentication, bounded JSON parsing and feature routes in
  that order. The [shared error handler](../../shared/shared.errors.ts) owns error envelopes and the
  bearer challenge. Attach future application routes after authentication.

Function URLs use the [AWS v2 event format](https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html);
its [duplicate-header contract](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html)
combines repeated values with commas (checked 2026-09-19). Lambda tests must exercise a valid token
as well as denied requests to verify the adapter's header representation.

## Failure, caching and privacy

Missing or invalid credentials return a generic unauthorized response. Discovery transport, timeout,
non-success HTTP and malformed-key-set failures return temporary unavailability. Unknown signing
keys fail authentication; cached discovery has a refresh cooldown to bound repeated unknown-key
requests. No failed verification grants access. Each request verifies its own token and claims;
only public keys and in-flight discovery are shared.

jose owns discovery caching and refresh. Concurrent fetches are coalesced; a failed fetch is retried
on a subsequent request, without an application retry loop. Fresh cached keys can verify tokens
while the provider is unavailable; an expired cache must refresh successfully. Rotation is visible
after discovery refresh, not instantly. No token authentication results are cached.

Local JWT verification does not check current account status or remote session revocation. Logout,
account deletion and signing-key revocation must not be described as immediate API revocation.
Outstanding tokens can remain usable until expiry; public-key caching adds revocation delay. Dev
and prod trust the same issuer. Data ownership and deployment-specific storage must use
verified identity and trusted deployment configuration.

Preserve provider causes internally, but never log them, token claims, headers, bodies or user IDs.
The [shared barrel](../../shared/shared.AGENTS.md) describes the request/error logging boundary.
Private responses and authentication failures prohibit caching.

## Verification and operation

[auth.test.ts](auth.test.ts) runs real cryptographic verification through the Express app with
injected discovery responses, temporary test keys and controlled time. It covers claim/header
rejections, algorithms, signature forgery, key rotation/cache expiry, concurrent users and key
fetches, provider failures, the actual fetch deadline, response headers and logging privacy.
[runtime.test.ts](../../runtime.test.ts) checks configuration and runtime construction;
[lambda.test.ts](../../lambda.test.ts) checks lazy construction, failure recovery and Function URL
request handling. The standalone hello-router test exercises presentation only; application auth
is established by these composition tests.

Run the server gate, build and documentation gates. Follow the [deployment guide](../../../docs/SERVERLESS-V4.AGENTS.md)
for local packaging. Offline checks use no hosted account, send no email and do not prove current
hosted-token compatibility or deployment. Use the [server README](../../../README.md) for local
setup and a deliberate bearer-token smoke test. A published public key can be standby; its presence
alone does not prove which algorithm signs current sessions.

The opt-in [live E2E suite](../../../e2e/e2e.AGENTS.md) automates dedicated-user sign-in and
deployed endpoint success/rejection checks without changing hosted auth policy.
