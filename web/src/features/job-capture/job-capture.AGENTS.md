# Job capture

Capture persists job links immediately with optional interest and requests durable background
extraction. Blank rows are ignored; typing in the last row adds another. URL validation accepts
explicit HTTP(S), protocol-relative, www and bare-host links, rejecting credentials and malformed
schemes. The backend's normalized URL determines duplicate identity.

[Container](JobCapture.container.tsx) owns local drafts, batch feedback and calls to the
[API client](../job-api/job-api.AGENTS.md). [Presentation](JobCapture.component.tsx) receives rows and
callbacks. [Validation](job-capture.validation.ts) rejects the entire batch before any request if
an input is invalid. Valid rows save sequentially; successful/duplicate rows clear, failed rows stay
editable for retry. Duplicate saves retain the existing role's facts and choices.

The form stays available while extraction runs on the backend. Closing the form preserves its draft
while mounted. Navigation/reload can discard unsaved rows; only accepted backend saves are durable.
A lost save response can be retried safely by normalized URL. No client-side paid parsing runs.

Tests cover normalization, props, validation/focus, saved interests and API integration. Browser tests
cover capture, navigation and persistence across reload. Run web gates and browser verification.
