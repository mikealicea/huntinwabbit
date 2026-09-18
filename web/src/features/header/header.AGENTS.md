# Application header

[Header.tsx](Header.tsx) provides the application navigation landmark, a brand link back to `/app`,
and the [theme switch](../theme/theme.AGENTS.md). It exports through [header.index.ts](header.index.ts)
and is composed by [the application layout](../../app/app/layout.tsx), not the root or blog layout.
It uses Next links and imports the theme feature through its public barrel. There is no independent
route state, network work, mobile drawer or authenticated menu.

The header reflows on narrow screens; primary controls retain touch-sized targets. Keep link names,
destinations and keyboard access clear. The landing page owns its separate application-entry link.

[Header.test.tsx](Header.test.tsx) checks the board destination and logical theme switching with a
mocked next-themes boundary. [Browser tests](../../../e2e/job-search.spec.ts) exercise the actual
Emerald/Forest mapping. Follow the full [web gate](../../../AGENTS.md) and manual UI verification rules.
