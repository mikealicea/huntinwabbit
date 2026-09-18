# Landing entry

[The root page](../../app/page.tsx) composes the shared [header](../header/header.AGENTS.md)
above [HomePage.component.tsx](HomePage.component.tsx) at `/`. The header provides the brand,
theme switch and Open app link to `/app`. The reserved landing content retains a screen-reader
heading and fills the remaining viewport without forcing an extra screen of scroll.
It does not mount the application shell or session provider, show sample cards, or implement
marketing content. Opening the app still passes through the protected workspace route.

[home.index.ts](home.index.ts) exports the presentation component. It has no state or requests.
[HomePage.test.tsx](HomePage.test.tsx) verifies the composed navigation, entry destination and
absence of sign-out; [browser tests](../../../e2e/job-search.spec.ts) exercise navigation into the
application. Run the full gate in the [web guide](../../../AGENTS.md).
