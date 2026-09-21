# Shared header

[Header.container.tsx](Header.container.tsx) assembles an action control and [theme](../theme/theme.AGENTS.md)
controls as slots for [Header.component.tsx](Header.component.tsx), which renders the navigation
landmark and brand link back to `/app`. It exports through [header.index.ts](header.index.ts)
and is composed by [the application layout](../../app/app/layout.tsx) and
[the home page](../../app/page.tsx), not the root or blog layout.
It uses Next links and imports theme/auth through their public barrels. The application layout injects the
sign-out Server Action; without that action, the header shows an Open app link to `/app`.
The public header does not load a session or expose sign-out; the [auth feature](../auth/auth.AGENTS.md) owns session and failure semantics.
There is no independent route state or mobile drawer.

The brand link pairs the optimized rabbit artwork with visible text. The image is decorative
so the link retains a single accessible name. [Brand assets](../../../../assets/assets.AGENTS.md)
owns the source artwork and export procedure.

The header reflows on narrow screens; primary controls retain touch-sized targets. Keep link names,
destinations and keyboard access clear. Both surfaces share the same navigation layout.

[Presentation tests](header.presentation.test.tsx) render slots without service providers.
[Header.test.tsx](Header.test.tsx) checks the board destination and logical theme switching with a
mocked next-themes boundary. [Browser tests](../../../e2e/job-search.spec.ts) exercise the actual
Emerald/Forest mapping. Follow the full [web gate](../../../AGENTS.md) and manual UI verification rules.
