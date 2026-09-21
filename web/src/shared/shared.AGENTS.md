# Shared presentation

This folder owns reusable presentation with a shared behavioral contract. Follow the
[web guide](../../AGENTS.md) and [React architecture](../../docs/react-architecture.AGENTS.md).
Do not put feature policy, Redux connections or external-state adapters in shared components.

[PageShell.component.tsx](PageShell.component.tsx) renders the blog's main landmark, content width
and prose wrapper around supplied children. It has no state, persistence or side effects.
[shared.index.ts](shared.index.ts) is the public entry point; the blog layout composes the shell.
The application and landing pages keep their own distinct shells.

[LoadingPulse](LoadingPulse.component.tsx) provides a decorative pulsing dot beside visible loading
text. Callers render it only for active work; reduced-motion preferences keep the dot static.
It owns no request state or announcements.

Run the web gates and architecture check when changing shared UI. The production build verifies
blog layout composition; browser inspection is required for visual changes. Do not add wrapper
containers to components that have no coordination responsibility.
