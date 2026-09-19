# Repository documentation maintenance

This folder owns structural documentation validation adapted from Sanctum. Read the
[root guide](../AGENTS.md) for workflow and the [parity record](../docs/development-process.md) for
provenance. There is no root npm package; these scripts use Node's standard library.

## Commands and owners

Run from the repository root on the Node version pinned by either app:

```bash
node --test scripts/documentation-structure.test.mjs
node scripts/check-documentation.mjs
```

Use `--json` on the second command for machine-readable results. The checker is read-only and exits
nonzero on structural failures. [check-documentation.mjs](check-documentation.mjs) locates the repo
and loads [documentation-policy.json](documentation-policy.json);
[documentation-structure.mjs](documentation-structure.mjs) owns enumeration and checks.

The policy classifies current docs, historical source notes, workspace notes and incident reports.
Git enumeration includes tracked and unignored new files, so missing ownership can be detected
before staging. Ignored dependencies, generated output and `temp/` reference clones are not scanned
unless accidentally tracked. Symlink aliases are checked separately from document bodies.

The audit checks local Markdown inline links and target headings, repository escapes, feature
barrels, project-guide coverage, selected document indexes, deprecated locations and required
`CLAUDE.md -> AGENTS.md` symlinks. Maintain the policy when adding documentation roots or indexes.
Workspace project/research entry indexes are checked without treating all historical notes as current
product documentation.
The source-brand guide under `assets/` is current documentation and is indexed by the root guide.

## Limits and verification

This is a structural guard, not a Markdown parser, secret scanner or truth verifier. It does not
validate remote links, inline-code paths, reference-style links, same-page fragment-only links,
all wiki links, arbitrary orphan documents or factual claims. Relative links are resolved against
the filesystem; a target's existence alone does not prove it is committed. Review the staged diff
and keep durable docs independent of ignored scratch/reference files.

[Tests](documentation-structure.test.mjs) cover ownership, globs, missing/escaping links, headings,
barrel/index coverage, feature directories, deleted files and aliases. Test fixtures are removed
at suite completion. Run both commands after changes to checker logic or policy, and validate the
real repository before handoff. Do not silence a structural failure by reclassifying a current
contract as historical.
