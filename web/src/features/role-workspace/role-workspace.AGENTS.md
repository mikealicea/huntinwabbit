# Saved role workspace

The workspace loads a saved role directly by ID, so bookmarks survive navigation and reload.
[Container](RoleWorkspace.container.tsx) selects loading, unavailable, ownership-safe 404 and available
views using the [API feature](../job-api/job-api.AGENTS.md). It polls pending extraction and chat updates while
focused and wires persistent application changes into [presentation](RoleWorkspace.component.tsx).

Stage, interest, priority and follow-up persist independently. Controls show pending state and prevent
competing tracking writes. Notes use an independent comment timeline, described below. Leaving the page
can discard unsaved comment drafts. Extraction only updates generated facts and never overwrites tracking.

[JobDetails](JobDetails.component.tsx) groups all locations, employment type, salary and work arrangement
in a wrapping overview. Requirements (with distinct preferred qualifications), Tech stack, Responsibilities
and Full job details follow in that order. Benefits, all compensation bands and posting metadata remain
available below. Missing facts remain unknown; older records without technology extraction offer refresh.
Technology labels preserve stated required/preferred distinctions.
[PostingDescription](PostingDescription.component.tsx) delegates to shared SafeMarkdown to render Markdown with nested headings, paragraphs
and lists, retaining plain-text line breaks. HTML stays inert text; images never load, and description
links allow only credential-free HTTP(S) destinations. No raw HTML or MDX evaluation is used. Queued/processing/failed/disabled states distinguish extraction
from link persistence; terminal failure offers an explicit retry. Completed postings offer refresh of
the saved URL. Existing facts remain visible during refresh and after failure; success replaces generated facts while preserving user overrides.
Unsaved comment drafts survive refresh. Pending requests cannot submit another extraction.

[RoleStatus](RoleStatus.component.tsx) places network and extraction feedback beside the stage badge
in the role header. It uses the shared [RequestStatus](../../shared/RequestStatus.component.tsx)
marker also used by the board: busy spinner, error X, completed check or a neutral information icon
when extraction is unavailable or has not completed. Its popover contains request recovery,
extraction progress/failure, correction-preservation and changed-source messages previously shown
with posting details. Status is announced without moving the page layout. Keyboard activation,
Escape with focus restoration, outside clicks and focus leaving control the popover.
Initial loading or unavailable-role errors still use the standalone request feedback.
Reduced-motion preferences disable the spinner and loading pulse.

[PostingActions](PostingActions.component.tsx) groups extraction/refresh/retry and deletion in a
daisyUI details dropdown beside the stage badge. The feature exports this presentation contract
for board cards, whose containers supply their own mutations and compact menu placement. The three-dot trigger is labeled Posting actions.
Escape, outside clicks, focus leaving and action selection close the dropdown. Extraction progress
remains available in the header status popover while the menu is closed; pending work disables repeat submissions.

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
Uploads and submissions remain unavailable; company comments belong to the company workspace.

## Update role chat

[UpdateRoleContainer](UpdateRole.container.tsx) connects durable history, submission and Undo through
RTK Query. [UpdateRole](UpdateRole.component.tsx) renders typed props and owns only composer/dialog
state. Desktop shows the chat above secondary sections; mobile opens a native full-screen dialog.
Enter inserts a newline; Cmd+Enter sends using the same availability checks as the Send button.
Composition and held-key repeats do not submit. The composer appears above Update history,
which starts collapsed and can be expanded with its keyboard-accessible toggle. Status and errors
remain visible while history is collapsed. Closing the mobile dialog restores focus. Processing never owns the server
job lifetime. The composer remains editable while another update runs, but sending is disabled.

Messages and change receipts persist with the role. Clear portions apply immediately; skipped or
ambiguous portions are reported without questions. Undo cannot replace later edits. Failures preserve
local drafts, with an explicit retry for a saved failed operation. Ambiguous submission failures reuse
the operation ID while the text is unchanged; history refresh recovers an accepted request. Chat
history is paginated, polls pending operations, and refreshes role/board caches on settlement.

Source-derived facts resolve through saved overrides, including empty values. Posting and tracking fields are supported, including fields shown in the detailed posting section;
notes and comments must be entered through the Notes composer. Chat does not create
unimplemented tasks or material records. Company-name corrections can reassign this role to an existing
or new company; they do not edit shared research. Pasted text is processed by Redpill;
links are values, not fetching instructions. Comment drafts remain local and survive chat updates. Chat does not read or modify the comment timeline.

[Chat tests](UpdateRole.test.tsx) exercise props and a fresh real store. Browser tests cover desktop
and mobile, both themes, persisted history, partial updates, retry, refresh precedence and Undo.

Company headings link to the associated company page, with an adjacent pencil to change the association.
The connected Change company slot is owned
by [company workspace](../company-workspace/company-workspace.AGENTS.md); selecting, creating or clearing
an association leaves role history and original extracted company facts intact. The association
revision protects corrections from stale chat results and Undo.
## Notes timeline

[RoleNotesContainer](RoleNotes.container.tsx) owns paginated RTK Query reads and direct mutations;
[RoleNotes](RoleNotes.component.tsx) exports the shared Notes presentation, which composes the notepad, status and newest-first entries.
[NoteComposer](../../shared/NoteComposer.component.tsx) provides Write/Preview using the shared safe Markdown
renderer. Enter inserts a newline; Cmd+Enter submits a comment or saves an inline edit, using the
same availability checks as the submit button. Composition and held-key repeats do not submit.
The composer clears only on
acknowledged success and preserves text typed while the submitted snapshot was saving. Comments
are private to the authenticated role owner, without replies or attachments. The composer saves
directly; separately enabled [company analysis](../company-workspace/company-workspace.AGENTS.md)
uses saved comments as personal context.

[NoteEntry](../../shared/NoteEntry.component.tsx) owns inline edits and a deletion confirmation with initial Cancel
focus. Cancel restores the action focus; successful deletion returns focus to the composer. Edits
show an Edited indicator. A conflict retains the draft, displays the current saved comment and
requires review before resubmission; deletion conflicts require canceling and reconfirming. If an
entry disappears remotely or leaves the loaded pages, its active edit remains available for copying
into a new comment rather than being silently discarded.
Failures do not hide unrelated role content. Older-page failures preserve loaded comments.

Create retries reuse the ID while the submitted body is unchanged. No automatic write retries or
browser persistence are added. Background refreshes preserve drafts; navigation/reload may discard
them. Legacy single-field notes are retained in storage for compatibility but not displayed or migrated.
[Notes tests](RoleNotes.test.tsx) exercise real stores, acknowledgements, conflicts and pagination;
browser tests cover Markdown, reload, edit/delete, keyboard focus and both responsive themes.

## Retained page text

Posting actions opens the [source editor](SourceText.component.tsx), coordinated by
[SourceTextContainer](SourceText.container.tsx). It loads retained text only when opened and keeps
local edits through recoverable failures and dismissal while mounted. Save and refresh replaces
retained text; Remove text and refresh clears it. Both are explicit source changes, with version
checks and stable operation IDs on unchanged retries. Conflicts retain the draft and require explicit
review of the current version. Active extraction disables competing submissions; closing the dialog
never cancels accepted backend work. Native dialog dismissal restores focus to Posting actions.

Ordinary refresh reuses retained text. A previous-URL source is visibly identified and must be
replaced or removed before reuse. Source changes do not reset manual corrections or previous facts.
The status popover distinguishes pasted-source extraction and unavailable/unusable fetched pages.
Source text is separate from role-update chat and comments; editing it never writes either timeline.
The source editor and Chromium capture/refresh scenarios cover retention, retry IDs, conflict review,
removal, responsive layouts and focus. No live inference fidelity is established by these fixtures.
