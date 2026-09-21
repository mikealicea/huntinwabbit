# Landing entry

[The root page](../../app/page.tsx) composes the shared [header](../header/header.AGENTS.md)
above [HomePage.component.tsx](HomePage.component.tsx) at `/`. The header provides the brand,
theme switch and Open app link to `/app`. The public content offers login and signup links and a short explanation of the demo.
It does not mount the private application provider or load a session. Opening the app passes
through the protected application layout.

[home.index.ts](home.index.ts) exports the presentation component. It has no state or requests.
[HomePage.test.tsx](HomePage.test.tsx) verifies the composed navigation, entry destination and
absence of sign-out; [browser tests](../../../e2e/hello.spec.ts) exercise navigation into the
application. Run the full gate in the [web guide](../../../AGENTS.md).
