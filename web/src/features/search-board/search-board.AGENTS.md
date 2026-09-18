# Search board

## Purpose and visible behavior

The [auth boundary](../auth/auth.AGENTS.md) protects the route before rendering sample data.
The board at `/app` makes the overall search understandable at a glance. It shows all stages,
including empty ones, and derives active/closed totals from the session state. Cards expose posting
and workflow context with unavailable facts labeled honestly. The board reflows from six columns to
three to stacked stages; it is not a separate mobile router or duplicated data view.

## Owners and seams

- [SearchBoard.tsx](SearchBoard.tsx) composes capture, columns, drag handling and live feedback.
- [BoardColumn.tsx](BoardColumn.tsx) owns each stage's drop target, count and empty state.
- [RoleCard.tsx](RoleCard.tsx) presents role context and separates its navigation link from its drag
  handle. Links use the framework route system; handles support pointer, touch and keyboard input.
- [search-board.index.ts](search-board.index.ts) is the public export. Data and presentation rules
  come through [job-search.index.ts](../job-search/job-search.index.ts).

`@dnd-kit/react` and its DOM accessibility adapter are confined to this feature.
[search-board.drag.ts](search-board.drag.ts) replaces vendor announcements with role and stage labels
while retaining keyboard instructions. A valid drop dispatches only a stage update; cancellation
and drops without a stage do not change data. Changes happen at drop, not during hover. Card order
follows the opportunity collection; there is no within-stage reordering. Focus returns to the moved
role's handle. The workspace stage selector is an alternative to dragging.

There is no filtering, search, archive deletion, persistence or network loading. Submitted records,
interest and priority are unaffected by movement, including movement backward in the process.

## Verification

[SearchBoard.test.tsx](SearchBoard.test.tsx) covers cards, counts, empty stages and an empty search.
The [capture integration tests](../job-capture/JobCapture.test.tsx) exercise updates through the real
provider. jsdom uses a no-layout ResizeObserver adapter; it cannot establish working drag geometry.
[Playwright tests](../../../e2e/job-search.spec.ts) exercise populated/empty targets, keyboard moves,
emulated touch, cancellation and outside drops. Run the full [web gate](../../../AGENTS.md), browser tests and manual accessibility
checks when changing layout, dragging or focus. Check both themes and responsive layouts.
