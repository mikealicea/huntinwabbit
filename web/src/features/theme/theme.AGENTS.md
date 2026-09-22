# Theme

## Purpose and owners

The application supports logical light/dark themes and an initial system preference. It is not a second
product-settings store. This is an intentional vendor adapter exception to the
[RTK policy](../../../docs/state-management.md): do not mirror next-themes state in Redux. [theme.index.ts](theme.index.ts) owns the public exports;
[theme.utils.ts](theme.utils.ts) maps logical names to daisyUI's CSS theme names. Light maps to Emerald
and dark to Forest. Keep that mapping in agreement with [globals.css](../../app/globals.css).

[AppThemeProvider.provider.tsx](AppThemeProvider.provider.tsx) wraps `next-themes` and applies its resolved theme through
`data-theme`. The [root layout](../../app/layout.tsx) owns provider lifetime and fonts.
Persistence/system-theme mechanics are delegated to the installed `next-themes` package; there is
no server-synced theme preference or custom storage adapter here.
Theme changes suppress transitions so inherited foreground and background colors switch together.

[ThemeSwitch.container.tsx](ThemeSwitch.container.tsx) waits for client hydration with `useSyncExternalStore`. Its [presentation component](ThemeSwitch.component.tsx) receives hydration/theme state and a toggle
callback; it requires no vendor provider. Before hydration it renders a disabled loading state; after hydration it labels and applies the opposite
of the resolved light/dark theme. Preserve that truthful state rather than rendering a theme guess
as a completed preference. Keep controls semantic and verify both palettes for contrast.

## Verification and limits

The [header tests](../header/Header.test.tsx) cover a mocked switch from light to dark.
[Browser tests](../../../e2e/job-search.spec.ts) exercise actual theme switching and the initial light
system preference. [Theme.test.tsx](Theme.test.tsx) exercises the real adapter with controlled browser boundaries:
system changes, both switch directions, persisted preference, storage events and server hydration.
`npm run test:state` covers every handwritten branch in this adapter and switch.
The switch is mounted in the application header; global CSS and the provider also theme the auth pages
and blog. Application data never shares theme storage. Browser checks are needed when changing these
behaviors. Run the full gate in the [web guide](../../../AGENTS.md); follow the
[accessibility guide](../../../docs/accessibility.AGENTS.md) for interaction or palette changes.
