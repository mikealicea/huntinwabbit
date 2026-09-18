# Header and navigation

[Header.tsx](Header.tsx) provides the primary navigation landmark with Home and Blog links and the
[theme switch](../theme/theme.AGENTS.md). It exports through [header.index.ts](header.index.ts) and
is composed once in [the root layout](../../app/layout.tsx). It uses Next links and imports the
theme feature through its public barrel. It has no independent route state or network work.

Keep link names, destinations and keyboard access clear. Do not create a second theme owner in the
header. There is no mobile drawer, active-route indicator or authenticated menu implemented yet;
new navigation behavior must define focus, dismissal and responsive states when introduced.

[Header.test.tsx](Header.test.tsx) checks link destinations and light-to-dark switching with a mocked
`next-themes` boundary. It does not test browser persistence, hydration or both real CSS themes.
Use the full gate and UI verification rules in the [web guide](../../../AGENTS.md).
