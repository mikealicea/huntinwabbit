# product-workspace.AGENTS-SETUP.md — huntinwabbit Environment Setup

Read [[product-workspace.AGENTS]] and the [root guide](../AGENTS.md) before substantial work.
Application setup and checks belong to [`web/AGENTS.md`](../web/AGENTS.md) and
[`server/AGENTS.md`](../server/AGENTS.md).

Bun runs the workspace's TypeScript toolbelt. Git follows the root branch workflow; use the GitHub
CLI only when the selected process calls for GitHub work.

```bash
# From product-workspace/
bun --version
git --version
cd toolbelt
bun install
cd ..
bun ./toolbelt/packages/list-tools/index.ts
```

API-backed tools read local credentials from `toolbelt/.env`; that file is intentionally omitted
from version control. Read the tool's guide for its credential requirements.
