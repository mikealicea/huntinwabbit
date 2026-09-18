# Search board

## Purpose and visible behavior

The [auth boundary](../auth/auth.AGENTS.md) protects the route before rendering sample data.
The board at `/app` makes the overall search understandable at a glance. It shows all stages,
including empty ones, and derives active/closed totals from the session state. Cards expose posting
and workflow context with unavailable facts labeled honestly. The board reflows from six columns to
three to stacked stages; it is not a separate mobile router or duplicated data view.

## Owners and seams

- [SearchBoard.container.tsx](SearchBoard.container.tsx) selects totals and coordinates capture,
  columns, drag completion and live feedback. [SearchBoard.component.tsx](SearchBoard.component.tsx)
  renders the summary, empty state, capture/column slots and drag-preview presentation.
- [BoardColumn.container.tsx](BoardColumn.container.tsx) owns the stage subscription and drop target;
  [BoardColumn.component.tsx](BoardColumn.component.tsx) accepts count, drop state/ref and card children.
- [RoleCard.container.tsx](RoleCard.container.tsx) resolves company/date context and drag mechanics;
  [RoleCard.component.tsx](RoleCard.component.tsx) renders supplied data and distinct link/handle refs.
- [search-board.index.ts](search-board.index.ts) exports the board container. Data and pure helpers
  come through [job-search.index.ts](../job-search/job-search.index.ts). Components do not connect
  Redux or dnd-kit and never import their child containers.

`@dnd-kit/react` and its DOM accessibility adapter are confined to this feature.
[search-board.drag.ts](search-board.drag.ts) replaces vendor announcements with role and stage labels
while retaining keyboard instructions. A valid drop dispatches the generated application-update action with only a stage change; cancellation
and drops without a stage do not change data. Changes happen at drop, not during hover. Card order
follows the opportunity collection; there is no within-stage reordering. Focus returns to the moved
role's handle. The workspace stage selector is an alternative to dragging.

There is no filtering, search, archive deletion, persistence or network loading. Submitted records,
interest and priority are unaffected by movement, including movement backward in the process.

## Verification

[SearchBoard.test.tsx](SearchBoard.test.tsx) covers cards, counts, empty stages and an empty search
with a real store. [Presentation tests](search-board.presentation.test.tsx) exercise standalone
props, refs, missing details and composition slots without providers.
The [capture integration tests](../job-capture/JobCapture.test.tsx) exercise updates through the real
Redux provider. jsdom uses a no-layout ResizeObserver adapter; it cannot establish working drag geometry.
[Playwright tests](../../../e2e/job-search.spec.ts) exercise populated/empty targets, keyboard moves,
emulated touch, cancellation and outside drops. Run the full [web gate](../../../AGENTS.md), browser tests and manual accessibility
checks when changing layout, dragging or focus. Check both themes and responsive layouts.
