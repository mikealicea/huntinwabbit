# Shared presentation

This folder owns reusable presentation with a shared behavioral contract. Follow the
[web guide](../../AGENTS.md) and [React architecture](../../docs/react-architecture.AGENTS.md).
Do not put feature policy, Redux connections or external-state adapters in shared components.

[PageShell.component.tsx](PageShell.component.tsx) renders the blog's main landmark, content width
and prose wrapper around supplied children. It has no state, persistence or side effects.
[shared.index.ts](shared.index.ts) is the public entry point; the blog layout composes the shell.
The application keeps its own distinct shell; the root route redirects without rendering a shell.

[LoadingPulse](LoadingPulse.component.tsx) provides a decorative pulsing dot beside visible loading
text. Callers render it only for active work; reduced-motion preferences keep the dot static.
It owns no request state or announcements.

Run the web gates and architecture check when changing shared UI. The production build verifies
blog layout composition; browser inspection is required for visual changes. Do not add wrapper
containers to components that have no coordination responsibility.

[SafeMarkdown](SafeMarkdown.component.tsx) renders supplied posting descriptions and comment bodies
without HTML execution, images or MDX. It preserves paragraph line breaks and supports only absolute,
credential-free HTTP(S) links, opened with noreferrer/noopener. Headings stay below workspace section
headings. It owns no fetching or comment policy; the existing description and notes tests exercise
this shared contract.

[RequestStatus](RequestStatus.component.tsx) reserves a fixed header space for supplied request state
and optional feedback. Callers own labels and success/error policy. Busy, failed, neutral and success
icons have a live text equivalent. Optional details open in an overlay with keyboard activation,
Escape focus restoration and outside/focus dismissal; reduced motion disables spinning. Board and
role workspace browser tests exercise the shared behavior with their own request recovery actions.

[Notes](Notes.component.tsx), [NoteComposer](NoteComposer.component.tsx) and
[NoteEntry](NoteEntry.component.tsx) own the shared role/company comment presentation contract.
[Neutral types](shared.notes.ts) describe presentation data and save outcomes without importing an API
adapter. Feature containers provide records and callbacks; local drafts, previews, edit conflict
review, deletion confirmation and focus restoration stay here. Subject-specific copy identifies
where comments are saved. SafeMarkdown owns rendering restrictions. The role-workspace comment
suite runs against both connected containers, and the workspace browser suites verify real focus,
keyboard submission, reloads and theme/reflow behavior.
