# Development practices and parity

huntinwabbit adopts engineering practices from Sanctum while retaining its own product, architecture
and tooling choices. The [root guide](../AGENTS.md) governs the resulting workflow. Sanctum is a
reference for how to develop; the [product README](../README.md) remains the authority for what we
are building. A reference checkout is never needed to run or interpret these guides.

Reconciled on 2026-09-17 against the user-provided Sanctum snapshot in `temp/Sanctum/`:
root, landing-page, server and client guides; framework,
accessibility and representative feature guidance; and documentation-maintenance scripts. The
workspace research/insight/toolbelt guidance was also compared; its existing huntinwabbit adaptation
already preserves the relevant methods.
The snapshot has no embedded Git metadata, so no upstream revision is asserted.

## Adopted practices and owners

| Practice | Local owner |
|---|---|
| Four branch workflows, user-owned routine commits, feature PRs and worktree cleanup | [Root guide](../AGENTS.md) |
| Executable truth, documentation placement and graduation of research | [Documentation index](README.md), root guide |
| Feature barrels, indexes and project-root aliases checked automatically | [Maintenance scripts](../scripts/scripts.AGENTS.md) |
| Thin routes, feature public APIs, server-first web composition and real production builds | [Web guide](../web/AGENTS.md) |
| Input validation, explicit dependencies, external adapters, safe errors, retries and ordering | [Server guide](../server/AGENTS.md) |
| One state owner with the right lifetime, shared tokens, degraded states and accessible controls | Root/web guides and [accessibility](../web/docs/accessibility.AGENTS.md) |
| Reproducible external configuration and a distinction between local verification and live mutation | Server guide and [deployment guide](../server/docs/SERVERLESS-V4.AGENTS.md) |
| Research provenance, atomic findings, indexed notes and adopted-output graduation | [Workspace guide](../product-workspace/product-workspace.AGENTS.md) |

The structural checker and its regression suite were adapted from the reference repository. Its
policy is specific to this tree. It includes unignored new files, excludes ignored clones/build
output, separates historical notes from current explanations, and requires a direct barrel for
each existing application feature. It does not validate external URLs, prose truth, every workspace
wiki link or full Markdown syntax.

## Deliberate differences

- `web/` is the application, not a marketing site for an iOS app. The job-search frontend uses mock
  data; the blog remains inherited scaffolding. No Sanctum routes, purchase flows or marketing claims
  were adopted.
- Web and server are independent npm packages using mise and Biome. Read-only `check` and writing
  `check:fix` remain separate. No root npm workspace, pnpm, Prettier or Xcode workflow is introduced.
- Native build generation, simulator rules, App Store release processes, DerivedData, SwiftData,
  Files-app ownership, recordings and backup policies do not transfer. The general lessons about
  generated artifacts, state lifetime, recovery and truthful UI do.
- The app's current daisyUI themes and fonts remain local choices. Web keyboard, focus, reflow and
  motion rules replace native-specific controls and accessibility APIs.
- No Supabase, Sentry, billing, worker queue or provider selection is implied by the process. Add
  those only when huntinwabbit's actual requirements justify them.
- Root `.agents/` is reserved for incident reports. Maintained framework/UI guidance lives in
  `web/docs/`, avoiding the reference app's mixture of imported guides and incidents.

## Current gaps to carry into feature work

These are recorded limitations, not infrastructure added by this reconciliation:

- Supabase Auth and DynamoDB are now selected; [auth infrastructure](auth-infrastructure.md) owns
  their boundary. Web authentication and API token verification are implemented; resource ownership authorization,
  saved-posting persistence and its retention boundary are implemented in the backend; web API integration
  and account-data deletion remain separate work.
- Server request and error logs omit paths, credentials and raw errors/causes. The
  [shared barrel](../server/src/shared/shared.AGENTS.md) records that boundary; hosting infrastructure
  logging still requires separate verification.
- There is no automated credential scanner. Biome and the documentation gate do not prove that
  staged content is free of secrets. Add a scanner as actual tooling, with failure-path tests,
  before claiming parity with Sanctum's committed-secret gate.
- [Browser end-to-end tests](../web/e2e/e2e.AGENTS.md) cover the initial job-search flows. They are not
  a comprehensive accessibility audit. The opt-in [API E2E suite](../server/e2e/e2e.AGENTS.md) checks
  live hello authentication with a dedicated hosted account. The
  [deployment guide](../server/docs/SERVERLESS-V4.AGENTS.md) records deployment checks and their limits.
  Feature barrels state what existing tests actually cover.
- Blog date parsing validates a non-empty string rather than a valid ISO date. The
  [blog barrel](../web/src/features/blog/blog.AGENTS.md) records the narrower implementation.

Changes to these behaviors belong in explicitly scoped implementation work with the corresponding
barrel and checks updated. This reconciliation changes development guidance and its structural
validation, not application behavior or product direction.
