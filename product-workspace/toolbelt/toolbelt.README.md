# toolbelt

A collection of TypeScript CLI tools for AI agents, built with [Bun](https://bun.sh).

## Usage

Agents `cd` to the target workspace, then run a tool from `toolbelt/packages/`:

```bash
cd /path/to/target-workspace
bun /path/to/toolbelt/packages/create-project/index.ts <project-name>
```

## Running validation

```bash
# Full test suite
bun test

# Repo-wide Biome check
bun run biome:check

# Repo-wide Biome write/fix step
bun run biome:write

# Final sign-off workflow
bun run signoff

# Single package while iterating
bun test packages/create-project/lib.test.ts

# Watch mode
bun test --watch
```

For all development inside `toolbelt`, the expected final flow is:

1. get the relevant tests passing
2. run Biome's auto-write step
3. ensure the repository still passes its final checks

`bun run signoff` packages that sequence into one command.

## Packages

| Package | Description | Usage |
|---------|-------------|-------|
| [`brave-search`](./packages/brave-search/) | Search Brave web results or grounded LLM context for research workflows | `bun .../brave-search/index.ts <web-search\|llm-context> [options] <query>` |
| [`create-project`](./packages/create-project/) | Scaffold an workspace project folder | `bun .../create-project/index.ts <name>` |
| [`list-tools`](./packages/list-tools/) | List all available toolbelt tools with descriptions and commands | `bun .../list-tools/index.ts` |

## Adding a new package

1. Create `packages/<tool-name>/`
2. Add `index.ts` (thin CLI entrypoint), `lib.ts` (pure logic), `templates.ts` (content templates), `lib.test.ts` (collocated tests)
3. Run `bun test packages/<tool-name>/lib.test.ts` while iterating
4. Before final sign-off, run `bun run signoff` from the `toolbelt` root

Each package is fully self-contained — adding or changing one never affects others.

## Conventions

- **Language**: TypeScript strict mode
- **Runtime**: Bun (native TS execution, no build step)
- **Tests**: Collocated `lib.test.ts` per package, discovered automatically by `bun test`
- **Formatting/Linting**: Biome at the repo root, applied across all toolbelt packages
- **TDD**: Write tests first, implement until green
- **No external dependencies** unless clearly necessary
