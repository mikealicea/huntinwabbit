# brave-search

A CLI tool for quick web research with Brave Search.

## When to use

Use `brave-search` when you want a lightweight research helper inside the toolbelt:

- `web-search` gives you a compact set of result URLs plus snippets, with Brave `extra_snippets` always enabled
- `llm-context` gives you pre-extracted grounded context from Brave's LLM Context API for fast follow-up synthesis

This tool is best used as a first-pass discovery + grounding helper. For deeper browsing, open returned URLs with your external web tools.

## Auth

Create a `.env` file at the **toolbelt root** (next to `toolbelt/package.json`), not inside `packages/brave-search/`:

```bash
BRAVE_SEARCH_API_KEY=your-brave-api-key
```

The tool also respects an already-exported `BRAVE_SEARCH_API_KEY`, but the default workflow is the shared `toolbelt/.env` file.

## Usage

> **Do NOT pass `--help` or `-h`.** Read this file directly for package documentation.

Always run from the target workspace root:

```bash
cd /path/to/huntinwabbit/product-workspace
bun ./toolbelt/packages/brave-search/index.ts web-search [options] <query>
bun ./toolbelt/packages/brave-search/index.ts llm-context [options] <query>
```

### Examples

```bash
cd /path/to/huntinwabbit/product-workspace

# Discover promising URLs to inspect further
bun ./toolbelt/packages/brave-search/index.ts web-search --count 5 "best Bun TypeScript testing patterns"

# Get grounded context for a quick research pass
bun ./toolbelt/packages/brave-search/index.ts llm-context --max-tokens 2048 --threshold strict "React hooks best practices"
```

## Supported options

### Common

| Flag | Meaning |
|------|---------|
| `--count <n>` | Result count |
| `--country <code>` | Country code |
| `--search-lang <lang>` | Search language |
| `--freshness <value>` | Brave freshness filter |

### `web-search`

| Flag | Meaning |
|------|---------|
| `--offset <n>` | Result offset |
| `--safesearch <mode>` | `off`, `moderate`, or `strict` |

`web-search` always forces `extra_snippets=true`.

### `llm-context`

| Flag | Meaning |
|------|---------|
| `--max-urls <n>` | Maximum URLs |
| `--max-tokens <n>` | Maximum token budget |
| `--max-snippets <n>` | Maximum snippets across all URLs |
| `--max-tokens-per-url <n>` | Maximum tokens per URL |
| `--max-snippets-per-url <n>` | Maximum snippets per URL |
| `--threshold <mode>` | `strict`, `balanced`, `lenient`, or `disabled` |
| `--enable-local <true|false>` | Force local recall behavior |

## Output

The tool prints JSON to stdout.

- `web-search` returns a compact result set with `results[]`, `locations[]`, and `moreResultsAvailable`
- `llm-context` returns `sources[]` plus the Brave `grounding` object

## Error cases

| Situation | Behaviour |
|-----------|-----------|
| Missing API key | Errors with instructions to add `BRAVE_SEARCH_API_KEY` to `toolbelt/.env` |
| Missing query | Prints a clear error and exits non-zero |
| Unknown flag | Errors and exits non-zero |
| Brave API returns non-2xx | Surfaces HTTP status and response body excerpt |

## Running validation

```bash
cd /path/to/huntinwabbit/product-workspace/toolbelt
bun test packages/brave-search/lib.test.ts
bun run signoff
```

> **All features and changes must be verified by tests first and then by the shared Biome pass.** During iteration, run the package test directly. Before final sign-off for any work in `toolbelt`, run `bun run signoff` from the repo root.
