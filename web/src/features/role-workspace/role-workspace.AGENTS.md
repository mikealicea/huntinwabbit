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

- [RoleWorkspace.container.tsx](RoleWorkspace.container.tsx) selects the role and its display context,
  wires intents to actions, and chooses the workspace or [missing-role view](RoleNotFound.component.tsx).
  [RoleWorkspace.component.tsx](RoleWorkspace.component.tsx) renders controls and receives connected
  materials/company sections as slots. It accepts application/task callbacks rather than dispatch.
- [JobDetails.component.tsx](JobDetails.component.tsx) displays posting facts, salary and a safe source link.
- [ApplicationMaterials.container.tsx](ApplicationMaterials.container.tsx) selects resume choices and
  dispatches planned-resume changes. Its [component](ApplicationMaterials.component.tsx) accepts props
  and a selection callback, preserving the distinct submitted snapshot.
- [CompanyContext.container.tsx](CompanyContext.container.tsx) selects the shared company and count;
  its [component](CompanyContext.component.tsx) renders known/unknown research and contacts from props.
- [role-workspace.index.ts](role-workspace.index.ts) exports the route-facing container. Presentation
  components do not import Redux or nested containers.

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
company context, submission preservation and missing roles. [Presentation tests](role-workspace.presentation.test.tsx) verify intent callbacks,
submitted snapshots, missing company data and slots without providers. [browser tests](../../../e2e/job-search.spec.ts)
cover navigation, follow-up reflection on the board, session reset and mobile themes. Run the web and
documentation gates in the [web guide](../../../AGENTS.md); check date controls, keyboard focus,
long content and both themes in a browser.
