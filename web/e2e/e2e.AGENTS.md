# Frontend browser verification

[playwright.config.ts](../playwright.config.ts) owns Chromium, viewport, isolated servers and artifacts.
[auth.spec.ts](auth.spec.ts) exercises signup, confirmation, recovery, sign-out, cookies, outages and
safe redirects. [hello.spec.ts](hello.spec.ts) exercises public entry, protected access, API calls,
retry, reload and responsive themes.

[auth-provider.mjs](auth-provider.mjs) is a loopback-only auth/hello fixture on port 3101. Its test
helpers never ship in application code. Each independent flow uses fictional accounts; the real
Supabase SDK and web bridge call this fixture. Explicit test environment values override local hosted
configuration. No remote accounts are created, emails sent or AWS resources accessed.

Run `npx playwright install chromium` once, then `npm run test:e2e` under mise. The suite starts its
own Next server on port 3100 with `.next-e2e/` output; occupied ports fail rather than reuse unknown
servers. Follow the [socket runbook](../../docs/runbooks/local-socket-verification.md).
Screenshots and traces are ignored and may contain only fictional data.

Browser tests verify the frontend integration, not the backend's JWT implementation; server tests
verify real signatures independently. Screenshot review does not establish physical-device,
screen-reader or comprehensive contrast coverage. Report those checks separately.
