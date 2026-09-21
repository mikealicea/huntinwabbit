# Saved role workspace

The workspace loads a saved role directly by ID, so bookmarks survive navigation and reload.
[Container](RoleWorkspace.container.tsx) selects loading, unavailable, ownership-safe 404 and available
views using the [API feature](../job-api/job-api.AGENTS.md). It polls only pending extraction while
focused and wires persistent application changes into [presentation](RoleWorkspace.component.tsx).

Stage, interest, priority and follow-up persist independently. Controls show pending state and prevent
competing writes. Notes remain a local draft until Save notes succeeds; failure/conflict preserves
that draft. A conflict refreshes server data and requires deliberate resubmission. Leaving the page
can discard unsaved notes. Extraction only updates generated facts and never overwrites tracking.

[JobDetails](JobDetails.component.tsx) displays all supplied locations, requirements, responsibilities,
preferred qualifications, benefits and compensation bands. Source text renders as text, never injected
HTML. Missing facts remain unknown. Queued/processing/failed/disabled states distinguish extraction
from link persistence; terminal failure offers an explicit retry. Completed postings offer refresh of
the saved URL. Existing facts remain visible during refresh and after failure; success replaces them.
Unsaved note drafts survive refresh. Pending requests cannot submit another extraction.

Refresh/extraction, saves and deletion show the shared pulsing activity cue while pending.
Loading text stays readable and reduced-motion preferences disable the pulse.

[DeletePosting](DeletePosting.component.tsx) owns the native confirmation dialog, initial Cancel focus,
Tab containment, Escape dismissal and opener focus restoration. Confirmation captures the reviewed
application version. The container sends deletion and returns to the board only after acknowledgement.
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
cover draft retention, reload, keyboard focus and mobile dialogs in both themes. No upload, submission or
company-editing capability is claimed.
