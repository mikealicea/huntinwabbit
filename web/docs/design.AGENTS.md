# Web design and styling

Read the [web guide](../AGENTS.md) and [accessibility guide](accessibility.AGENTS.md) before UI work.
The [product README](../../README.md) owns intent. The
[search-board prototype](../../docs/prototype/search-board.html) is a design exploration with sample
data, not a source of implemented routes, persistence or a finalized design system.

## Shared owners

- [globals.css](../src/app/globals.css) owns Tailwind configuration and daisyUI theme selection.
- [the root layout](../src/app/layout.tsx) loads Ubuntu and Ubuntu Mono once through `next/font`.
- [the theme barrel](../src/features/theme/theme.AGENTS.md) owns the logical light/dark mapping and
  provider behavior. Keep CSS theme names and TypeScript mapping in agreement.
- [PageShell](../src/shared/PageShell.component.tsx) owns the blog's main landmark and prose content width.
  [The application layout](../src/app/app/layout.tsx) owns the wider job-search shell and main landmark;
  the root route redirects without rendering a landing layout.

Use semantic colors and paired foreground/background tokens instead of per-feature color copies.
The shared stylesheet strengthens form borders and placeholder contrast using the active theme's
foreground token. Field errors use readable foreground text and an error-colored input boundary.
Use the existing font tokens; changing typography, theme names or status meanings requires updating
all owners in the same change. Meaning must survive color changes and assistive technology.

## Tailwind conventions

Configuration is CSS-first: keep the existing Tailwind import, plugin declarations and theme variables
in `globals.css`, not a new JavaScript Tailwind config. Use `@theme` for tokens that generate utilities,
and `@theme inline` when mapping to runtime variables. Keep token declarations at the top level.
Use ordinary CSS variables for values that do not need utilities.

These conventions were checked against [Tailwind's theme reference](https://tailwindcss.com/docs/theme)
on 2026-09-17. Consult the installed version and current official docs for uncertain utility names;
do not copy an older framework cheat sheet. Biome parses Tailwind directives but does not sort utility
classes in this repository.

## Interaction and visual decisions

Design around understanding the job search at a glance and quick capture on desktop and mobile.
Prioritize hierarchy, readable density, spacing and clear next actions. Keep status, interest and
priority distinct in both controls and visual language. Show loading and unavailable values honestly.
Use restrained motion that explains change, with a reduced-motion path. Decoration must not obscure
content, controls or focus.

Shared components should own reusable interaction and accessibility behavior. Keep role-specific
workflow rules in their feature. Do not add a UI framework, icon family, theme system or elaborate
animation dependency for an isolated component without a concrete need.

Verify changed layouts with representative long text, empty and populated data, narrow and wide
viewports, both themes and zoom. Record the actual browser checks in the handoff. The current theme
is an implementation fact, not a requirement to preserve its visuals forever.
