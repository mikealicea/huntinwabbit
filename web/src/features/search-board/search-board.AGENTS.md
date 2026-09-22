# Live search board

The authenticated board shows the user's saved roles in six stages. [SearchBoard.container.tsx](SearchBoard.container.tsx)
loads all API pages sequentially, keeps partial results on failure, and labels incomplete counts.
An API failure never becomes a successful empty search. [Presentation](SearchBoard.component.tsx)
receives counts, completeness and connected slots. A fixed-size [status marker](BoardStatus.component.tsx), using shared
[RequestStatus](../../shared/RequestStatus.component.tsx),
sits at the far right above the move instructions: a green check when board requests are idle,
a motion-aware spinner while loading pages, refreshing or saving a stage, and an X after a failed
request. Error details and existing retry/sign-in actions open in an overlay, with keyboard activation,
Escape and outside dismissal. These states reserve the same header space rather than inserting
messages above the board. Background refresh retains complete cached counts and the empty-board
message; partial or failed lists remain labeled incomplete. The marker describes board requests;
card extraction and capture feedback remain with their owning controls.

[Column containers](BoardColumn.container.tsx) receive mapped roles and coordinate drop targets.
[Board card containers](RoleCard.container.tsx) own drag mechanics.
[Reusable connected cards](SavedRoleCard.container.tsx) own clock context, posting actions and pending
extraction polling for both board and company pages. [Card presentation](RoleCard.component.tsx) receives typed props. API data belongs to the
[RTK Query cache](../job-api/job-api.AGENTS.md), not a second board slice.

Valid drops persist stage changes with the current application version. Interest, priority and notes
are unaffected. Competing writes are suppressed while pending; failures display feedback and preserve
the server's state. The workspace stage selector remains the keyboard/control alternative. Focus
returns to the moved handle after refresh. Cancellation/outside drops do not write. Card order follows
the backend's newest-saved order; there is no within-stage sorting or filtering.

Queued/processing cards show a labeled pulsing extraction indicator, including refreshes with
existing facts. Stage saves use the header status spinner. Reduced motion keeps the cue static.
Pending cards also breathe with a theme-colored border and soft glow using Tailwind pseudo-element
utilities in card presentation. Only the decorative halo changes opacity; content, focus and drag
geometry stay steady. Reduced motion keeps a static halo. Terminal states remove it.

Tests use real stores and deterministic HTTP boundaries. Browser tests exercise pointer, keyboard,
emulated touch, cancellation, populated/empty columns, mobile reflow and both themes. Run web,
state, architecture, browser and documentation gates. Browser regression tests measure heading,
capture and column positions across loading, error, retry and stage-save transitions, and exercise
the error popover at desktop/mobile sizes.
Browser automation is not a screen-reader audit.

Cards expose the shared [PostingActions](../role-workspace/PostingActions.component.tsx) dropdown
immediately left of the move handle. Refresh/retry keeps existing facts visible and polls accepted extraction;
request failures remain visible on the card. The menu fits the card width and raises the open card
above neighbors. Actions use independent controls rather than the navigation link or drag handle.
Card containers send mutations through the existing API cache. Pending requests disable the move
handle and competing actions; stage writes disable card actions. Delete uses the same permanent
confirmation as role details, retains the card on failure, and refreshes conflicting versions for
review before reconfirmation. Acknowledged deletion removes the card. The surviving board container focuses its heading after
the card and native modal have unmounted; the removed card does not own the focus timer.
Browser coverage exercises in-place refresh/retry, confirmation cancellation, deletion/reload, keyboard
menu controls and narrow-card/mobile menus in both themes alongside existing drag tests.

Company names link to saved company IDs when assigned. Company-page cards reuse presentation and
actions while showing stage labels and omitting board dragging. The company page owns deletion focus.
