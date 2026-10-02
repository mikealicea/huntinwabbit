# Role interview process

A role in Interviewing has one card moving through its own named stages. The board appears below
Stage/Interest/Priority and above Job details. Leaving Interviewing hides it without deleting the
process. The main search card displays its current interview stage. Preparation, schedules, stage
notes and completion history are not implemented; moving forward or backward only selects a stage.

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
