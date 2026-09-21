---
title: "huntinwabbit-boilerplate — How We Work Together"
category: "agents"
related:
  - "[[huntinwabbit-boilerplate-projects]]"
  - "[[huntinwabbit-boilerplate-research]]"
  - "[[RESEARCH.METHODOLOGY.AGENTS]]"
tags: [huntinwabbit-boilerplate, agents, workspace]
---

# product-workspace.AGENTS.md — huntinwabbit-boilerplate

This folder holds research, projects, insights, drafts, alternatives, and decisions in formation for
huntinwabbit-boilerplate. The [repository README](../README.md) owns the intended product experience; executable
code and tests define implemented behavior. The primary applications are `web/` and `server/`.

The [root AGENTS.md](../AGENTS.md) governs branch workflow, product boundaries, verification, and
feature barrels. Follow its chosen development process; workspace notes are ordinary repository
changes. These workspace rules are additive, and the root guide wins if they disagree.

## Start here

- Read [[product-workspace.AGENTS-SETUP]] for environment setup.
- Enter projects through [[huntinwabbit-boilerplate-projects]], research through [[huntinwabbit-boilerplate-research]], and
  insights through [[huntinwabbit-boilerplate-insights]].
- Read [[RESEARCH.METHODOLOGY.AGENTS]] and [[RESEARCH_METHODOLOGY]] before starting research.
- Read the narrowest `AGENTS.md` or `*.AGENTS.md` before changing a folder's contents.

Commands below run from `product-workspace/` unless stated otherwise.

## Working boundaries

- Keep `.obsidian/` read-only; it is user state.
- Use `[[wiki links]]` for notes within this vault and Markdown links for external sources and
  repository files outside it. Every durable note must be reachable from an index.
- Keep proposed decisions distinct from approved product direction and implemented behavior.
- Ask before changing product direction, scope, privacy, or data ownership unless the user has
  already authorized that change. Preserve unrelated work.
- Keep resumes, contact details, credentials, and private application notes out of committed samples.
- Once a conclusion is adopted, distill its durable explanation into root `docs/` or the owning
  feature barrel, with links back to useful evidence. Do not maintain duplicate canonical bodies.
- When a decision is implemented, update the affected feature barrel with the code change.
- Use the [docs placement guide](../docs/README.md) when graduating workspace output. Run the
  root documentation gate after note/index changes; it checks ownership and selected indexes,
  not every wiki link or the truth of research findings.

## Projects

Use `projects/YYYY-MM-DD-project-name/`, with an index, plan, and `todo/`, `doing/`, `done/`, and
`resources/` directories. Move task notes between state directories; completed projects get a linked
`.summary.md`. Add each project to [[huntinwabbit-boilerplate-projects]].

```bash
bun ./toolbelt/packages/create-project/index.ts <project-name>
```

The generator uses the single root `*-projects.md` file, `huntinwabbit-boilerplate-projects.md`, as the new
project's parent. Add the generated index to that parent manually. See
[[create-project.AGENTS]] for arguments and fallback behavior.

## Research

Use `research/YYYY-MM-DD-topic/` and the scaffold in [[examples-research-README]].

1. Define questions and scope in the plan.
2. Capture atomic, sourced findings under `findings/`.
3. Roll findings, recommendations, and confirmed decisions into the index, labeling their status.
4. Add the research index to [[huntinwabbit-boilerplate-research]] and link related projects.

Attribute and date external facts; distinguish evidence from inference. Follow
[[RESEARCH.METHODOLOGY.AGENTS]], with the local guidance in [[RESEARCH_METHODOLOGY]].

## Insights

Use `insights/YYYY-MM-DD-name.md`. Track hypotheses as pending, exploring, or validated in
[[huntinwabbit-boilerplate-insights]], then promote validated work into a project. Read [[insights.AGENTS]].

## Toolbelt

Prefer the existing tools when they cover the task:

```bash
bun ./toolbelt/packages/list-tools/index.ts
bun ./toolbelt/packages/<tool-name>/index.ts <args>
```

Read [[toolbelt.AGENTS]] and the package guide before changing a tool. Toolbelt changes require
its tests and shared Biome sign-off.

## Standards

- [[WORKSPACE_STYLE_GUIDE]] — writing, links, citations, Markdown, and frontmatter
- [[RESEARCH_QUICK_REFERENCE]] — compact research checklist
- [[RESEARCH.METHODOLOGY.AGENTS]] — canonical research method
- [[RESEARCH_METHODOLOGY]] — local decision-first guidance
- [[_fresh/README|Fresh notes inbox]] — temporary uncategorized capture
