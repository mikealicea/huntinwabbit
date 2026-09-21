# Local socket permissions for verification

Server HTTP tests, frontend browser tests and the web production build start local listeners.
An offline test can still need socket access: Supertest creates a listener for Express, Playwright
starts fixture/application servers, and Turbopack starts subprocesses for CSS processing.
Commands remain owned by the [server manifest](../../server/package.json) and
[web manifest](../../web/package.json); browser isolation is described in the
[E2E guide](../../web/e2e/e2e.AGENTS.md).

## Before running checks

Inspect the active execution permissions. If the sandbox denies local socket binding, use the
available command-scoped approval mechanism for server `npm test`, web `npm run test:e2e` and web
`npm run build` on their first attempt. In the Codex execution tool used for the incident below,
this was `sandbox_permissions: "require_escalated"` with a justification explaining the local
listener requirement. That field is a tool option, not a shell argument. Honor the active approval
policy; this runbook does not grant access or require a global sandbox configuration change.

Use the affected application's working directory and mise runtime, for example
`mise exec -- npm test` from `server/`. Type checking, Biome and documentation checks can normally
remain sandboxed. This permission requirement does not authorize hosted tests or deployment.

OpenAI's [approval and sandbox documentation](https://learn.chatgpt.com/docs/agent-approvals-security)
separates command permissions from approval policy and describes restricted network access
(reviewed 2026-09-21). Exact controls depend on the active client and managed policy.

## Recognize and recover

- Server tests: `listen EPERM: operation not permitted 0.0.0.0`, often accompanied by
  `Cannot read properties of null (reading 'port')` in Supertest. Many unrelated HTTP assertions
  can fail because the test listener never started.
- Web build: `TurbopackInternalError` or a panic containing `creating new process`,
  `binding to a port` and `Operation not permitted`. A CSS filename at the top of the error does
  not establish that the stylesheet is defective.

Confirm the underlying permission error before changing code. Rerun the same failing command
with permitted socket access. If access is unavailable, report the check as blocked and complete
independent checks; do not skip assertions or treat a blocked run as a pass.

If the web production build immediately repeats the same denial after permission is granted,
wait for the previous build to exit, remove only its generated Turbopack build cache, then rerun
the ordinary build with socket access. From `web/`, for this repository's default build directory:

```bash
rm -rf .next/cache/turbopack
mise exec -- npm run build
```

Do not clear caches routinely or delete the separate `.next/dev` directory of a running developer
server. If a different build directory is selected in [Next configuration](../../web/next.config.ts),
verify the generated cache location first. A fresh failure after recovery needs its own diagnosis;
permission errors do not explain every failing assertion or build.

## Evidence and limits

During 1.0 PR preparation on 2026-09-21 at `2b61c2f`, the macOS sandbox blocked server listeners:
88 of 225 tests failed with socket errors. The same suite passed all 225 tests with socket access.
All 27 Chromium E2E tests passed with local fixture servers.

The sandboxed web build failed while processing CSS. Its first permitted rerun immediately
repeated the denial; after clearing `.next/cache/turbopack`, the same production build and Pagefind
postbuild passed without source changes. This sequence supports a cached failure as the cause of
the repeated denial; it is an observation from this checkout, not a guarantee about every Next.js
version. None of these checks exercised a production deployment or paid provider call.
