# huntinwabbit

**A personal workspace for managing a job search from discovering a role to closing out the process.**

`huntinwabbit` is a working name. The app brings job opportunities, application progress, resumes,
company research, referrals, and interview preparation into one place. Its home screen should answer
one question: **Where does everything stand?**

The web app implements a live board, batch link capture and saved-role workspace at `/app`.
Saved links and tracking edits persist through the backend; posting details are extracted asynchronously
with agent-fetch and Redpill. The role workspace also accepts natural-language edits with saved
chat history, partial updates and Undo. A Markdown notes composer saves timestamped comments with
editing and deletion on roles and companies. User corrections survive posting refreshes. Company pages group saved roles
under persistent company identities, with automatic matching and manual corrections. Optional background
analysis finds shared requirements and technologies, with evidence from saved roles and personal context. Tasks, resumes,
submitted materials and structured company research remain
unavailable. `/` redirects signed-out visitors to `/login` and signed-in visitors to `/app`. See the [web README](web/README.md) for setup.

This is a public, self-hostable repository. Configure your own Supabase authentication project and
stage-specific AWS backend. Local frontend development targets the dev API selected by your ignored
environment file; checked-in examples contain placeholders, never a maintainer API fallback.
See [authentication setup](docs/auth-infrastructure.md), the [parsing boundary](docs/job-parsing-data-boundary.md)
and [saved-data boundary](docs/job-postings-data-boundary.md).

The rest of this README records the intended experience and product decisions; it is not a claim
that every feature is implemented. The app is being designed around one person's real job-search
habits first, with both desktop and mobile use in mind.

## The core experience

The home base is a Kanban board of roles. Each card gives enough context to understand an opportunity
without opening it: company, role, salary band, interest, priority, and the next task or follow-up.
Opening a card leads to a workspace for that specific application.

The current proposed stages are:

**Collected → Applied → Preparing → Interviewing → Offer → Closed**

- **Collected:** saved opportunities, including roles whose interest level has not been set yet.
- **Applied:** the application has actually been submitted.
- **Preparing:** currently interpreted as interview preparation; this stage is still a design assumption.
- **Interviewing:** an active interview process, with its rounds, preparation, and notes.
- **Offer:** an opportunity that has reached the offer stage.
- **Closed:** an opportunity that is no longer active.

Evaluation means forming an opinion about a role and assigning interest. In the current design, it
is part of reviewing a saved role rather than a separate board column. Finding a referral is a task
attached to a role, so it can happen alongside the application process.

## Capture jobs quickly

Adding opportunities should take almost no effort, even when collecting many at once.

- Paste a job-posting link into an individual field.
- Optionally choose an interest level beside that link.
- Expand Paste page text to add copied webpage text when a link may be inaccessible. The green check
  folds the editor without saving; Save to Collected submits all rows. Retained pasted text takes
  priority during extraction and can be replaced or removed from the saved role.
- When the last link field is filled, another empty row appears with its own interest selector.
- Save the entered roles to Collected; interest can always be added or changed later.

The intended app will parse each posting for its role, company, requirements, and pay. Salary bands
belong directly on the board cards, with currency and pay period made clear. Missing salary information
should be shown as unavailable rather than guessed.

Capture should stay quick: parsing and reviewing the extracted details should not get in the way of
adding the next opportunity.

## Keep interest separate from priority

Interest describes how much the job appeals to you:

| Interest | Meaning |
| --- | --- |
| Throwaway | Primarily interview practice; a job you likely would not take even if offered. |
| Interested | A role you would consider taking. |
| Highly interested | A role you particularly want. |
| Not set | You have saved the role but have not evaluated your interest yet. |

Priority describes where to put your effort: **High, Medium, or Low**, with the option to leave it
unset. Interest, priority, and application stage are independent. A practice interview can be urgent,
and a highly desirable role can still be waiting for attention.

## Keep the right resume with each application

Resumes will generally be edited outside the app. The app should provide a reusable library of
uploaded files or document links so that versions remain easy to find and distinguish.

For each role, you should be able to:

- Choose an existing resume from the library.
- Replace the planned resume with a more suitable or tailored version.
- Record the exact version submitted with the application.
- Find that submitted version again if you need to resend it or prepare for an interview.

The current design separates the **planned resume** from the **submitted resume**. An external
document link can change over time, so retaining a final uploaded copy is the working approach for
preserving what was actually sent. The details of version management remain open to refinement
through use. Cover letters and other application materials belong alongside the resume.

## Research companies and find referrals

A company can be saved before there is a specific opening. Its profile should hold research,
interview-loop information, and contacts. Multiple roles at the same company share that information
while keeping their own application histories and materials.

The purpose of referral support is practical: identify someone in your network and reach out for an
actual referral. **Find referral** is a role-level task. Exploring a LinkedIn network, including first-
and second-degree connections, is part of the longer-term vision; the access and workflow have not
been designed yet.

## Manage the process after applying

The workspace should support interview rounds, preparation tasks, notes, and follow-up dates.
Follow-ups need to be visible in the main experience so that a role needing attention is easy to spot.

Research and preparation should stay connected to the relevant company and role. After the process
ends, a postmortem should help capture what happened and what to learn for the next application.

## Design principles

- **Make the whole search understandable at a glance.** The board is the primary overview.
- **Keep collection lightweight.** Saving a link should not require completing a form full of details.
- **Separate different decisions.** Stage, interest, and priority answer different questions.
- **Preserve application history.** Later edits should not obscure which materials were submitted.
- **Share company context.** Research and contacts should not need to be copied between roles.
- **Support desktop and mobile.** Quick capture and deeper application work should both be practical.
- **Refine through actual use.** Resume management and workflow details are starting points, not fixed rules.

## Explore the design

- [Interactive search-board prototype](docs/prototype/search-board.html) — open the HTML file in a
  browser to explore cards, role details, salary bands, and adding job links with individual interest
  levels. It uses sample data and temporary interactions; it does not parse live job postings or
  persist changes after a reload.
- [Initial product notes](<docs/oneOff/Sanctum 2026-09-17 11.27.44 Job application tracking tool.combined.md>)
  — the original ramble that started the design discussion.

The web app connects the board, role workspace and quick-add flows to live backend data.
Structured company research and contacts, resume-library experiences, detailed interview tracking, postmortems, and
referral discovery still need further design.
