---
parent: "[[product-workspace.AGENTS]]"
date: 2026-03-16
title: "Workspace Style Guide: Links, Sourcing, and Writing"
category: "reference"
---

# Workspace Style Guide: Links, Sourcing, and Writing

> **Canonical research standard → [[RESEARCH.METHODOLOGY.AGENTS]] (vault root).** This guide is a local quick aid.

**How we write, link, cite, and organize information in this workspace.**

---

## Quick Reference

| Element | Format | Example |
|---------|--------|---------|
| **External URL** | `[Text](https://example.com)` | [Khyentse Foundation](https://khyentsefoundation.org) |
| **Internal file** | `[[filename]]` | [[findings/07-khyentse-foundation-deep-dive]] |
| **Organization first mention** | `[[Name]]` | [[Khyentse Foundation]] is based in... |
| **Person first mention** | `[[Full Name]]` | [[Dzongsar Khyentse Rinpoche]] founded... |
| **Source attribution** | `[Link](url)` after claim | Distributed $7M in grants. [Source](https://www...) |
| **Footnote** | `[^1]` + `[^1]: url` | See details.[^1] \n [^1]: https://... |

---

## Part 1: URLs & External Links

### Rule: Always use inline Markdown links

❌ **WRONG** — Bare URLs or text without link:
```markdown
For more info, visit https://khyentsefoundation.org
See the website for details.
```

✓ **RIGHT** — Inline Markdown link:
```markdown
For more info, visit [https://khyentsefoundation.org](https://khyentsefoundation.org)
See the [Khyentse Foundation website](https://khyentsefoundation.org) for details.
```

### Rule: Link text should be meaningful

❌ **WRONG** — Generic link text:
```markdown
[Click here](https://khyentsefoundation.org)
[Link](https://khyentsefoundation.org)
```

✓ **RIGHT** — Descriptive link text:
```markdown
[Khyentse Foundation official website](https://khyentsefoundation.org)
[Khyentse Foundation Grants & Scholarships page](https://khyentsefoundation.org/grants-and-scholarships/)
```

### Rule: URL domain in link text when it's a direct reference

```markdown
**Format**:
The [BDRC website](https://www.bdrc.io) hosts the digital archive.

**Alternative** (when mentioning a resource):
More details are available at the [[BDRC|Buddhist Digital Resource Center]]
[official site](https://www.bdrc.io).
```

---

## Part 2: Internal Links (Obsidian Wiki Style)

### Rule 1: Use `[[WikiLink]]` for all internal files

**Every mention of a file** should be a wiki link (unless it's code, a filename being discussed, etc.):

```markdown
✓ DO:
See [[findings/07-khyentse-foundation-deep-dive]] for full analysis.
[[Buddhist Digital Resource Center (BDRC)]] was founded in 2000.
[[Dzongsar Khyentse Rinpoche]] is the founder.

✗ DON'T:
See findings/07-khyentse-foundation-deep-dive for full analysis.
Buddhist Digital Resource Center was founded in 2000.
Dzongsar Khyentse Rinpoche is the founder.
```

### Rule 2: Use piped links for clarity when needed

If the exact filename is awkward, use a piped link:

```markdown
**Format**: `[[filename|Display Text]]`

**Examples**:
[[findings/07-khyentse-foundation-deep-dive|Khyentse Foundation deep dive]]
[[Khyentse Foundation|The foundation]] has $51.6M in assets.
[[Buddhist Digital Resource Center (BDRC)|BDRC]] digitizes texts.
```

### Rule 3: Link organizations on first mention only

First mention = always link. Subsequent mentions = optional (usually don't re-link):

```markdown
[[Khyentse Foundation]] is a nonprofit founded in 2001.
The foundation (or it) has distributed $7.77M in grants annually.
Khyentse Foundation also supports [[BDRC]].
```

### Rule 4: Create dedicated files for frequently mentioned organizations

If you mention an org 3+ times in a finding, consider creating a dedicated file:

```
./research/<project-name>/findings/XX-organization-name.md
```

Then all references link to it:
```markdown
[[Khyentse Foundation]] is...
[[BDRC]] digitizes...
```

### Rule 5: Capitalize properly for wiki links

Use the canonical name the organization uses:
```markdown
✓ [[Khyentse Foundation]] (official name)
✓ [[Buddhist Digital Resource Center (BDRC)]] (full name + acronym)
✗ [[khyentse foundation]] (not capitalized)
✗ [[BDRC]] (without full name, unless already established in file)
```

---

## Part 3: Source Attribution

### Rule 1: Every factual claim needs a source

**Claim** (what you're saying) **→ Evidence** (details) **→ Source** (where it came from)

#### Inline source attribution

```markdown
Khyentse Foundation distributed $7.77M in grants in 2024.
[Instrumentl 990 Report](https://www.instrumentl.com/990-report/khyentse-foundation)
```

#### With access date

```markdown
Khyentse Foundation supports technology projects.
[BDRC Launches Major Initiative to Build Open Buddhist Datasets for AI](https://www.bdrc.io/blog/2026/02/28/bdrc-launches-major-initiative-to-build-open-buddhist-datasets-for-ai/)
(Feb 28, 2026; accessed Mar 16, 2026)
```

#### Multiple sources for important claims

```markdown
[[Khyentse Foundation]] funds technology initiatives
([BDRC AI Datasets](https://www.bdrc.io/blog/2026/02/28/...) +
[Khyentse text preservation page](https://khyentsefoundation.org/what-we-do/core-activities/text-preservation/))
```

### Rule 2: Use footnotes for dense sections

When a paragraph has many citations, use footnotes:

```markdown
According to recent research, Khyentse Foundation has supported Buddhist
digitization efforts for over 25 years.[^1] The organization has distributed
$7.77M in grants annually.[^2] Their largest partnership is with BDRC.[^3]

[^1]: https://khyentsefoundation.org/story/the-buddhist-digital-resource-center-celebrates-25-years-of-preserving-buddhist-literature/
[^2]: https://www.instrumentl.com/990-report/khyentse-foundation
[^3]: https://khyentsefoundation.org/what-we-do/core-activities/text-preservation/
```

### Rule 3: Include access date in frontmatter

Every findings file must list sources with access dates:

```yaml
sources:
  - name: "BDRC AI Initiative Announcement"
    url: "https://www.bdrc.io/blog/2026/02/28/..."
    accessed: 2026-03-16
  - name: "Khyentse Foundation 990 Report"
    url: "https://www.instrumentl.com/990-report/khyentse-foundation"
    accessed: 2026-03-16
```

---

## Part 4: Organization & Person Names

### Organizations

**First mention** = full name + wiki link + context:
```markdown
[[Khyentse Foundation]] is a nonprofit founded in 2001 by
[[Dzongsar Khyentse Rinpoche]]. It is based in San Francisco, CA.
```

**Subsequent mentions** = can use short form:
```markdown
The foundation distributed $7.77M in grants last year.
Khyentse also supports [[BDRC]] and [[Fragile Palm Leaves Foundation]].
```

**Abbreviations** = introduce on first use:
```markdown
The [[Buddhist Digital Resource Center (BDRC)]] is a...
BDRC has digitized...
```

### People

**First mention** = full name + title + wiki link:
```markdown
[[Dzongsar Khyentse Rinpoche]] is a Tibetan Buddhist teacher and founder of Khyentse Foundation.

[[Jann Ronis]], Executive Director of [[BDRC]], oversees digitization efforts.
```

**Subsequent mentions** = last name or title:
```markdown
Ronis has led the organization for over a decade.
Rinpoche's vision guides the foundation's strategy.
```

---

## Part 5: Markdown Formatting Standards

### Headings
```markdown
# H1 — Use ONLY for main document title
## H2 — Major sections
### H3 — Subsections
#### H4 — Detailed subsections
(Avoid H5+ — if you need deeper nesting, reconsider structure)
```

### Lists

**Unordered** (use when order doesn't matter):
```markdown
- Item 1
- Item 2
- Item 3
```

**Ordered** (use for steps, priorities):
```markdown
1. First step
2. Second step
3. Third step
```

**Definition/Description** (use for field lists):
```markdown
**Key Name**: Description or value
**Another Key**: Related description
```

### Bold & Emphasis

```markdown
**Bold** for emphasis, key terms, labels
*Italic* for citations, references, mild emphasis
***Bold + Italic*** for critical terms (use sparingly)
```

### Blockquotes

Use for direct quotes or important highlighted info:
```markdown
> "To actualize the vision of Dzongsar Khyentse Rinpoche to preserve
> and promote Buddha's wisdom through financial support..."
```

### Code & Technical References

For filenames, commands, or technical terms:
```markdown
Use `inline code` for specific filenames, URLs within text, commands
Use multi-line code blocks for examples or longer code snippets
```

---

## Part 6: Frontmatter Standards

Every `.md` file in research/projects should have this structure:

```yaml
---
parent: "[[project-or-research-name]]"
date: YYYY-MM-DD
title: "Clear, descriptive title"
category: "category-type"
related:
  - "[[link-to-related-file]]"
  - "[[link-to-related-file]]"
tags:
  - tag-1
  - tag-2
  - tag-3
sources:
  - name: "Source Name"
    url: "https://example.com"
    accessed: YYYY-MM-DD
---
```

**Field meanings:**
- `parent`: Obsidian link to parent container (research project, project, etc.)
- `date`: ISO date file was created/updated
- `title`: Human-readable title (not filename)
- `category`: Type of file (research-findings, planning, summary, etc.)
- `related`: 2-3 cross-references to related files
- `tags`: Searchable keywords (lowercase, hyphenated)
- `sources`: List of all sources with URLs and access dates

---

## Part 7: Common Patterns

### Claim + Evidence + Source Pattern

```markdown
## Finding Title

**Claim**: [One-sentence assertion]

**Evidence**: [Supporting details, quotes, numbers]

**Source**: [URL link to source]

**Related findings**:
[[Link to related finding 1]]
[[Link to related finding 2]]
```

### Reference Tables with Sources

```markdown
| Organization | Grant | Program | Source |
|--------------|-------|---------|--------|
| [[BDRC]] | Varies | Text Preservation | [Khyentse 990](https://instrumentl.com/...) |
| [[FPL]] | Varies | SE Asian texts | [Khyentse page](https://khyentsefoundation.org/...) |
```

### Key Findings Summary

```markdown
## Key Finding

**Bottom line**: [One sentence summary]

**Evidence**:
- Point 1 with source
- Point 2 with source
- Point 3 with source

**Why it matters**: [Implications]

**Related**: [[Link to related files]]
```

---

## Part 8: Link Maintenance

### Check links periodically

Every 3 months:
- Verify external links are still active
- Check that internal wiki links resolve
- Update source information if access dates are stale

### Updating links

When restructuring:
- Rename files carefully (wiki links auto-update in Obsidian)
- Use `[[old-name|new-name]]` temporarily during transitions
- Update `parent:` fields in moved files

---

## Part 9: Writing Tone

### For research findings:
- **Objective** — Present facts, not opinions
- **Sourced** — Every claim traceable to a source
- **Clear** — Assume reader is intelligent but unfamiliar with domain
- **Actionable** — End with implications or next steps

### For project documents:
- **Direct** — Clear statements, not hedged language
- **Concrete** — Specific dates, amounts, examples
- **Linked** — Cross-reference related work
- **Organized** — Logical flow, clear structure

### For summaries:
- **Concise** — Remove fluff
- **Hierarchical** — Important facts first, details below
- **Navigable** — Many internal links for exploration
- **Complete** — Cover scope fully, point to depth elsewhere

---

## Part 10: Example of Perfectly Styled Research Finding

```markdown
---
parent: "[[wisdom-vault-research]]"
date: 2026-03-16
title: "Khyentse Foundation Technology Funding"
category: "research-findings"
related:
  - "[[findings/03-nonprofit-funding]]"
  - "[[projects/2026-03-12-wisdom-vault]]"
tags:
  - khyentse-foundation
  - tech-funding
  - buddhist-funding
sources:
  - name: "BDRC AI Initiative Announcement"
    url: "https://www.bdrc.io/blog/2026/02/28/bdrc-launches-major-initiative-to-build-open-buddhist-datasets-for-ai/"
    accessed: 2026-03-16
  - name: "Khyentse Foundation Text Preservation Page"
    url: "https://khyentsefoundation.org/what-we-do/core-activities/text-preservation/"
    accessed: 2026-03-16
---

# Khyentse Foundation Technology Funding

## Finding: Khyentse Funds Tech Projects

**Claim**:
[[Khyentse Foundation]] actively funds technology projects in Buddhist knowledge preservation.

**Evidence**:
In December 2025, [[Khyentse Foundation]] funded [[Buddhist Digital Resource Center (BDRC)]]
to create open-source Tibetan Buddhist datasets for AI. This is one of the largest AI
initiatives in the Buddhist world, with 26 million images processed through OCR in the
first two months.

**Source**:
[BDRC Launches Major Initiative to Build Open Buddhist Datasets for AI](https://www.bdrc.io/blog/2026/02/28/bdrc-launches-major-initiative-to-build-open-buddhist-datasets-for-ai/)
(Feb 28, 2026)

## Implications

This demonstrates [[Khyentse Foundation]] is an excellent funding match for
[[projects/2026-03-12-wisdom-vault|Wisdom Vault]] because:

1. They fund technology projects (proven)
2. They support nonsectarian approaches (core value)
3. They prioritize accessibility and preservation (mission alignment)

## See Also

- [[findings/07-khyentse-foundation-deep-dive]] — Complete Khyentse analysis
- [[findings/03-nonprofit-funding]] — Broader funding landscape
- [[Buddhist Digital Resource Center (BDRC)]] — Organization profile
```

---

## Summary for Writing in This Workspace

| Element | Pattern | Example |
|---------|---------|---------|
| **External URL** | `[Text](url)` | [Khyentse Foundation](https://khyentsefoundation.org) |
| **Internal file** | `[[filename]]` | [[findings/07-khyentse-foundation-deep-dive]] |
| **Organization** | `[[Full Name]]` | [[Khyentse Foundation]] |
| **Person** | `[[Full Name]]` | [[Dzongsar Khyentse Rinpoche]] |
| **Source** | `[Link](url)` after claim | …distributed $7M. [Source](https://…) |
| **Footnote** | `[^1]` + `[^1]: url` | Text[^1] \n [^1]: https://… |
| **Frontmatter** | Always include parent, related, sources | See Part 6 |
| **Headings** | `## H2` for sections, `### H3` for subsections | Don't skip levels |
| **Lists** | Unordered `- ` or ordered `1. ` | Be consistent |
| **Emphasis** | `**bold**`, `*italic*` | Use for key terms, sources |

---

## Questions?

- **How to source research?** → [[RESEARCH_METHODOLOGY]]
- **Quick reference?** → [[RESEARCH_QUICK_REFERENCE]]
- **How do agents work?** → [[product-workspace.AGENTS]]
- **General workspace rules?** → [[product-workspace.AGENTS]]

---

*Style guide established: 2026-03-16*
*Version: 1.0*
