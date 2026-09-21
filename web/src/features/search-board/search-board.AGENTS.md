# Live search board

The authenticated board shows the user's saved roles in six stages. [SearchBoard.container.tsx](SearchBoard.container.tsx)
loads all API pages sequentially, keeps partial results on failure, and labels incomplete counts.
An API failure never becomes a successful empty search. [Presentation](SearchBoard.component.tsx)
receives counts, completeness and connected slots.

[Column containers](BoardColumn.container.tsx) receive mapped roles and coordinate drop targets.
[Card containers](RoleCard.container.tsx) own drag mechanics, clock context and polling for pending
extraction. [Card presentation](RoleCard.component.tsx) receives typed props. API data belongs to the
[RTK Query cache](../job-api/job-api.AGENTS.md), not a second board slice.

Valid drops persist stage changes with the current application version. Interest, priority and notes
are unaffected. Competing writes are suppressed while pending; failures display feedback and preserve
the server's state. The workspace stage selector remains the keyboard/control alternative. Focus
returns to the moved handle after refresh. Cancellation/outside drops do not write. Card order follows
the backend's newest-saved order; there is no within-stage sorting or filtering.

Queued/processing cards show a labeled pulsing extraction indicator, including refreshes with
existing facts. Stage saves also show the shared activity cue. Reduced motion keeps the cue static.
Pending cards also breathe with a theme-colored border and soft glow using Tailwind pseudo-element
utilities in card presentation. Only the decorative halo changes opacity; content, focus and drag
geometry stay steady. Reduced motion keeps a static halo. Terminal states remove it.

Tests use real stores and deterministic HTTP boundaries. Browser tests exercise pointer, keyboard,
emulated touch, cancellation, populated/empty columns, mobile reflow and both themes. Run web,
state, architecture, browser and documentation gates. Browser automation is not a screen-reader audit.

Cards expose the shared [PostingActions](../role-workspace/PostingActions.component.tsx) dropdown
immediately left of the move handle. Refresh/retry keeps existing facts visible and polls accepted extraction;
request failures remain visible on the card. The menu fits the card width and raises the open card
above neighbors. Actions use independent controls rather than the navigation link or drag handle.
Card containers send mutations through the existing API cache. Pending requests disable the move
handle and competing actions; stage writes disable card actions. Delete uses the same permanent
confirmation as role details, retains the card on failure, and refreshes conflicting versions for
review before reconfirmation. Acknowledged deletion removes the card and focuses the board heading.
Browser coverage exercises in-place refresh/retry, confirmation cancellation, deletion/reload, keyboard
menu controls and narrow-card/mobile menus in both themes alongside existing drag tests.
