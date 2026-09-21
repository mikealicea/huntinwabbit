---
parent: "[[product-workspace.AGENTS]]"
date: 2026-03-16
updated: 2026-06-22
title: "Research Methodology — Canonical Vault Standard"
category: "methodology"
tags:
  - methodology
  - research
  - standards
  - vault-wide
  - obsidian
---

# Research Methodology — Canonical Vault Standard

> **This is the single source of truth for how research is done anywhere in this vault.**
> The huntinwabbit-boilerplate workspace uses this standard. Its `RESEARCH_METHODOLOGY.md` file only
> record local *deltas* on top of it. When you start any research, read this first, then the workspace
> delta file, then copy the scaffold from [`examples/research/`](./examples/research/) (the
> `[[examples-research-README|copyable example]]`).

Good research in this vault is **navigable in Obsidian first** (everything linked into the graph),
**verifiable** (every claim is sourced), **maintainable** (consistent structure and frontmatter), and
**machine-readable** (structured `sources:` and `tags:` so future agents can reuse it).

All web research is done through the **[[toolbelt.AGENTS|toolbelt]] `brave-search` tool** (preferred) or the agent
harness's own search capability. See Part 7 for commands and priority order.

---

## Part 0: This is an Obsidian vault — navigation is the point

**Read this part before anything else. It is the most important rule in this document.**

The `product-workspace/` folder is **one Obsidian vault**, and all research will be read, explored, and connected
**inside Obsidian** — through the graph view, backlinks panel, and `[[wiki link]]` autocomplete, not by
browsing folders. A research note that isn't linked is, for practical purposes, **invisible**. Folders
give local structure; **links are how every idea, finding, source, organization, person, and project is
actually traversed across time.** Optimize relentlessly for that.

Non-negotiable navigation rules — these are restated with detail later, collected here so they are never missed:

1. **Nothing is an orphan.** Every note has at least one inbound link (from its index/parent) **and**
   2–3 outbound links to related notes. If you can't reach a note by clicking links from the workspace
   research index, it is broken.
2. **Enter through an index.** Every project has a `*.index.md` that links to every finding. Every
   workspace has a research index that links to every project. You should be able to start at the vault
   root and reach any finding by following links.
3. **Link every entity on first mention.** Every organization, person, project, institution, tool, or
   recurring concept gets a `[[wiki link]]` the first time it appears — even if the target note doesn't
   exist yet. An unresolved `[[link]]` is not an error; it is a *placeholder that grows the graph* and
   tells Obsidian where a future note belongs.
4. **Internal = `[[wiki links]]`. External = `[markdown](url)`.** Never use a bare URL; never use a
   markdown link to point at another vault note.
5. **Backlinks are a feature you design for.** Create stub notes for entities mentioned 3+ times so every
   mention collects under that note's backlinks panel and gives instant context.
6. **Update the index whenever you add a note**, so the graph never drifts out of sync with the files.
7. **Use stable, descriptive, link-friendly filenames** — they appear verbatim as backlink text in Obsidian.

If a choice ever trades off "easier to write" against "easier to navigate in Obsidian," choose navigation.

---

## Part 1: Canonical project structure

Every research effort is a **dated project folder** inside a workspace's `research/` directory.

```
product-workspace/research/
└── YYYY-MM-DD-project-slug/
    ├── YYYY-MM-DD-project-slug.index.md     ← REQUIRED — navigation hub & rolled-up answers
    ├── YYYY-MM-DD-project-slug.plan.md      ← REQUIRED — questions, scope, sources to check
    ├── YYYY-MM-DD-project-slug.methodology.md  ← optional — project methodology hub (complex projects)
    ├── sources-guide.md                     ← optional — bias/reliability ratings (contested topics)
    └── findings/                            ← REQUIRED — atomic, sourced, cross-linked findings
        ├── 01-descriptive-name.md
        ├── 02-descriptive-name.md
        └── NN-descriptive-name.md
```

**Minimum viable project** = `*.index.md` + `*.plan.md` + `findings/` with at least one finding.
Everything else is optional and added only when the research actually needs it (see Part 8 variants).

### Naming rules

- **Project folder & top-level files**: `YYYY-MM-DD-project-slug` where the date is the **creation date**
  (never the last-updated date — track updates in frontmatter `updated:`). Slug is kebab-case.
- **Top-level companion files**: prefix with the full project name, e.g.
  `YYYY-MM-DD-project-slug.plan.md`, `YYYY-MM-DD-project-slug.summary.md`. This keeps them readable as
  backlinks in Obsidian.
- **Findings files**: `NN-descriptive-name.md` with a **two-digit** numeric prefix.
- **Numbering bands** (large projects): reserve number ranges for topic groups so the project can grow
  without renumbering — e.g. `01–07` components, `10–19` systems, `20–29` mechanics, `40–49` personal
  application. Keep bands stable as the project expands.

---

## Part 2: File roles

| File | Required? | Role | Audience |
|------|-----------|------|----------|
| `*.index.md` | ✅ | Entry point. Executive summary / decision, rolled-up findings (each `→ See [[findings/NN]]`), action plan, status. Links to **every** finding. | Decision-maker |
| `*.plan.md` | ✅ | Research questions, scope (in/out of bounds), depth decision, sources to check, context/trigger. | Researcher |
| `findings/NN-*.md` | ✅ | One atomic, fully-sourced finding. Claim → Evidence → Source. Cross-linked. | Everyone |
| `*.methodology.md` | optional | Project methodology hub: local rules + master question list with checkboxes + how-to-expand workflow. Use for complex/long-running projects. | Contributor |
| `sources-guide.md` | optional | Bias & reliability ratings for every outlet used. Use for contested/multi-outlet topics. | Auditor |
| `*.summary.md` / `*.RESEARCH_SUMMARY.md` | optional | Narrative synthesis across findings. | Decision-maker |
| `*.DELIVERABLES.md` | optional | Concrete recommendations / decisions / next actions. | Decision-maker |
| `*.QUICK_START.md` | optional | Step-by-step or week-by-week execution roadmap. | Implementer |
| `*.sources-index.md` | optional | Master registry of every source used across the project. | Auditor |

Add optional files only when they earn their place — don't create empty companions for the sake of completeness.

---

## Part 3: Frontmatter schemas

Every file in a research project carries YAML frontmatter. Required fields per type below. The `parent:`
and `related:` fields are what wire the note into the Obsidian graph — they are mandatory, not decorative.

### Findings file (the strictest)

```yaml
---
parent: "[[YYYY-MM-DD-project-slug.index]]"   # always links back to the project index
date: 2026-06-22                               # ISO date the finding was created
updated: 2026-06-22                            # optional; set when materially revised
title: "Topic — Detailed Findings"
category: "research-findings"
related:                                        # ≥ 2–3 cross-links (findings and/or projects)
  - "[[findings/02-related-topic]]"
  - "[[findings/03-another-topic]]"
tags:                                           # lowercase, hyphenated, searchable
  - topic-keyword
  - subtopic
  - 2026
sources:                                        # structured list — name + url + accessed
  - name: "Source Title"
    url: "https://example.com/page"
    accessed: 2026-06-22
  - name: "Second Source"
    url: "https://example.com/other"
    accessed: 2026-06-22
---
```

### Index file

```yaml
---
parent: "[[huntinwabbit-boilerplate-research]]"     # links the project into the workspace research index
date: 2026-06-22
updated: 2026-06-22            # keep current as findings are added
title: "Project Name — Research Index"
category: "research"          # or "research-project"
related:
  - "[[findings/01-first-finding]]"
  - "[[findings/02-second-finding]]"
tags:
  - primary-topic
  - 2026
sources: []
---
```

### Plan file

```yaml
---
parent: "[[YYYY-MM-DD-project-slug.index]]"
date: 2026-06-22
title: "Research Plan: Project Name"
category: "research-plan"
related:
  - "[[huntinwabbit-boilerplate-research]]"
tags:
  - primary-topic
sources: []
---
```

### Methodology hub & sources-guide

Use `category: "methodology"` for the project methodology hub and `category: "research-meta"` for the
sources-guide. Both link `parent:` to the project index and carry `related:` + `tags:`.

**Field rules:**
- `parent:` is always a wiki link (single value or array form both fine).
- `date:` / `updated:` / `accessed:` are ISO 8601 (`YYYY-MM-DD`).
- `related:` on findings must have **at least 2–3** real cross-references.
- `sources:` is a YAML **array of `{name, url, accessed}`** — not inline markdown.
- `tags:` are lowercase, hyphenated, and consistent across the project (they power Obsidian tag search).

---

## Part 4: Linking & the Obsidian graph (the core discipline)

This is where most of the value lives. Treat linking as a first-class deliverable, not cleanup.

### Internal vs external links

- **Internal references** (any other note in the vault) use Obsidian wiki links: `[[Note Name]]` or
  `[[Note Name|display text]]`. Piped links keep prose readable: `[[2026-06-08-business-banking-setup.index|the banking research]]`.
- **External URLs** use markdown links: `[text](https://url)` — **never bare URLs**, never wiki-link an
  external site.

### Link every entity on first mention

Every organization, person, project, institution, tool, or recurring concept gets a `[[wiki link]]` the
first time it appears in a note:

```markdown
[[Khyentse Foundation]] distributed $7.77M in grants in 2024.
[[Dzongsar Khyentse Rinpoche]] founded it in 2001.
This informs [[2026-03-12-wisdom-vault.index|the Wisdom Vault project]].
```

Unresolved links are **good** — they appear greyed-out in Obsidian and mark exactly where the next note
should go. Linking liberally is how the graph grows.

### Create stub notes for recurring entities

If an org/person/concept is mentioned **3+ times**, give it its own note so every mention collects under
its backlinks:

```markdown
---
parent: "[[project.index]]"
date: 2026-06-22
title: "Buddhist Digital Resource Center (BDRC)"
category: "research-findings"
org: true
website: https://www.bdrc.io
---

# Buddhist Digital Resource Center (BDRC)

Quick facts. Then link onward.

## See Also
- [[findings/07-khyentse-foundation-deep-dive]] — funds BDRC
- [[findings/04-dharma-transcription-space]] — BDRC's transcription work
```

### No orphans, ever

- Every finding links back to its index via `parent:` **and** to 2–3 related notes via `related:` + inline links.
- Every project index links to **every** finding, and links up to the workspace research index via `parent:`.
- A `## See Also` section at the bottom of each finding is the standard place for outbound navigation links.
- **Update the index every time you add a note** so the graph and the filesystem never diverge.
- Tables carry sources too — include a Source column with markdown links, and wiki-link entities in cells:

```markdown
| Organization | Grant | Program | Source |
|--------------|-------|---------|--------|
| [[BDRC]] | Varies | Text Preservation | [Khyentse 990](https://www.instrumentl.com/990-report/khyentse-foundation) |
```

### Connect across the vault, not just within the project

When research informs a project or surfaces an insight, link both directions: add the project to the
finding's `related:`, and add the finding to the project note's frontmatter. Cross-workspace links are
encouraged — that's how the graph becomes genuinely useful in Obsidian.

---

## Part 5: Sourcing & citation

**Rule: every factual claim is traceable to a source.** Statistics, dates, org details, decisions — all sourced.

### Inline citation formats

```markdown
# 1. Inline claim + link
[[Khyentse Foundation]] is based in San Francisco, CA.
[khyentsefoundation.org](https://khyentsefoundation.org)

# 2. Inline claim + labeled link
The foundation distributed $7.77M in grants in 2024.
[990 Report via Instrumentl](https://www.instrumentl.com/990-report/khyentse-foundation)

# 3. Footnote style (for dense sections)
The foundation has $51.6M in assets.[^1]

[^1]: https://www.instrumentl.com/990-report/khyentse-foundation

# 4. Multiple sources for a critical/contested claim
The foundation funds technology projects.
([BDRC AI Initiative](https://www.bdrc.io/blog/2026/02/28/...) +
[Text preservation page](https://khyentsefoundation.org/what-we-do/core-activities/text-preservation/))
```

### Tool attribution

Note the tool when a claim came from one: `[via web_search, 2026-06-22]`,
`[via fetch: https://example.com, 2026-06-22]`, or `[via brave-search, 2026-06-22]`.

### Claim → Evidence → Source structure

Major findings follow this shape:

```markdown
## Finding: <one-line claim>

**Claim**: <the assertion>

**Evidence**: <supporting detail, quotes, numbers — orgs/people wiki-linked>

**Source**: [Title](url) (published DATE; accessed DATE)

**Related**: [[findings/NN-related]] — why it relates
```

For business/decision research, keep the source but add a **Why it matters** beat:
Claim → Evidence → Why it matters → Source.

---

## Part 6: Writing patterns

### Index = decision-first

Open the index with what was **found or decided**, not just what was researched. Then list rolled-up
findings with arrow navigation (each line links to a finding), then an action plan, then status.

```markdown
## Executive Summary
Decision: Mercury selected; application submitted 2026-06-08.

## Key Findings
- Mercury is the fastest zero-fee option → See [[findings/02-bank-options-comparison]]
- Required docs are the EIN letter + Articles of Org → See [[findings/01-documents-required]]

## Action Plan
### Immediate
- [x] Submit Mercury application
### Once approved
- [ ] Move deposits over

## Status & Timeline
Last updated: 2026-06-08 — application pending.
```

### Comparison tables

Use tables for any "X vs Y vs Z" comparison; bold the row labels; keep a Source column; wiki-link entities.

---

## Part 7: Tools

### How research is done — tool priority order

1. **Toolbelt `brave-search`** — the primary search tool for this vault. Use it for all web research.
   Always `cd` to the target workspace first, then invoke with Bun:

   ```bash
   cd /path/to/huntinwabbit-boilerplate/product-workspace

   # Standard web search (returns results list):
   bun ./toolbelt/packages/brave-search/index.ts web-search --count 8 "your query"

   # LLM-ready content bundle (fetches and concatenates page content):
   bun ./toolbelt/packages/brave-search/index.ts llm-context --max-tokens 2048 "your query"
   ```

2. **Harness `web_search`** — the agent harness's built-in search. Use when `brave-search` isn't
   available or a quick follow-up search doesn't warrant a toolbelt call.

3. **Harness `fetch`** — for reading a specific URL directly. Use when you already have the URL and need
   the full page content.  Use `npx @teng-lin/agent-fetch <url>`  for example `npx @teng-lin/agent-fetch https://example.com`

**Always prefer toolbelt tools** when one covers the task (vault-wide rule from [[product-workspace.AGENTS]]).

To discover all available toolbelt tools:
```bash
bun ./toolbelt/packages/list-tools/index.ts
```

For research that depends on **computed data** (charts, calculations, etc.), use the dedicated toolbelt
tool — never hand-compute. See Part 8.4.

---

## Part 8: Advanced patterns (variants — use when applicable)

These are proven in real projects. Apply the ones the topic calls for; ignore the rest.

### 8.1 Interpretive research — separate fact from doctrine

When a topic mixes verifiable scholarship with interpretive/doctrinal claims (astrology, religion,
contested theory), keep them visibly separate:

- **Verifiable claims** (history, authorship, dates, math, mechanics) → cite **academic/primary** sources.
- **Interpretive claims** (what something "means") → **attribute to a tradition or named author**
  ("In Hellenistic doctrine…", "Liz Greene argues…"). Never present interpretation as established fact.


### 8.2 News & politics research — bias-aware labels + sources-guide

**Only use this variant for news/politics research** where outlet bias meaningfully affects the information.
For business, technical, personal, or practical research, just link the source directly — no ratings needed.

When the topic is news or politically contested, attach a **bias label inside the sentence** and maintain
a `sources-guide.md` that rates every outlet (AllSides / MBFC / Ad Fontes) with a label key.

```markdown
The US turned back 78 ships since the blockade began (Reuters, Center · Very High),
while Iran formalized control of the strait (Al Jazeera, Left-Center · High).
Fox framed it as a show of strength (Fox News, Right · Mixed).
```

For all other research, cite sources like this:
```markdown
Mercury has no monthly fees.
[Mercury — Business Banking for LLCs](https://mercury.com/llc-banking)
```

Rules (news/politics only): cite ≥2 bias categories for major developments; keep a dedicated section for
opposing framing; note contradictions rather than silently reconciling them.


### 8.3 Evolving topics — time-series updates

For topics that change over time, add dated update findings instead of rewriting old ones:

- Name: `NN-<date-range>-update.md` (e.g. `09-may-18-2026-update.md`); title states the range explicitly.
- `related:` links to the **previous** update and the foundation findings.
- **Refresh the index completely** each cycle: bump `updated:`, rewrite the status/summary, extend the
  timeline, re-answer core questions (no stale framing), add the new file to the findings table, and
  replace the "Key Unanswered Questions" list.


### 8.4 Computed / tool-backed research

When findings rest on computed data, document the **tool, inputs, and validation**, and put the raw
verified output in its own findings file that downstream findings link to.

Use a suitable tested calculation tool for the topic. The local toolbelt currently provides search
and project scaffolding; check [[toolbelt.AGENTS]] for available packages before naming a tool.

---

## Part 9: Quality checklist

Before finalizing any finding:

- [ ] **Navigation**: reachable by clicking links from the workspace research index (no orphan)
- [ ] `parent:` points to the project index; `related:` has ≥ 2–3 real cross-links
- [ ] Every organization/person is `[[wiki-linked]]` on first mention
- [ ] Internal links are `[[wiki]]`; external links are `[text](url)`; no bare URLs
- [ ] Key orgs/people mentioned 3+ times have their own stub note
- [ ] The index links to this finding (index updated)
- [ ] Every factual claim has a source
- [ ] `sources:` array lists every source with `name`/`url`/`accessed`
- [ ] `tags:` are consistent with the rest of the project
- [ ] The finding reads as a coherent narrative, not just a list

Additional checks for **time-series updates** (8.3):

- [ ] Major developments cite ≥ 2 bias categories
- [ ] Opposing-framing section is specific to this cycle (not generic)
- [ ] New outlets were added to `sources-guide.md`
- [ ] Index status, timeline, core questions, findings table, and open questions are all updated
- [ ] No stale framing from a prior cycle survives in the index

---

## Part 10: Quick reference for agents

1. **Copy the scaffold** from [`examples/research/`](./examples/research/) → rename to `YYYY-MM-DD-slug`.
2. **Write the plan** (questions, scope in/out, sources to check, context).
3. **Research** using toolbelt `brave-search` (primary), then harness `web_search`, then harness `fetch`
   (see Part 7). One finding per atomic topic in `findings/NN-*.md`.
4. **Link as you write**: every fact = one source; every entity = a `[[wiki link]]` on first mention.
5. **Full frontmatter**: `parent`, `date`, `title`, `category`, `related` (≥2–3), `tags`, `sources`.
6. **Cross-link** findings to each other and back to the index; **no orphans**.
7. **Apply the right variant** (Part 8) for the topic type.
8. **Update the index** so it always reflects current state and links every finding.
9. **Run the checklist** (Part 9) before calling it done.

Remember: this lives in Obsidian. If it isn't linked, it doesn't exist.

---

*Canonical standard. Workspace files defer here; record only local deltas there.*
*Defined 2026-03-16 · Unified into the canonical vault standard 2026-06-22.*
