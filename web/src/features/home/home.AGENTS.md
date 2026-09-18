# Starter home

[HomePage.tsx](HomePage.tsx) renders a static greeting, exported through
[home.index.ts](home.index.ts) and composed by [the root page](../../app/page.tsx).
It has no state, requests, persistence or error recovery. It is not the job-search board described
in the [product README](../../../../README.md).

[HomePage.test.tsx](HomePage.test.tsx) checks the visible heading. Follow the
[web guide](../../../AGENTS.md) and full web gate when changing this feature. When the real home
experience replaces the starter, rewrite this barrel around its user problem, states, ownership,
failure handling and tests; do not preserve the greeting as a compatibility requirement.
