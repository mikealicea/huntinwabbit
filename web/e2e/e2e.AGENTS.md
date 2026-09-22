# Frontend browser verification

[playwright.config.ts](../playwright.config.ts) owns the browser project, viewport, local server and
artifact policy. [job-search.spec.ts](job-search.spec.ts) verifies routing, capture, application
edits, refresh/failure/retry, deletion confirmation and URL reuse, real drag geometry, persistence
across reload and mobile theme behavior. Posting action tests verify dropdown keyboard dismissal, focus restoration and capture menus/dialogs in
desktop/mobile layouts and both themes. Card menus also exercise refresh/retry and deletion
without leaving the board, with focus recovery and persistence after reload. Tests use only fictional data and
the local application. They do not visit captured URLs or depend on the hosted backend.
[Public-page tests](public-pages.spec.ts) exercise real blog loading, generated MDX, metadata and
breadcrumb navigation without a session. Board status tests measure stable layout through loading, errors, retry and stage saves, including
keyboard popover dismissal and desktop/mobile status screenshots. Account and workspace suites
save desktop/mobile screenshots
in ignored test output for visual review; these are review artifacts, not pixel-baseline assertions.
[auth.spec.ts](auth.spec.ts) exercises account flows, protected routes, cookie refresh, and failure
handling through the real SDK against [auth-provider.mjs](auth-provider.mjs). The provider is a
loopback-only test process; its account/message helpers are never imported into the app. The Next.js
test process receives explicit fake URL/key values so `.env.local` cannot target the shared project.
Workspace tests sign in through the actual login form. Repeated drag tests wait for restored
handle focus and inactive drag state before starting the next interaction. No test accounts or emails are created remotely. Job details checks cover section order, technology
qualifiers, Markdown headings, reload, desktop/mobile layouts and 200% CSS zoom in both themes;
screenshots support visual review and do not establish a screen-reader audit.

Install Chromium with `npx playwright install chromium`, then run `npm run test:e2e` from `web/`
under its mise runtime. The suite starts and stops its own Next development server on port 3100.
The Next test server uses ignored `.next-e2e/` output so it can coexist with a developer’s server.
The configuration’s NEXT_DIST_DIR setting is for development/test builds; the production Pagefind
script expects the ordinary `.next/` build output. A fake auth and posting API server runs on port 3101. Each workspace browser test uses its own fictional account and record set. The Next test process explicitly selects its loopback dev API target. An occupied port is an error rather than permission to test an unknown server. Browser projects use
isolated contexts; failed traces and reports are ignored by Git. Do not use real personal data in
traces, screenshots or assertions. Browser tests supplement the production build and unit gates.

The automated viewport checks do not establish a screen-reader audit, physical touch-device support
or complete contrast coverage. Record manual checks and limitations in the handoff. Keep this guide
indexed in the [web guide](../AGENTS.md).

Role chat scenarios use deterministic loopback operation responses, never live Redpill inference.
They verify reload recovery, refresh precedence, partial summaries, explicit retry, Undo and native
mobile-dialog focus/dismissal in both themes. Role updates use Cmd+Enter, with plain Enter
newlines and history collapsed below the composer by default. Role header status tests exercise
network failure/retry, posting-status details and popover keyboard dismissal. Screenshots are retained in ignored test output.

[Company tests](companies.spec.ts) exercise board/role links, direct routes, correction and creation,
multiple-role membership, refresh/delete actions, reload, empty companies, focus, and desktop/mobile
layouts in both themes. The loopback fixture owns fictional companies per test account. Company
screenshots remain ignored review artifacts; the suite never creates hosted company records.
Notes scenarios use the isolated API fixture to verify distinct persisted comments, Markdown preview,
editing, Cmd+Enter submission, plain Enter newlines, permanent deletion, focus recovery and reloads
in desktop/mobile layouts and both themes.
Comment screenshots are review artifacts; no real notes or provider calls enter these tests.

Pasted-source scenarios cover initially collapsed capture rows, the attached check without submission,
folding on row focus changes, multi-link save, retained source editing/removal and reload, native dialog
focus restoration, and desktop/mobile layouts in both themes. Screenshots show expanded and collapsed
editors and the saved-role dialog. The fake API retains fictional pasted sources and simulates extraction;
it does not establish model accuracy or real posting retrieval.

Company analysis uses deterministic fictional results from the loopback API. Company browser tests
exercise initialization, evidence disclosure, explicit refresh, header status placement, scheduled
countdown/expiry, Analyze now, keyboard details dismissal, reload, and narrow layouts in both
themes. Analysis screenshots are ignored artifacts, not evidence of provider accuracy.

Company comment cases use the same isolated fixture routes as role notes with separate company keys.
They verify Markdown preview, keyboard submission, reload persistence, inline edits, confirmation and
focus restoration, plus desktop columns and Notes-first mobile order in both themes. Company-comment
analysis provenance and zero-role inference are tested through deterministic server/web contracts;
browser fixtures do not establish deployed inference behavior.
