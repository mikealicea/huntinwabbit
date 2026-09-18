# Landing entry

[HomePage.tsx](HomePage.tsx) renders the reserved landing page at `/` with one visible control:
a top-right Open app link to `/app`. A screen-reader heading identifies the page. It does not mount
the application shell or session provider, show sample cards, or implement marketing content.

[home.index.ts](home.index.ts) exports the component composed by [the root page](../../app/page.tsx).
It has no state or requests. [HomePage.test.tsx](HomePage.test.tsx) verifies the entry destination and
single-link boundary; [browser tests](../../../e2e/job-search.spec.ts) exercise navigation into the
application. Run the full gate in the [web guide](../../../AGENTS.md).
