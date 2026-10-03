# Role interview process

A role in Interviewing has one card moving through its own named stages. The board appears below
Stage/Interest/Priority and above Job details. Leaving Interviewing hides it without deleting the
process. The main search card displays its current interview stage. Preparation tasks, schedules and completion history are not implemented; moving forward or backward only selects a stage.

[Container](InterviewProcess.container.tsx) coordinates the existing versioned posting mutation,
focused update submission and drag adapter. [Presentation](InterviewProcess.component.tsx) renders
props and slots. [Setup](InterviewSetup.component.tsx) owns unsaved manual/transcript drafts in a
native dialog. The API cache owns saved state; there is no additional product store. Parent composition
mounts this feature through a role-workspace slot. Public imports use [index](interview-process.index.ts).

The empty state offers transcript or manual setup. Columns have stable IDs; renaming or reordering
does not change identity. An unknown current position leaves the card in a distinct unassigned area.
A selector provides an alternative to dragging. Cancelled, outside and same-column drops do not write.
Removing the selected stage requires explicitly choosing another position or leaving it unassigned.
Removing all stages and clearing the selection returns to setup. The dialog captures the application
version it opened with, preventing newer edits from being overwritten by a stale draft.

Transcript setup uses the existing durable Update role job with interview-only intent. Clear results
save automatically; the existing Update history shows the transcript, readable changes, retry and
Undo. Pending work survives navigation. Submission acknowledgement retries reuse the same operation ID
and text. Notes are not an extraction trigger. [Processor boundary](../../../../docs/role-updates-data-boundary.md)
owns retention and provider disclosure. [Backend barrel](../../../../server/src/features/job-postings/job-postings.AGENTS.md)
owns validation, stable model references, concurrency and cleanup; schemas own exact limits.

Busy controls suppress competing writes. Failed moves retain server state; stale edits require review.
A later process edit or card move blocks Undo of an earlier AI process edit. Horizontal scrolling stays
within the board on narrow screens, with the selected column brought into view. Dialog dismissal and
card moves restore focus; drag status announcements complement the labeled movement selector.

[Tests](InterviewProcess.test.tsx) exercise the manual editor, full text bounds, real-store persistence
and conflict feedback. [Browser tests](../../../e2e/interview-process.spec.ts) cover placement, transcript
setup, moves, cancellation, reloads, role-stage preservation and both themes at desktop/mobile widths.
Run web, state, architecture, browser and documentation gates. Browser fixtures use synthetic transcripts
and deterministic inference; no provider requests or hosted data are used.

## Step context and comments

Each column heading opens [InterviewStage](InterviewStage.component.tsx), a native dialog with its
saved Markdown stage details and the role's comment timeline filtered to that stable stage ID. Opening
any step does not move the current card. Role-workspace composition supplies the connected notes slot;
this feature never duplicates comments or imports role-workspace containers. Dialogs restore the opener
on Close/Escape, falling back to setup if a background process edit removed the column. A removed-step
message keeps mounted drafts available for copying; closing discards unsaved drafts as disclosed.

Optional stage context holds stated interview format, duration, people, topics and preparation details.
Transcript setup and later Update role messages can populate it through the existing AI update and Undo
flow. Omitted context is preserved during normalization, and manual rename/reorder retains it. Context
is rendered by SafeMarkdown; it does not execute HTML or fetch embedded images. Older stages have no
context until explicitly updated; no automatic transcript replay or backfill occurs.

Step comments use the same role note rows and revisions as the main Notes section. Saves and edits
invalidate both views. Removing a stage never deletes its comments; the main timeline labels their link
as a removed step and permits reassignment or clearing. Undo of process changes does not undo comments.
Stage query pagination may have no matching entries on a page but still offer older comments.
Browser scenarios cover details, creation from both views, editing, reload, Escape/focus, mobile, zoom
and both themes. Unit/server tests cover removed-stage drafts, stable links, revisions, replay, bounded
pagination and process Undo without comment loss. Screen-reader verification remains separate.
