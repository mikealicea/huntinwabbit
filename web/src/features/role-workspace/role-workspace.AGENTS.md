# Role workspace

## Purpose and behavior

The workspace at `/app/roles/[roleId]` brings one opportunity's posting, application decisions,
preparation and materials together. Edits apply immediately to the temporary session. The workspace
does not submit applications, parse postings, upload files, edit company research or manage a resume
library. New captures show unknown posting details rather than fictional extraction results.

Stage, interest and priority can be changed independently. Tasks can be completed and reopened;
follow-up dates can be set or cleared. Notes remain specific to the role. Selecting another planned
resume leaves submitted metadata intact. Shared company context is read-only and resolved by ID,
with the count of all roles linked to that company.

## Owners and interfaces

- [RoleWorkspace.tsx](RoleWorkspace.tsx) owns the workspace composition and editing controls.
- [JobDetails.tsx](JobDetails.tsx) displays posting facts, salary and a safe new-tab source link.
- [ApplicationMaterials.tsx](ApplicationMaterials.tsx) separates resume selection from submission
  metadata and explains that these sample records contain no stored files.
- [CompanyContext.tsx](CompanyContext.tsx) resolves shared research, contacts and interview context.
- [role-workspace.index.ts](role-workspace.index.ts) exports the route-facing component.

The [route](../../app/app/roles/[roleId]/page.tsx) resolves framework params and passes only the opaque
role ID after requiring a verified [auth identity](../auth/auth.AGENTS.md). State selectors and generated RTK actions come through
[job-search.index.ts](../job-search/job-search.index.ts), consumed with
[typed Redux hooks](../../state/state.hooks.ts), not
through the URL or a duplicated local store. No personal content is added to route metadata.

Unknown IDs show a recovery explanation and board link. A newly captured role's URL becomes missing
after reload because the session is temporary. Navigating back within the app preserves edits.
The page has no external writes, async retries or durable save status to claim.

## Verification

[RoleWorkspace.test.tsx](RoleWorkspace.test.tsx) covers independent controls, tasks, notes, shared
company context, submission preservation and missing roles. [browser tests](../../../e2e/job-search.spec.ts)
cover navigation, follow-up reflection on the board, session reset and mobile themes. Run the web and
documentation gates in the [web guide](../../../AGENTS.md); check date controls, keyboard focus,
long content and both themes in a browser.
