# Application header

[Header.tsx](Header.tsx) provides the application navigation landmark, a brand link back to `/app`,
a sign-out action, and the [theme switch](../theme/theme.AGENTS.md). It exports through [header.index.ts](header.index.ts)
and is composed by [the application layout](../../app/app/layout.tsx), not the root or blog layout.
It uses Next links and imports theme/auth through their public barrels. The layout injects the
sign-out Server Action; the [auth feature](../auth/auth.AGENTS.md) owns session and failure semantics.
There is no independent route state or mobile drawer.

The header reflows on narrow screens; primary controls retain touch-sized targets. Keep link names,
destinations and keyboard access clear. The landing page owns its separate application-entry link.

[Header.test.tsx](Header.test.tsx) checks the board destination and logical theme switching with a
mocked next-themes boundary. [Browser tests](../../../e2e/job-search.spec.ts) exercise the actual
Emerald/Forest mapping. Follow the full [web gate](../../../AGENTS.md) and manual UI verification rules.
