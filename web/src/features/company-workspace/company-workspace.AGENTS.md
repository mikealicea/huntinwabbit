# Company workspace

A company page shows all of the signed-in user's roles at one saved company, including Closed,
newest first. Company names on the board and role workspace link to stable company IDs. Unknown
companies have no fabricated link. Comments, company research, contacts, interview processes,
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

[Picker container](ChangeCompany.container.tsx) loads searchable companies and sends versioned
selection, create-and-select or clear mutations. [Dialog](ChangeCompany.component.tsx) owns only local
form state. A conflict retains input, refreshes the role, and requires closing/reviewing/reopening
before another save. Accepted manual choices survive refreshes. Native modal behavior owns focus
containment; closing restores the trigger. Request failure never becomes a successful selection.

[Tests](company-workspace.test.tsx) use real stores and fake HTTP, plus presentation tests for form
callbacks. [Browser tests](../../../e2e/companies.spec.ts) cover routing, correction, reload, multiple
roles, actions, focus and mobile/theme layouts. Run web gates, state/auth coverage, architecture,
browser and root documentation checks. Screenshots are review artifacts, not an accessibility audit.
