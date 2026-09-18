# toolbelt.AGENTS.md — Toolbelt

A guide for AI agents on how this repository works, what decisions were made, and how to add new tools.

---

## What this is

`toolbelt` is a collection of TypeScript CLI tools that agents can run to scaffold and automate common tasks. Each tool lives in its own isolated package under `packages/` and can be run directly with Bun — no build step required.

---

## Validation policy

> **All features and changes — to new or existing tools — must be verified by tests first, then by the shared Biome pass before they are considered done.**

- Run `bun test` from the toolbelt root to confirm the full suite passes before and after your change
- After tests pass, run `bun run biome:write` before final sign-off
- Prefer `bun run signoff` when you want the full final sequence in one command
- Prefer **TDD**: write a failing test first, then implement until it passes
- Never skip tests to ship faster; a change that breaks tests is a broken change

---

## Running a tool

Always `cd` to the target workspace first, then invoke the tool:

```bash
cd /path/to/target-workspace
bun /path/to/toolbelt/packages/<tool-name>/index.ts <args>
```

Each package has its own `<tool-name>.AGENTS.md` with specific usage instructions.

---

## Running validation

```bash
# All packages
cd /path/to/toolbelt
bun test

# Shared Biome pass for all development in toolbelt
bun run biome:write

# Optional non-mutating Biome verification
bun run biome:check

# Final sign-off sequence
bun run signoff

# Single package while iterating
bun test packages/<tool-name>/lib.test.ts

# Watch mode
bun test --watch
```

---

## Design decisions

These decisions apply to every tool in this repo. Follow them when adding new packages.

### TypeScript + Bun
All tools are written in TypeScript and run with [Bun](https://bun.sh). Bun executes `.ts` files natively — there is no compilation or build step. This keeps tools fast to run and easy to iterate on.

### One package per tool
Each tool lives in `packages/<tool-name>/` and is fully self-contained. This means:
- Adding a new tool never risks breaking an existing one
- Tests, logic, and templates are all co-located
- Each package can be understood and modified in isolation

### Consistent file layout per package
Every package follows the same four-file structure:

| File | Purpose |
|------|---------|
| `index.ts` | Thin CLI entrypoint — parses `process.argv`, calls lib, prints output |
| `lib.ts` | Pure logic — all meaningful behaviour lives here, exported as functions |
| `templates.ts` | Content templates — strings/functions that produce file content |
| `lib.test.ts` | Collocated tests — `bun test` discovers these automatically |
| `<tool-name>.AGENTS.md` | Agent-facing usage docs for this specific tool |

Keep `index.ts` thin. All real logic belongs in `lib.ts` so it can be unit tested without spawning a process.

### TDD
Tests are written before (or alongside) implementation. The workflow is:
1. Write failing tests in `lib.test.ts` (red)
2. Implement in `lib.ts` and `templates.ts` until tests pass (green)
3. Refactor as needed, keeping tests green

### No external dependencies
Tools use only Bun built-ins and Node.js standard library modules. Do not add `npm` packages unless there is a compelling reason — keep the toolbelt fast and self-contained.

The package manifest still includes the inherited `sweph` dependency, but there is no local
`astro-chart` package. Do not assume that tool is available.

### Strict TypeScript
`tsconfig.json` enforces strict mode (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Write types explicitly; avoid `any`.

### Shared Biome quality gate
Biome is configured once at the `toolbelt` root and applies across every package in `packages/`. Even if you only touch one tool, the final `toolbelt` sign-off flow still includes the shared Biome pass.

---

## Adding a new tool

### 1. Create the package directory

```bash
mkdir packages/<tool-name>
```

### 2. Add the four standard files

```
packages/<tool-name>/
├── index.ts       ← CLI entrypoint
├── lib.ts         ← Pure logic
├── templates.ts   ← Content templates (if applicable)
├── lib.test.ts    ← Tests (write these first)
└── <tool-name>.AGENTS.md ← Usage docs for agents
```

### 3. Follow the TDD workflow

Write tests in `lib.test.ts` first. Run them to confirm they fail:

```bash
bun test packages/<tool-name>/lib.test.ts
```

Then implement until all tests pass.

### 4. Write <tool-name>.AGENTS.md for the new tool

Every package needs a `<tool-name>.AGENTS.md` explaining:
- When to use it
- How to invoke it (with examples)
- What it creates or does
- What arguments it accepts
- Error cases and how they behave

### 5. Verify the full suite still passes

```bash
bun test
bun run biome:write
```

All existing tests must continue to pass after adding a new package, and the shared Biome pass must complete cleanly.

---

## Existing packages

| Package                                                 | What it does                                                                                                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`brave-search`](./packages/brave-search/brave-search.AGENTS.md)       | Searches Brave Web Search or Brave LLM Context to support web research workflows                                                                                                       |
| [`create-project`](./packages/create-project/create-project.AGENTS.md) | Scaffolds a dated project folder with an index note, plan note, correct frontmatter, and subdirectory structure                                                                        |
| [`list-tools`](./packages/list-tools/list-tools.AGENTS.md)             | Lists all available toolbelt tools with their descriptions and invocation commands                                                                                                     |
