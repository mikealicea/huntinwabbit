# Job-search state and contracts

## Purpose and boundaries

This feature owns one temporary job-search session: application choices, posting facts, shared
companies, tasks and materials. It supports the board, capture and role workspace without a backend.
It is not authentication, persistent storage, a parser or an API client.

[JobSearchProvider.tsx](JobSearchProvider.tsx) is mounted in the
[application layout](../../app/app/layout.tsx). The layout requires a verified identity and keys this provider by user ID so account changes
cannot inherit another user’s in-memory edits. [Auth](../auth/auth.AGENTS.md) owns that boundary.
Navigation within `/app` preserves edits. Reloading
creates fresh fictional fixtures; leaving the layout can also discard the session. No application
data is written to browser storage, sent to a service or included in logs. Theme preferences have a
separate owner. The provider's date clock refreshes due labels on visibility changes and each minute.

## Owners and interfaces

- [job-search.index.ts](job-search.index.ts) exposes the provider, hook, presentation helpers and
  contracts used by other features. Consumers must not import internal state or fixtures.
- [job-search.types.ts](job-search.types.ts) owns exact domain types and actions. Posting details
  are distinct from user-managed application fields. Stage, interest and priority remain independent.
- [job-search.state.ts](job-search.state.ts) applies immutable, synchronous updates. Capture IDs are
  allocated by the caller before dispatch; reducers do not create IDs, perform IO or read the clock.
- [job-search.fixtures.ts](job-search.fixtures.ts) creates new objects per session. Company IDs share
  research and contacts across roles; application notes, tasks and materials remain role-specific.
- [job-search.selectors.ts](job-search.selectors.ts) derives company labels, salary and next actions.
  Calendar dates retain their calendar day across timezones. Follow-ups take precedence over tasks;
  closed roles suppress urgency. Missing facts remain visibly unavailable.

Submitted material metadata is a snapshot, not a reference to the planned resume. The update action
cannot edit it. These records represent sample submissions; no document bytes are stored or served.
Unknown employers are not inferred from source hostnames. Future extraction needs an explicit server
contract and adapter; this feature establishes only frontend types, not a wire protocol.

## Verification and limits

[job-search.test.ts](job-search.test.ts) covers independent choices, submitted snapshots, shared
companies, session isolation, date ordering and partial salary data. Rendered feature tests and
[browser tests](../../../e2e/job-search.spec.ts) verify observable integration. Run the web and
documentation gates in the [web guide](../../../AGENTS.md).

There are no network retries, persistence recovery, concurrent server writes or background extraction
to model yet. A missing temporary role after reload is handled by the role workspace. Fixtures use
fixed dates; tests inject the comparison date rather than depending on the wall clock.
