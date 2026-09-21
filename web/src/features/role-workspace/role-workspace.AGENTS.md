# Saved role workspace

The workspace loads a saved role directly by ID, so bookmarks survive navigation and reload.
[Container](RoleWorkspace.container.tsx) selects loading, unavailable, ownership-safe 404 and available
views using the [API feature](../job-api/job-api.AGENTS.md). It polls pending extraction and chat updates while
focused and wires persistent application changes into [presentation](RoleWorkspace.component.tsx).

Stage, interest, priority and follow-up persist independently. Controls show pending state and prevent
competing writes. Notes remain a local draft until Save notes succeeds; failure/conflict preserves
that draft. A conflict refreshes server data and requires deliberate resubmission. Leaving the page
can discard unsaved notes. Extraction only updates generated facts and never overwrites tracking.

[JobDetails](JobDetails.component.tsx) displays all supplied locations, requirements, responsibilities,
preferred qualifications, benefits and compensation bands. Source text renders as text, never injected
HTML. Missing facts remain unknown. Queued/processing/failed/disabled states distinguish extraction
from link persistence; terminal failure offers an explicit retry. Completed postings offer refresh of
the saved URL. Existing facts remain visible during refresh and after failure; success replaces generated facts while preserving user overrides.
Unsaved note drafts survive refresh. Pending requests cannot submit another extraction.

Refresh/extraction, saves and deletion show the shared pulsing activity cue while pending.
Loading text stays readable and reduced-motion preferences disable the pulse.

[PostingActions](PostingActions.component.tsx) groups extraction/refresh/retry and deletion in a
daisyUI details dropdown beside the stage badge. The feature exports this presentation contract
for board cards, whose containers supply their own mutations and compact menu placement. The three-dot trigger is labeled Posting actions.
Escape, outside clicks, focus leaving and action selection close the dropdown. Extraction progress
remains visible in Job details while the menu is closed; pending work disables repeat submissions.

[DeletePosting](DeletePosting.component.tsx) owns the native confirmation dialog, initial Cancel focus,
Tab containment and Escape dismissal. The dialog mounts outside the dropdown; closing it restores
focus to the three-dot trigger. Confirmation captures the reviewed application version. The container
sends deletion and returns to the board only after acknowledgement.
Failures keep the dialog open; conflicts refresh data and require closing/reviewing/reconfirming.
Pending deletion disables competing edits and dismissal until the bounded request settles. There is
no trash or undo; the confirmation explicitly includes notes and tracking choices. Accepted deletion
removes board cache entries and invalidates details. Saving the same URL later creates a new posting.

[Unavailable sections](UnavailableSection.component.tsx) identify unfinished materials and company
research. Live roles contain no fictional tasks, contacts, resumes or submitted records. Legacy
materials/company presentation components are retained only for isolated contract tests, without
connected controls in the live workspace. [RoleNotFound](RoleNotFound.component.tsx) offers a board link.

Tests cover persistent choices/notes, conflicts, reloads and missing roles with real stores and fake
HTTP. Browser tests exercise direct routes, follow-ups, themes and responsive layout. Run web,
state, auth, architecture, browser and documentation gates. Refresh/retry and deletion browser tests
cover draft retention, reload, keyboard menu dismissal/focus and mobile menus/dialogs in both themes.
No upload, submission or shared-company editing capability is claimed.

## Update role chat

[UpdateRoleContainer](UpdateRole.container.tsx) connects durable history, submission and Undo through
RTK Query. [UpdateRole](UpdateRole.component.tsx) renders typed props and owns only composer/dialog
state. Desktop shows the chat above secondary sections; mobile opens a native full-screen dialog.
Enter sends, Shift+Enter adds a newline, and closing restores focus. Processing never owns the server
job lifetime. The composer remains editable while another update runs, but sending is disabled.

Messages and change receipts persist with the role. Clear portions apply immediately; skipped or
ambiguous portions are reported without questions. Undo cannot replace later edits. Failures preserve
local drafts, with an explicit retry for a saved failed operation. Ambiguous submission failures reuse
the operation ID while the text is unchanged; history refresh recovers an accepted request. Chat
history is paginated, polls pending operations, and refreshes role/board caches on settlement.

Source-derived facts resolve through saved overrides, including empty values. All persisted role
fields are supported, including fields shown in the detailed posting section. Chat does not create
unimplemented tasks, material records or shared company profiles. Pasted text is processed by Redpill;
links are values, not fetching instructions. Unsaved notes remain local and survive chat updates;
users must review their draft before saving over a newly changed server note.

[Chat tests](UpdateRole.test.tsx) exercise props and a fresh real store. Browser tests cover desktop
and mobile, both themes, persisted history, partial updates, retry, refresh precedence and Undo.
