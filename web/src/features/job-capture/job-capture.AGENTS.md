# Job capture

## Purpose and behavior

Capture saves several opportunities without requiring posting details. Each row has its own optional
interest. Typing in the last row adds an empty row; blank rows are ignored on submission. Closing and
reopening the form keeps its draft while the board remains mounted. Navigation away from the board
discards the draft. Successful submission resets rows and focuses the first field for another batch.

[JobCapture.container.tsx](JobCapture.container.tsx) owns container-local `useState` drafts, errors, visibility and
announcements. Its updaters are pure; DOM focus and ID allocation happen outside updaters.
Saved opportunities become shared Redux state.
[JobCapture.component.tsx](JobCapture.component.tsx) accepts draft rows, feedback, refs and intent
callbacks. It renders the form without importing Redux or owning another copy of the draft.
[job-capture.validation.ts](job-capture.validation.ts) owns URL validation. The whole batch must be
valid before dispatch: errors retain all input and focus the first invalid field. Only HTTP/HTTPS
URLs without embedded credentials are accepted. Duplicate URLs are allowed as separate captures;
there is no deduplication or external request.

## Data flow and boundaries

[job-capture.index.ts](job-capture.index.ts) is the public component export. The form allocates IDs
before dispatching the generated batch-capture action through the [job-search public surface](../job-search/job-search.index.ts). Captures
start in Collected with unset priority, no verified company and no posting facts. The source URL
stays separate from employer identity. Copy must not claim that extraction is running or will finish.

No parsing, file handling, authentication, persistent storage, queue or retry mechanism exists. A
future parsing flow needs a server contract and lifecycle independent of this form. Closing a form
must not erase successfully captured opportunities.

## Verification

[validation tests](job-capture.validation.test.ts) cover blanks, individual interests, invalid schemes
and embedded credentials. [presentation tests](job-capture.presentation.test.tsx) verify errors and emitted row intents without
a store; [rendered tests](JobCapture.test.tsx) cover row growth, all-or-nothing
validation, retained drafts, focus and resulting cards. [browser tests](../../../e2e/job-search.spec.ts)
cover capture through navigation and reload. Run the gates in the [web guide](../../../AGENTS.md).
