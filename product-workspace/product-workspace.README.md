# huntinwabbit Product Workspace

Research, projects, insights, and decisions in formation for huntinwabbit's job-search workspace.
Start with the [repository README](../README.md) for product direction and
[[product-workspace.AGENTS]] for workspace rules. The [root guide](../AGENTS.md) owns the repository
workflow; `web/` and `server/` are the primary applications.

Open `product-workspace/` as an Obsidian vault to navigate the `[[wiki links]]`.

## Start here

- [[huntinwabbit-projects]] — project index
- [[huntinwabbit-research]] — research index and methodology
- [[huntinwabbit-insights]] — hypotheses and emerging ideas
- [[product-workspace.AGENTS-SETUP]] — environment setup

The indexes are ready for new huntinwabbit work. Adopted explanations belong in
[`docs/`](../docs/) or the owning feature barrel; link to useful workspace evidence rather than
keeping duplicate specifications.

## Layout

| Path | Contents |
|---|---|
| `projects/` | Dated projects, plans, tasks, and supporting material |
| `research/` | Dated research plus reusable methodology and style guides |
| `insights/` | Directional hypotheses and their index |
| `toolbelt/` | Shared TypeScript CLI tools, tests, and guides |
| `examples/research/` | Copyable research scaffold |
| `_fresh/` | Temporary inbox for uncategorized notes |

## Toolbelt

```bash
# From product-workspace/
cd toolbelt
bun install
cd ..
bun ./toolbelt/packages/list-tools/index.ts
```

API-backed tools use local credentials in `toolbelt/.env`, which must not be committed.
See [[toolbelt.AGENTS]] for validation.

The project generator discovers `huntinwabbit-projects.md` at the workspace root. Keep that as the
single root `*-projects.md` index so generated parent links resolve correctly.
