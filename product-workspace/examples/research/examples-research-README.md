---
parent: "[[product-workspace.AGENTS]]"
date: 2026-06-22
title: "Examples — Research Project Scaffold (copy me)"
category: "reference"
related:
  - "[[RESEARCH.METHODOLOGY.AGENTS]]"
tags:
  - reference
  - research
  - template
  - obsidian
---

# Research Project Scaffold — copy this folder

This folder is a **copyable template** for starting a new research project that already follows the
canonical [[RESEARCH.METHODOLOGY.AGENTS|vault research standard]]. The point is that you never have to
re-derive structure, frontmatter, or linking conventions — copy, rename, fill in.

> **Remember the prime directive:** this is an **Obsidian vault**. Everything you write will be explored
> through the graph and backlinks, not the file tree. **Link relentlessly.** A note that isn't linked is
> invisible. See [[RESEARCH.METHODOLOGY.AGENTS|the standard]], Part 0 and Part 4.

---

## How to use it

1. **Copy** the `YYYY-MM-DD-example-topic/` folder into the target workspace's `research/` directory:
   ```bash
   cp -R ./examples/research/YYYY-MM-DD-example-topic \
         ./research/2026-06-22-my-topic
   ```
2. **Rename** the folder and the three `YYYY-MM-DD-example-topic.*` files to your real
   `YYYY-MM-DD-my-topic` slug (date = creation date).
3. **Find-and-replace** the placeholder tokens inside every file:
   - `YYYY-MM-DD-example-topic` → your real slug
   - `{{...}}` and `[...]` placeholders → real content
4. **Delete the optional files you don't need** (see below).
5. **Fill in the plan first**, then research and add findings, then keep the index current.
6. **Run the quality checklist** ([[RESEARCH.METHODOLOGY.AGENTS]] Part 9) before you're done.

---

## What's required vs optional

| File | Keep? | When |
|------|-------|------|
| `*.index.md` | **Required** | Always — it's the navigation hub. |
| `*.plan.md` | **Required** | Always — write it before researching. |
| `findings/01-example-finding.md` | **Required** | Always — at least one finding. |
| `*.methodology.md` | Optional | Complex / long-running projects that need a master question list and contributor workflow. |
| `sources-guide.md` | Optional | Contested or multi-outlet topics needing bias/reliability ratings (Part 8.2). |
| `findings/02-example-update.md` | Optional | Evolving topics tracked over time (Part 8.3). Delete if your topic is a one-time snapshot. |

You can also add the heavier companions from the standard when a project warrants them
(`*.summary.md`, `*.DELIVERABLES.md`, `*.QUICK_START.md`, `*.sources-index.md`) — see
[[RESEARCH.METHODOLOGY.AGENTS]] Part 2.

---

## Which advanced variant applies to your topic?

Match your topic to the variants in [[RESEARCH.METHODOLOGY.AGENTS]] Part 8 and keep only what fits:

- **Interpretive topic** (mixes scholarship with doctrine/opinion) → separate fact from doctrine (8.1).
- **Contested / political / multi-outlet** → bias-aware labels + `sources-guide.md` (8.2).
- **Evolving over time** → time-series update findings + full index refresh each cycle (8.3); keep `02-example-update.md`.
- **Relies on computed data** → document the tool + inputs; never hand-compute (8.4).

---

## See Also

- [[RESEARCH.METHODOLOGY.AGENTS]] — the canonical standard this scaffold implements
- [[product-workspace.AGENTS]] — vault root guidance
