# Job-search presentation contracts

This feature maps saved API records into board and workspace presentation. It owns no mutable
application state. The [API feature](../job-api/job-api.AGENTS.md) owns server data and the
[store](../../state/state.AGENTS.md) owns its account-isolated cache lifetime.

[Types](job-search.types.ts) distinguish posting facts from stage, interest, priority, follow-up and
notes. [Mapping](job-search.mapping.ts) retains the complete saved record and derives summary fields.
Unknown companies stay unknown; source hosts are never treated as employers. The card uses the first
base compensation band, or first supplied band; the workspace renders every supplied band, including
its original wording. Amounts are never annualized and unknown currencies/periods are labeled.

[Selectors](job-search.selectors.ts) own pure formatting and next-action labels. Calendar dates
retain their calendar day across timezones. Closed roles suppress urgency. Follow-ups take precedence
over legacy test task data; live records have no invented tasks, resumes or company research.
[index](job-search.index.ts) exposes only presentation contracts and pure helpers.

[job-search.fixtures.ts](job-search.fixtures.ts) is test-only historical UI data. No runtime module
imports it. [Tests](job-search.test.ts) protect date, salary and unknown-data behavior; mapping and
API cache tests cover live records. Run web, state, architecture and documentation gates.

The mapping resolves posting facts through saved user overrides, preserving explicit nulls and empty
lists. Board summaries and the detailed role use those same effective facts, including records whose
initial extraction never succeeded. Extracted provenance remains in the saved payload.
