---
parent: "[[product-workspace.AGENTS]]"
date: 2026-03-16
title: "Research Quick Reference Card"
category: "reference"
---

# Research Quick Reference Card

> **Canonical research standard → [[RESEARCH.METHODOLOGY.AGENTS]] (vault root).** This card is a local quick aid.

**Use this checklist while researching. Full standards: [[RESEARCH.METHODOLOGY.AGENTS]]** (workspace deltas: [[RESEARCH_METHODOLOGY]])

---

## Every Claim Needs a Source ✓

```markdown
✓ DO:
Khyentse Foundation distributed $7.77M in grants in 2024.
[https://www.instrumentl.com/990-report/khyentse-foundation]

✗ DON'T:
Khyentse Foundation distributed $7.77M in grants.
(no source)
```

---

## Every Organization Gets a Wiki Link ✓

**First mention** = always use `[[WikiLink]]`

```markdown
✓ DO:
[[Khyentse Foundation]] supports all Buddhist traditions.
[[Buddhist Digital Resource Center (BDRC)]] digitizes texts.

✗ DON'T:
Khyentse Foundation supports all Buddhist traditions.
BDRC digitizes texts.
```

**With label** (for clarity):
```markdown
[[Khyentse Foundation|The foundation]] has $51.6M in assets.

[[Buddhist Digital Resource Center (BDRC)|BDRC]] was founded in 2000.
```

---

## Frontmatter Template ✓

Every findings file starts with:

```yaml
---
parent: "[[wisdom-vault-research.index]]"
date: 2026-03-16
title: "Topic Name"
category: "research-findings"
related:
  - "[[other-findings-file]]"
  - "[[related-project]]"
tags:
  - topic-tag
  - finding-type
sources:
  - name: "Source Name"
    url: "https://example.com"
    accessed: 2026-03-16
---
```

**Key fields you MUST fill:**
- `parent` — Link to the research index note
- `related` — At least 2-3 related findings
- `tags` — Searchable keywords
- `sources` — List of all sources with URLs

---

## Link Types ✓

| Type | Syntax | Use For |
|------|--------|---------|
| **Internal File** | `[[filename]]` | Link to research file, org file, project |
| **Wiki Link + Label** | `[[filename\|Display Text]]` | Same, but custom label |
| **External URL** | `[Text](https://example.com)` | Web links, citations, sources |
| **Footnote URL** | `[^1]` + `[^1]: https://...` | Dense sections with many links |

```markdown
# Example of each:

See [[findings/03-nonprofit-funding]] for more on grants.

For details, see [[Khyentse Foundation|the foundation's]] website:
[https://khyentsefoundation.org](https://khyentsefoundation.org)

According to recent analysis:[^1]

[^1]: https://www.bdrc.io/blog/2026/02/28/bdrc-launches-major-initiative-to-build-open-buddhist-datasets-for-ai/
```

---

## Claim → Evidence → Source Pattern ✓

Every major finding should follow this structure:

```markdown
## Finding Title

**Claim**: [What you're saying in one sentence]

**Evidence**: [Details, quotes, numbers that support it]

**Source**: [URL or attribution link]

**Related findings**: [[Link to related findings]]
```

**Example:**

```markdown
## Khyentse Funds Tech Projects

**Claim**: Khyentse Foundation actively funds technology projects
in Buddhist knowledge preservation.

**Evidence**: In December 2025, [[Khyentse Foundation]] funded
[[BDRC]] to build open-source Buddhist datasets for AI. This is
one of the largest AI initiatives in the Buddhist world.

**Source**:
[BDRC Launches Major Initiative...](https://www.bdrc.io/blog/2026/02/28/...)
(Feb 28, 2026)

**Related findings**:
[[findings/07-khyentse-foundation-deep-dive]],
[[findings/01-existing-platforms]]
```

---

## Organization Mentions ✓

### First mention = Always link

```markdown
✓ DO:
[[Khyentse Foundation]] was founded by [[Dzongsar Khyentse Rinpoche]]
in 2001. It supports [[Buddhist Digital Resource Center (BDRC)]],
[[Fragile Palm Leaves Foundation]], and others.

✗ DON'T:
Khyentse Foundation was founded by Dzongsar Khyentse Rinpoche in 2001.
It supports BDRC, FPL, and others.
```

### Create files for frequently mentioned orgs

If you mention an org 3+ times, create a file for it:
```
./research/<project-name>/findings/XX-organization-name.md
```

Then link to it:
```markdown
[[Buddhist Digital Resource Center (BDRC)]] is a...
```

---

## Table Format with Sources ✓

```markdown
| Organization | Grant | Program | Source |
|--------------|-------|---------|--------|
| [[BDRC]] | Varies | Text Preservation | [Khyentse 990](https://instrumentl.com/...) |
| [[Fragile Palm Leaves]] | Varies | SE Asian texts | [Khyentse page](https://khyentsefoundation.org/...) |
```

---

## Before Finalizing Research: Checklist ✓

- [ ] Every factual claim has a source (URL or attribution)
- [ ] Every organization is `[[wiki-linked]]` on first mention
- [ ] All URLs are active (quick test by visiting)
- [ ] `parent:` field in frontmatter matches research project
- [ ] `related:` field has 2-3 related findings
- [ ] `sources:` section lists all sources with URLs + access dates
- [ ] `tags:` are consistent with other findings
- [ ] Key people have dedicated files if mentioned 3+ times
- [ ] Cross-links between findings are in place
- [ ] No orphaned files (every finding is discoverable)

---

## Common Mistakes ✗

| Mistake | Fix |
|---------|-----|
| "Khyentse distributed $7.77M" (no source) | Add `[source-url]` after claim |
| Mention "BDRC" without linking | Use `[[Buddhist Digital Resource Center (BDRC)]]` |
| "See the website for more info" | Use `[Khyentse Foundation](https://...)` |
| Frontmatter missing `related:` field | Add at least 2-3 related files |
| Frontmatter missing `sources:` field | Add structured list of sources |
| Files not linked to each other | Add cross-references via `[[links]]` |

---

## Quick Copy-Paste Templates

### Source Citation (Inline)
```markdown
[Source: Organization Name](https://example.com) (accessed YYYY-MM-DD)
```

### Source Citation (Footnote)
```markdown
According to recent research,[^1]

[^1]: https://example.com (accessed 2026-03-16)
```

### Frontmatter (Minimal)
```yaml
---
parent: "[[wisdom-vault-research]]"
date: 2026-03-16
title: "Finding Title"
category: "research-findings"
related:
  - "[[findings/XX]]"
  - "[[projects/YYYY-MM-DD-name]]"
sources:
  - name: "Source Name"
    url: "https://example.com"
    accessed: 2026-03-16
---
```

### Organization Link (New)
```markdown
[[New Organization Name|Custom Display]] is based in [City].
[Website](https://example.com) | Founded: YYYY
```

---

## Need More Details?

See [[RESEARCH.METHODOLOGY.AGENTS]] for the canonical standard and
[[RESEARCH_METHODOLOGY]] for local decision-first guidance.

- Parts 1–3: Project structure, file roles, and frontmatter
- Part 4: Links and navigation
- Part 5: Sourcing and citation
- Part 6: Writing patterns
- Part 7: Research tools
- Part 8: Advanced patterns
- Part 9: Quality checklist

---

**TL;DR**: Source every claim. Link every organization. Use frontmatter. Cross-link findings. Done.

*Quick reference: 2026-03-16*
