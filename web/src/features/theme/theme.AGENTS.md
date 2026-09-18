# Theme

## Purpose and owners

The starter supports logical light/dark themes and an initial system preference. It is not a second
product-settings store. [theme.index.ts](theme.index.ts) owns the public exports;
[theme.utils.ts](theme.utils.ts) maps logical names to daisyUI's CSS theme names. Keep that mapping in
agreement with [globals.css](../../app/globals.css).

[AppThemeProvider.tsx](AppThemeProvider.tsx) wraps `next-themes` and applies its resolved theme through
`data-theme`. The [root layout](../../app/layout.tsx) owns provider lifetime and fonts.
Persistence/system-theme mechanics are delegated to the installed `next-themes` package; there is
no server-synced theme preference or custom storage adapter here.

[ThemeSwitch.tsx](ThemeSwitch.tsx) waits for client hydration with `useSyncExternalStore`. Before
hydration it renders a disabled loading state; after hydration it labels and applies the opposite
of the resolved light/dark theme. Preserve that truthful state rather than rendering a theme guess
as a completed preference. Keep controls semantic and verify both palettes for contrast.

## Verification and limits

The [header tests](../header/Header.test.tsx) cover one mocked switch from light to dark. There is
no dedicated hydration, system-preference or persistence test yet. Browser checks are needed when
changing those behaviors. Run the full gate in the [web guide](../../../AGENTS.md); follow the
[accessibility guide](../../../docs/accessibility.AGENTS.md) for interaction or palette changes.
