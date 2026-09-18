# create-project

A CLI tool that scaffolds a new project directory following the workspace conventions.

## When to use

Run this tool whenever you need to create a new project. It handles the naming convention, date prefix, frontmatter, and subdirectory structure automatically — you just fill in the files afterward.

## Usage

> **Do NOT pass `--help` or `-h`.** This file is the documentation — read it directly instead of probing the tool.

**Always run from the target workspace root** (the directory that contains `projects/`):

```bash
cd /path/to/your-workspace
bun /path/to/toolbelt/packages/create-project/index.ts <project-name> [--workspace <name>]
```

### Examples

```bash
# From this workspace — the parent index resolves to [[huntinwabbit-projects]]
cd /path/to/huntinwabbit/product-workspace
bun ./toolbelt/packages/create-project/index.ts linkedin-outreach-campaign

# Name with spaces works too — automatically converted to kebab-case
bun ./toolbelt/packages/create-project/index.ts "Q2 Content Strategy"

# Force a specific parent index, whatever the folder is called
bun ./toolbelt/packages/create-project/index.ts my-project --workspace huntinwabbit
```

### How the parent index is chosen

The generated index note links to a workspace projects index as its `parent:`. The tool
resolves that name in three steps, first match wins:

1. `--workspace <name>` when given (a trailing `-projects` is not doubled).
2. The single `*-projects.md` sitting **at the workspace root**. In this workspace that is
   `huntinwabbit-projects.md`. A `*-projects.md` nested deeper — such as
   `projects/example-projects.md` — is deliberately ignored.
3. The workspace folder name, kebab-cased, plus `-projects`.

Step 2 exists because step 3 alone breaks the moment the workspace is nested under a folder
with a different name. Inside the huntinwabbit repo the folder is `product-workspace` while the
index is `huntinwabbit-projects`, so folder-name derivation would give every new project a
`[[product-workspace-projects]]` parent pointing at a note that does not exist. If the root
index is ever ambiguous (two or more `*-projects.md`), the tool falls back to step 3 rather
than guessing — pass `--workspace` in that case.

## What it creates

Given a name like `my-project`, the tool creates:

```
projects/
└── 2026-03-13-my-project/
    ├── 2026-03-13-my-project.index.md  ← Project index: purpose, status, notes
    ├── 2026-03-13-my-project.plan.md   ← Plan: objective, approach, todo list
    ├── todo/                  ← Pending task files
    ├── doing/                 ← In-progress task files
    ├── done/                  ← Completed task files
    └── resources/             ← Supporting materials
```

Both `.md` files are pre-populated with the correct YAML frontmatter:

```yaml
# index file
---
parent:
  - "[[{workspace}-projects]]"
date: YYYY-MM-DD
---

# plan file
---
parent:
  - "[[YYYY-MM-DD-my-project.index]]"
date: YYYY-MM-DD
---
```

## After running the tool

1. Open `<YYYY-MM-DD-project-name>.index.md` and fill in the **Overview**, **Status**, and **Notes** sections
2. Open `<YYYY-MM-DD-project-name>.plan.md` and fill in the **Objective** and **Approach**
3. Add task files to `todo/` as you identify work items
4. When you create additional files inside the project, link or parent them to the project index note at minimum

## Error cases

| Situation | Behaviour |
|-----------|-----------|
| No project name given | Prints usage and exits with error |
| Project directory already exists | Errors without overwriting anything |
| Name with spaces or PascalCase | Automatically converted to kebab-case |
| `--workspace` with no value | Prints an error and exits 1 — it never silently falls back |
| `--workspace` with no usable characters (e.g. `!!!`) | Throws rather than emitting a `[[-projects]]` link |
| Two or more `*-projects.md` at the workspace root | Falls back to the folder name; pass `--workspace` to disambiguate |

## Running validation

```bash
cd /path/to/toolbelt
bun test packages/create-project/lib.test.ts
bun run signoff
```

> **All features and changes must be verified by tests first and then by the shared Biome pass.** During iteration, run the package test directly. Before final sign-off for any work in `toolbelt`, run `bun run signoff` from the repo root.
