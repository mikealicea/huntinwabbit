# Job capture

Capture persists job links immediately with optional interest and requests durable background
extraction. Blank rows are ignored; typing in the last row adds another. URL validation accepts
explicit HTTP(S), protocol-relative, www and bare-host links, rejecting credentials and malformed
schemes. The backend's normalized URL determines duplicate identity.

[Container](JobCapture.container.tsx) owns local drafts, batch feedback and calls to the
[API client](../job-api/job-api.AGENTS.md). [Presentation](JobCapture.component.tsx) receives rows and
callbacks. [Validation](job-capture.validation.ts) rejects the entire batch before any request if
an input is invalid. Valid rows save sequentially; successful rows and duplicates without pasted drafts clear; failed rows stay
editable for retry. Duplicate saves retain the existing role's facts and choices.

The form stays available while extraction runs on the backend. Closing the form preserves its draft
while mounted. Navigation/reload can discard unsaved rows; only accepted backend saves are durable.
A lost save response can be retried safely by normalized URL. No client-side paid parsing runs.

The save button shows a pulsing activity cue while links are being saved; reduced motion keeps
the dot static. Extraction activity is shown on each saved role after capture.

Tests cover normalization, props, validation/focus, saved interests and API integration. Browser tests
cover capture, navigation and persistence across reload. Run web gates and browser verification.

## Pasted page text

Each row offers a collapsed page-text disclosure. Only one editor opens at a time; focusing another
row folds the previous editor. The attached green check folds the editor and restores disclosure
focus without submitting. Draft text survives folding and closing the capture form while mounted.
Only Save to Collected persists the batch. Source limits are validated before any save; source errors
reopen and focus the relevant editor. Text without a URL is invalid.

Optional text travels with each save into durable backend storage and extraction. Duplicate links
with pasted drafts stay editable and link to the existing role; capture never overwrites that role's
retained source or silently discards the new draft. The saved-role source editor owns replacements.
The [validation helper](job-capture.validation.ts) owns browser limits; backend schemas enforce them
again. Copied visible text is supported, with no rich-HTML import, upload or clipboard permission.
