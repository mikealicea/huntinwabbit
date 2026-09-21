---
parent: "[[YYYY-MM-DD-example-topic.index]]"
date: YYYY-MM-DD
title: "{{Project Name}} — Methodology & Master Question List"
category: "methodology"
related:
  - "[[YYYY-MM-DD-example-topic.index]]"
tags:
  - methodology
  - research-hub
---

# {{Project Name}} — Methodology & Master Question List

<!--
OPTIONAL FILE — keep only for complex / long-running projects that benefit from a master question list
and a contributor workflow. Delete otherwise. This is the single hub for how this project is built and
how to expand it.
-->

> This project inherits the [[RESEARCH.METHODOLOGY.AGENTS|canonical vault standard]]. Below are the
> **project-specific** rules and the running question list. Start here to add to the research.

## 1. Project-specific rules

<!-- Only what differs from the canonical standard. e.g. the fact-vs-doctrine rule for interpretive topics. -->
1. {{Rule}}
2. {{Rule}}

## 2. Structure

```
findings/
├── 01-...   {{topic band}}
├── 02-...   {{topic band}}
└── NN-...
```

## 3. Master Question List

<!-- Check a box when a finding answers it. Add freely. Link each to its finding. -->

- [ ] {{Question}} → [[findings/01-example-finding]]
- [ ] {{Question}}
- [ ] {{Question}}

### Expansion backlog (future deep-dives)
- [ ] {{Future question}}

## 4. How to expand this project

1. Pick or add a question above.
2. Create `findings/NN-descriptive-name.md` with full frontmatter (see the standard, Part 3).
3. Research with toolbelt tools; source every claim; wiki-link every entity on first mention.
4. Cross-link the new finding (`related:` + `## See Also`) and **add it to the index**.
5. Tick the box.

## See Also

- [[YYYY-MM-DD-example-topic.index]] — project index
- [[RESEARCH.METHODOLOGY.AGENTS]] — canonical standard
