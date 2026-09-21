# list-tools

A CLI tool that lists all available toolbelt tools with their descriptions and invocation commands.

## When to use

Run this tool whenever you need to know what toolbelt tools are available and how to invoke them. It dynamically discovers tools by scanning each package for a `TOOL.json` file — no manual registry to maintain.

## Usage

```bash
bun ./toolbelt/packages/list-tools/index.ts
```

No arguments are required.

## What it outputs

```
create-project — Scaffolds a dated project folder with correct naming, frontmatter, and subdirectory structure
  bun ./toolbelt/packages/create-project/index.ts

list-tools — Lists all available toolbelt tools with their descriptions and invocation commands
  bun ./toolbelt/packages/list-tools/index.ts
```

Tools are sorted alphabetically. Any tool that does not have a `TOOL.json` file is silently skipped.

## Adding a new tool to the listing

Create a `TOOL.json` in the package directory:

```json
{
  "name": "your-tool-name",
  "description": "One sentence describing what it does"
}
```

That's all — `list-tools` will pick it up automatically on the next run.

## Running validation

```bash
cd /path/to/huntinwabbit/product-workspace/toolbelt
bun test packages/list-tools/lib.test.ts
bun run signoff
```

> **All features and changes must be verified by tests first and then by the shared Biome pass.** During iteration, run the package test directly. Before final sign-off for any work in `toolbelt`, run `bun run signoff` from the repo root.
