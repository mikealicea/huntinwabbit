# Frontend browser verification

[playwright.config.ts](../playwright.config.ts) owns the browser project, viewport, local server and
artifact policy. [job-search.spec.ts](job-search.spec.ts) verifies routing, capture, application
edits, real drag geometry, session reset and mobile theme behavior. Tests use only fictional data and
the local application. They do not visit captured URLs or depend on the backend.

Install Chromium with `npx playwright install chromium`, then run `npm run test:e2e` from `web/`
under its mise runtime. The suite starts and stops its own Next development server on port 3100.
An occupied port is an error rather than permission to test an unknown server. Browser projects use
isolated contexts; failed traces and reports are ignored by Git. Do not use real personal data in
traces, screenshots or assertions. Browser tests supplement the production build and unit gates.

The automated viewport checks do not establish a screen-reader audit, physical touch-device support
or complete contrast coverage. Record manual checks and limitations in the handoff. Keep this guide
indexed in the [web guide](../AGENTS.md).
