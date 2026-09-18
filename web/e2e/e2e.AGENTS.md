# Frontend browser verification

[playwright.config.ts](../playwright.config.ts) owns the browser project, viewport, local server and
artifact policy. [job-search.spec.ts](job-search.spec.ts) verifies routing, capture, application
edits, real drag geometry, session reset and mobile theme behavior. Tests use only fictional data and
the local application. They do not visit captured URLs or depend on the Express backend.
[Public-page tests](public-pages.spec.ts) exercise real blog loading, generated MDX, metadata and
breadcrumb navigation without a session. Account and workspace suites save desktop/mobile screenshots
in ignored test output for visual review; these are review artifacts, not pixel-baseline assertions.
[auth.spec.ts](auth.spec.ts) exercises account flows, protected routes, cookie refresh, and failure
handling through the real SDK against [auth-provider.mjs](auth-provider.mjs). The provider is a
loopback-only test process; its account/message helpers are never imported into the app. The Next.js
test process receives explicit fake URL/key values so `.env.local` cannot target the shared project.
Workspace tests sign in through the actual login form. Repeated drag tests wait for restored
handle focus and inactive drag state before starting the next interaction. No test accounts or emails are created remotely.

Install Chromium with `npx playwright install chromium`, then run `npm run test:e2e` from `web/`
under its mise runtime. The suite starts and stops its own Next development server on port 3100.
The Next test server uses ignored `.next-e2e/` output so it can coexist with a developer’s server.
The configuration’s NEXT_DIST_DIR setting is for development/test builds; the production Pagefind
script expects the ordinary `.next/` build output. A fake auth server runs on port 3101. An occupied port is an error rather than permission to test an unknown server. Browser projects use
isolated contexts; failed traces and reports are ignored by Git. Do not use real personal data in
traces, screenshots or assertions. Browser tests supplement the production build and unit gates.

The automated viewport checks do not establish a screen-reader audit, physical touch-device support
or complete contrast coverage. Record manual checks and limitations in the handoff. Keep this guide
indexed in the [web guide](../AGENTS.md).
