# Live posting API

## Purpose and boundaries

This feature connects the authenticated workspace to the independently deployed backend. It owns
stage selection, server-side bearer forwarding, wire validation and RTK Query caching. It does not
fetch posting websites, run inference or own durable extraction. Those belong to the backend.

## Owners and flow

- [configuration](job-api.config.ts) reads the stage and selected origin at request time. Local
  development defaults to dev; other runtimes require an explicit stage. Every stage requires its
  own configured API origin. There is no maintainer endpoint fallback. Checked-in examples use
  placeholders; actual deployment targets belong in ignored local environments or hosting config.
  [The environment example](../../../.env.example) includes both dev and prod origins. Adding a
  production origin does not select it: the configured stage, not the Git branch, chooses the target.
- [server composition](job-api.server.ts) and [bridge](job-api.bridge.ts) back the allowlisted
  [Next route](../../app/api/job-postings/[[...path]]/route.ts). Every request verifies identity through
  the auth feature before retrieving the same user's session token. Cookie refreshes are persisted.
  Mutations require the configured application Origin. Redirects, arbitrary proxy paths and shared
  caches are prohibited. Tokens never enter client props or Redux.
- [contracts](job-api.contracts.ts) validate requests and bounded responses. The backend's public
  [schemas](../../../../server/src/features/job-postings/job-postings.schemas.ts) are authoritative;
  both sides validate the fictional browser fixture in tests. Update both contracts together.
- [client](job-api.client.ts) owns the RTK Query cache, page cursors, mutations and invalidation.
  A fresh account-keyed store isolates users. Transport failures and malformed responses become safe
  errors without serializing upstream content. No mutation or paid extraction is automatically retried.
- [feedback](RequestFeedback.component.tsx) renders loading, session-expiry, conflict and retry states.
  Loading feedback includes the shared motion-aware activity cue.
  Feature containers own workflow decisions; presentation components receive props.

## Lifetimes and recovery

The board loads pages sequentially and labels counts as incomplete until loading finishes. Failed
later pages preserve earlier results. Individual pending roles poll every five seconds while focused;
role details stop polling after terminal extraction. Reconnect/focus refresh is observational. Closing
or reloading the browser cannot stop an accepted backend extraction job.

Saving a link is idempotent by backend-normalized URL. Updates use application versions; conflicts
retain note drafts for review. Successful writes invalidate lists and details. Extraction acknowledgements immediately update the
detail cache so pending controls and polling start without waiting for a refetch. DELETE validates the
expected application version and requires an empty 204 success; it removes the acknowledged ID from
cached board pages before navigation. Failed deletions retain cached data. Deletion returns no response payload; upstream errors remain sanitized. The browser keeps no
persistent copy of application data. Unsaved drafts and unsubmitted batch rows are not durable.

## Verification

[job-api.test.ts](job-api.test.ts) covers configuration, auth ordering, routing, payload bounds and
safe error responses. Feature tests use fresh real stores with an injected HTTP boundary, never
mocked Redux hooks. [Browser tests](../../../e2e/e2e.AGENTS.md) exercise the real Next bridge against
isolated fake auth/API servers. Fixtures and test adapters are never imported by runtime code.
Run web gates, auth/state coverage, architecture checks and browser tests. Live dev deployment and
paid inference require an explicitly authorized target; offline tests never use hosted infrastructure.

Role update submission, history and Undo use the same authenticated bridge, schema validation and
origin rules. History remains in RTK Query rather than a duplicate product slice. Successful history
reads invalidate posting caches so durable results appear on the board and role. Submission carries
a client operation ID for acknowledgement recovery; the server owns paid work and ordering.
The [role workspace barrel](../role-workspace/role-workspace.AGENTS.md) owns interaction details.
