# huntinwabbit-boilerplate — monorepo guide

huntinwabbit-boilerplate is a reusable authenticated web/API starter. The primary applications are
`web/` and `server/`; there is no native app in scope. Read `README.md` for setup and current scope.
Executable owners and feature barrels describe implemented behavior.

## Sources of truth

Executable code, schemas, migrations, configuration and tests define implemented behavior. Prose has
the following narrower jobs:

| Surface | Owns |
|---|---|
| This guide and project guides | Repository or platform-wide workflow, boundaries and navigation |
| `<Feature>.AGENTS.md` beside code | Why a feature exists, what it does and does not do, architecture, failure semantics and verification |
| `docs/` | Cross-stack explanations, external-fact inventories, approved output and reusable runbooks |
| `product-workspace/` | Research, alternatives, plans, evidence and decisions in formation |
| `.agents/` | Silent, non-obvious traps learned through incidents |
| Source comments | Local symbol purpose, units, ordering, compatibility and surprising correctness constraints |

Documentation should point to executable owners for exact fields, routes, values and configuration.
Do not preserve a second implementation in prose. When code appears wrong, describe current behavior
accurately and record the suspected defect for separately scoped work instead of silently changing
product behavior during documentation cleanup.

Normative workflow, safety, privacy and product invariants may use `must` or `never` when their scope
is explicit. Factual claims should state their boundary and evidence. Attribute and date external
facts that code cannot establish.

## Repository map

| Folder | Project | Read first |
|---|---|---|
| `web/` | Next.js frontend with authentication and a protected Hello World demo | `web/AGENTS.md` |
| `server/` | Node 24, TypeScript ESM, Express API on Serverless/AWS Lambda | `server/AGENTS.md` |
| `docs/` | Shared explanations and reusable runbooks | `docs/README.md` |
| `assets/` | Source artwork conventions for future assets | [assets.AGENTS.md](assets/assets.AGENTS.md) |
| `product-workspace/` | Product projects and research | `product-workspace/product-workspace.AGENTS.md` |
| `scripts/` | Repository documentation validation | `scripts/scripts.AGENTS.md` |
| `supabase/` | Shared hosted authentication configuration | [supabase.AGENTS.md](supabase/supabase.AGENTS.md) |

Project guides own stack-specific conventions. When adapting inherited scaffolding, update affected
guidance to describe huntinwabbit-boilerplate and the code that actually exists. Keep unrelated cleanup separately
scoped.

This guide owns the branch and handoff process for every tree. Project and feature guides add
narrower architecture and verification rules. Read the narrowest applicable guide before editing.
The process was reconciled with Sanctum; [development-process.md](docs/development-process.md)
records which practices transfer and which capabilities are not implemented here. An ignored
reference checkout in `temp/` is evidence, not a dependency or a second set of active instructions.

## Branch workflow

`main` receives pull requests from `dev`; the user opens and merges those. Agents do not work on
`main` except through the Immediate bug fix process, which only the user may invoke.

`dev` is the shared routine-development branch. Feature branches start from `dev` and return through
an agent-opened pull request.

The user chooses one of the four processes below. When no process is named, use Quick feature
development. Do not create a worktree merely because a change looks large; ask when the intended
process is unclear.

### Feature development

Use this for work that will receive its own pull request.

1. In the primary checkout, make `dev` current and bring `main` into it. Resolve conflicts there.
2. Create the feature branch and isolated worktree together from `dev` (or a deliberate parent
   feature branch when stacking).
3. Install dependencies and configure the worktree using the affected project guides. Keep local
   credentials and environment files out of Git.
   Run `mise install` and `npm ci` separately in each affected app. Ignored dependencies, generated
   route types and build output are checkout-local; the branch does not carry them.
4. Implement the work and update every affected feature barrel.
5. Run the applicable gates in the worktree until clean.
6. Commit the feature work, detach the worktree from the feature branch, and then check out that
   branch in the primary checkout. Git will not check out one branch in two worktrees at once.
7. Bring fresh `dev` into the feature branch and resolve conflicts before review.
8. Restore dependencies and regenerate any required project state in the primary checkout, then
   rerun the applicable gates there.
9. Push and open a pull request into `dev` with `gh pr create --base dev`. Explain behavior,
   judgment calls, verification and anything not checked.
10. Remove the worktree and any task-created temporary files or copied secrets. Name the cleanup
    in the handoff.
11. Return the primary checkout to `dev` and hand back the PR link.

Feature development is the only process in which an agent commits, because the commit feeds the pull
request. Agents do not merge a feature branch into `dev` themselves.

### Quick feature development

1. Work in the primary checkout on `dev`.
2. Bring `main` into `dev` and resolve conflicts.
3. Implement the change and update affected barrels.
4. Run the applicable gates.
5. Stage the result and stop. Leave the commit to the user and provide the proposed commit message.

### Active feature development

1. Work on the existing feature branch wherever it is checked out.
2. Bring `dev` into it and resolve conflicts.
3. Implement the follow-up and update affected barrels.
4. Run the applicable gates.
5. Stage the result and stop. Do not commit or push an in-flight pull request unless the user
   explicitly changes the process.

### Immediate bug fix development

Only the user may invoke this production-emergency process.

1. Work on `main` in the primary checkout.
2. Implement the fix and update affected barrels.
3. Run the applicable gates.
4. Stage and stop; the user owns the commit and push.
5. State clearly that `main` contains staged, uncommitted changes.

## Commit messages

Use a category-prefixed subject and a useful body for both proposed commit messages and commits
created through the authorized branch workflow.

- Format the subject as `<type>: <imperative summary>`, with an optional scope when it helps:
  `feat(auth): add account recovery`.
- Choose the category that describes the primary change: `feat`, `fix`, `refactor`, `perf`, `docs`,
  `test`, `style`, `build`, `ci`, `chore`, or `revert`. Use `style` for formatting-only changes.
- Keep the subject concise, preferably within 72 characters, without a trailing period.
- Separate the subject from the body with a blank line. Include several focused bullets describing
  the meaningful changes and why they matter. Group related work by behavior rather than listing
  every changed file.
- Include relevant privacy, compatibility, migration or failure-handling decisions so the history
  explains the resulting behavior without requiring the original conversation.
- Finish with validation actually performed and any material limitation or release follow-up.
  Distinguish completed checks from checks that remain outstanding; never imply an unrun check passed.

## Verification

Run the gates for every application tree actually touched, from that application's directory.
Both applications use npm, Biome and mise with independent package manifests and lockfiles.
Run `mise install` and `npm ci` inside each application; there is no root npm workspace.
Use executable scripts as the command source of truth.

| Touched | Gate |
|---|---|
| Documentation or root maintenance scripts | `node --test scripts/documentation-structure.test.mjs` then `node scripts/check-documentation.mjs` from the root |
| `server/` | `npm run check-types && npm run check && npm test` |
| `web/` | `npm run check-types && npm run check && npm test && npm run build` |

The documentation gate checks structure, not prose truth, external URLs or all workspace wiki links.
Also verify commands, implementation claims and external facts against their owners. Documentation-only
changes outside application trees do not require application builds or tests. For server compiler,
entry-point or build changes, also run `npm run build`; a local build does not prove deployment works.

Some formatting and lint commands write fixes. Review their diffs and keep unrelated rewrites out of
the change. For visual changes, state whether the result was viewed in a browser and which checks
remain outstanding.

Tests should protect user-visible behavior and load-bearing failure, retry and ordering rules.
Use deterministic fixtures and injected external boundaries. Reproduce a defect before fixing it;
avoid assertions that merely restate implementation. Do not disable a failing gate to finish work.
Report an unavailable environment check precisely and complete the checks that can run.

Local server tests, browser tests and the web production build need permission to bind local
sockets, even when they use no hosted services. In a sandbox that denies socket binding, run these
commands through the available command-scoped approval mechanism before their first attempt.
Do not interpret `listen EPERM` or Turbopack's port-binding denial as an application regression.
Follow the [local socket verification runbook](docs/runbooks/local-socket-verification.md), including
its targeted cache recovery if a web build repeats the denial after permission is granted.

## Feature barrels

Every feature being changed needs a `<Feature>.AGENTS.md` in the narrowest folder that owns it.
Project guides maintain compact indexes to those barrels.

A barrel explains current truth:

- the user problem, purpose, non-goals and durable boundaries;
- visible behavior, important states and degraded operation;
- owners, seams, data flow, persistence, concurrency and ordering constraints;
- public interfaces and a small code map that links exact executable contracts;
- retries, idempotency, compatibility, external-service traps and recovery;
- tests, release gates, observability and known limitations.

A barrel is not a changelog, incident transcript or directory listing. Keep compatibility history
only while current code still supports it. Remove superseded instructions rather than appending a
history lesson.

Typical locations are `web/src/features/<feature>/<feature>.AGENTS.md` and
`server/src/features/<feature>/<feature>.AGENTS.md`. Shared contracts stay in root `docs/` and
link their schemas; incidents stay in `.agents/` and link the durable invariant back to the barrel.

Before handoff, confirm that each project guide mentions its barrels, referenced paths exist and the
barrels match the implementation that passed the gates.

## Product boundaries

The starter implements authentication and an authenticated Hello World example. It has no application
data persistence, paid integrations, background jobs, account deletion or profile management.
New features must define their contracts in code and their owning barrels. Represent missing or
uncertain information honestly, preserve user intent, and define history/retention before storing data.
Never put credentials, personal data or sensitive payloads in logs, fixtures or committed examples.

## Shared engineering practices

- Keep composition, product logic and external adapters separate. Introduce interfaces at real
  boundaries; do not create a service or state wrapper for every small component.
- The web app uses container/component architecture. `Name.container.tsx` coordinates state,
  services and view selection; `Name.component.tsx` renders typed props and emits callbacks.
  Presentation components must not import containers or application-state/service adapters, including
  indirectly through barrels or hooks. Containers compose connected children through slots or
  `children`. Keep business rules in pure functions, selectors and reducers; do not add empty containers.
  Follow the [React architecture guide](web/docs/react-architecture.AGENTS.md).
- Keep component-owned state in pure `useState` updates. A local parent may pass state and callbacks
  to nearby children without promoting them to Redux. Use Redux Toolkit slices when mutable feature
  state needs shared ownership or a longer lifetime. Do not add custom product-state context/reducer
  providers. Follow the [web state conventions](web/docs/state-management.md). Test presentation
  contracts through props and connected containers with fresh real stores and deterministic data;
  do not mock Redux hooks, actions, reducers or selectors. Test every handwritten branch in providers,
  actions, reducers and selectors. Vendor adapters retain their own browser mechanics rather than
  duplicating them in Redux.
- Give mutable state one owner whose lifetime matches the work. Durable or paid work cannot rely
  on a page or component staying mounted. Handle stale results, cancellation and repeated requests
  deliberately, and test the behavior that matters.
- Distinguish canonical user input from generated or cached output. Missing or invalid data must
  produce an honest degraded state without hiding unrelated content. Define destructive operations,
  recovery and any irreversible boundary in the owning feature before implementing them.
- Keep navigation in the framework's route system, design tokens at their shared owner, and vendor
  SDK behavior behind a narrow adapter. Shared UI contains reusable behavior, not feature policy.
- Product copy is behavior: verify claims about storage, accounts, privacy, retention and availability
  against implemented contracts. Attribute provider promises; do not present them as guarantees we
  enforce. Introducing a new processor includes documenting its data boundary in `docs/`.
- Separate local tests from deployment, publication, vendor configuration and paid evaluations.
  Run external mutations only within the user's authorized task and target. Do not deploy merely
  to make a verification checklist green.

## Cross-cutting repository rules

- This is a public, self-hostable repository. Contributors must deploy and configure their own
  infrastructure. Never hard-code the maintainer's deployed API endpoints or Supabase project IDs
  in source, examples, tests or setup documentation. Use placeholders in checked-in examples and ignored local environment
  files or deployment configuration for actual targets. Stage selection must not fall back to the
  maintainer's infrastructure.

- Script directories carry their own barrel when introduced.
- Published campaigns are operational records. Verify external status before treating a checked-in
  artifact as published; once confirmed sent/published, preserve the exact artifact.
- Required external configuration belongs in checked-in setup and verification code rather than
  existing only as dashboard state.
- Keep ignore rules aligned with the monorepo as it is assembled. Do not commit `node_modules`,
  `.next`, build output, coverage, `.serverless`, credentials or local secret files.
- Root, web and server use `CLAUDE.md -> AGENTS.md` aliases. Edit the guide, not the symlink.
- Root `docs/` owns shared current explanations. Project-specific docs remain in their project.
- Use `.agents/` for standalone incident reports only when the trap is silent, non-obvious and not
  recoverable from code. When adding an incident, maintain `.agents/README.md` and link the durable
  invariant from the owning barrel.
