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
the backend's newest-saved order; there is no within-stage sorting, filtering or deletion.

Queued/processing cards show a labeled pulsing extraction indicator, including refreshes with
existing facts. Stage saves also show the shared activity cue. Reduced motion keeps the cue static.
Pending cards also breathe with a theme-colored border and soft glow using Tailwind pseudo-element
utilities in card presentation. Only the decorative halo changes opacity; content, focus and drag
geometry stay steady. Reduced motion keeps a static halo. Terminal states remove it.

Tests use real stores and deterministic HTTP boundaries. Browser tests exercise pointer, keyboard,
emulated touch, cancellation, populated/empty columns, mobile reflow and both themes. Run web,
state, architecture, browser and documentation gates. Browser automation is not a screen-reader audit.
