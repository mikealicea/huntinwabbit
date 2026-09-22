# Company workspace

A company page shows all of the signed-in user's roles at one saved company, including Closed,
newest first. Company names on the board and role workspace link to stable company IDs. Unknown
companies have no fabricated link. Company comments, other research, contacts, interview processes,
merging, renaming and a directory are outside this feature.

[Page container](CompanyWorkspace.container.tsx) reads company details and paginated roles through
[the API cache](../job-api/job-api.AGENTS.md). It loads every page, preserves earlier results on failure,
and labels incomplete counts. Direct routes work without previously visiting the board. Missing,
empty and unavailable states are distinct. Pending extraction/chat causes focused polling; mutations
invalidate the shared cache. No duplicate mutable role collection or persistent browser cache exists.
[Presentation](CompanyWorkspace.component.tsx) receives typed props and connected card slots.

[Shared connected cards](../search-board/SavedRoleCard.container.tsx) provide refresh/retry, deletion
confirmation and error feedback; company cards show stage labels and omit drag controls. Acknowledged
deletion removes cached membership and focuses the surviving company heading. The company persists
when its last role leaves. Opening a role uses its existing workspace.

[Picker container](ChangeCompany.container.tsx) opens from a pencil beside the role's company name,
with the accessible label Change company. It loads searchable companies and sends versioned
selection, create-and-select or clear mutations. [Dialog](ChangeCompany.component.tsx) owns only local
form state. A conflict retains input, refreshes the role, and requires closing/reviewing/reopening
before another save. Accepted manual choices survive refreshes. Native modal behavior owns focus
containment; closing restores the trigger. Request failure never becomes a successful selection.

[Tests](company-workspace.test.tsx) use real stores and fake HTTP, plus presentation tests for form
callbacks. [Browser tests](../../../e2e/companies.spec.ts) cover routing, correction, reload, multiple
roles, actions, focus and mobile/theme layouts. Run web gates, state/auth coverage, architecture,
browser and root documentation checks. Screenshots are review artifacts, not an accessibility audit.

## Shared requirements and technologies

[Analysis container](CompanyAnalysis.container.tsx) subscribes to the API cache, polls focused pending
work and retains the refresh operation ID across uncertain acknowledgements. The API cache lifecycle
initializes an existing company once; the backend owns the durable work. [Presentation](CompanyAnalysis.component.tsx)
shows generated requirements/technologies, distinct supporting-role counts, evidence links and
employer/personal/historical attribution. Single usable roles are clearly labeled previews. Empty,
disabled, pending, stale, failed and paginated results leave role cards available. A failed first
analysis reports unavailable results rather than claiming no commonalities were found. Before the
first analysis starts, empty finding sections remain pending. Native details own
local evidence disclosure and no background result moves focus.

Results cannot be edited directly. All saved role context, including comments and history, can reach
Redpill for this feature; see the [data boundary](../../../../docs/company-analysis-data-boundary.md).
[Analysis tests](CompanyAnalysis.test.tsx) exercise presentation contracts and real-store refresh/retry.
Browser company tests cover initialization, evidence, refresh, reload and mobile themes. Offline
fixtures do not establish model quality or deployed scheduling.

[Header status](CompanyAnalysisStatus.component.tsx) uses the shared request indicator at the far right
of the company heading, with visible scheduled/running/current/unavailable labels and details. The
same analysis container supplies both header and results slots, so requests have one owner. Analyze
now reuses the refresh command to bypass the quiet period; it is disabled while requesting/running
or when analysis is disabled. Completed results offer Refresh analysis.

The local display clock counts down the server-provided scheduling deadline, never triggers work,
and stops on unmount/status change. New source revisions can postpone that deadline. Zero means
Waiting to start, not proof of worker execution; scheduler cadence makes the estimate approximate.
Older servers without a deadline retain the scheduled label without an invented countdown. Timer
ticks are outside the live status announcement. Tests cover postponements, expiry, timer cleanup,
immediate requests and lost acknowledgements; browser checks cover far-right placement, reload,
keyboard controls and mobile themes.
