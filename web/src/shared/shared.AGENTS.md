# Shared presentation

[PageShell.component.tsx](PageShell.component.tsx) provides a main landmark and readable content
width through children. [shared.index.ts](shared.index.ts) is its public interface. The public entry
uses it; feature-specific cards and authentication behavior stay in features. Shared presentation
must not import containers, services or state adapters.

Use shared primitives for reusable behavior, not feature policy. Styling uses shared semantic tokens.
Run web and architecture gates and inspect affected layouts in a browser when changing shared UI.
