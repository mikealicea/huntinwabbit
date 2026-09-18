# Web accessibility

This guide owns interaction and verification requirements for web UI changes. Read the
[web guide](../AGENTS.md) and the changed feature's barrel. Requirements below do not claim that the
starter or every future surface has passed an accessibility audit.

## Controls and information

Prefer native links, buttons, inputs, selects and form semantics. Every action needs a meaningful
accessible name; icon-only actions describe the task rather than the icon. Keep visible labels in
accessible names. Decorative icons must not add redundant stops. Expose disabled, selected, expanded
and validation states through semantics, not appearance alone.

Every drag, swipe, hover or pointer-only interaction needs an equivalent keyboard/control path.
This includes moving future board cards between stages. Preserve logical heading and landmark
structure, visible keyboard focus and a reading order that matches the meaningful visual order.
Associate field errors with their inputs and preserve entered values after recoverable failures.

Status must survive loss of color. Show text or another meaningful cue for priority, interest,
completion and errors. Make loading and asynchronous outcomes available to assistive technology
without repeatedly announcing decorative changes or fast timers.

## Layout, focus and motion

Allow text to resize and reflow without clipping essential content or hiding actions. Check long
labels, narrow screens and zoom. Give controls sufficient hit area and spacing; avoid tiny standalone
icon targets. Use at least 24 by 24 CSS pixels or the applicable spacing exception, and prefer larger
targets for frequent touch actions.

Dialogs and blocking overlays need an accessible name, appropriate initial focus, keyboard dismissal
when safe, focus containment and restoration to the opener. Content behind a modal must not remain
interactive. Provide an explicit safe cancel/close action. Do not shift focus just because background
data updates.

Respect `prefers-reduced-motion`: replace unnecessary travel, parallax and repeated animation while
preserving state and feedback. Measure contrast for both themes: aim for WCAG AA's 4.5:1 normal-text
and 3:1 large-text thresholds and 3:1 for meaningful control boundaries/state indicators where required.

These web targets follow the [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/),
checked on 2026-09-17. They adapt the reusable intent of native accessibility practices; native point
sizes and platform-specific APIs are not web requirements.

## Verification

For a changed interaction, use keyboard alone and inspect focus, labels, state and dismissal. For
substantial flows, also exercise a screen reader, narrow/desktop layouts, zoom, both themes and
reduced motion with empty, populated, loading and error states relevant to the feature. Record the
browser/device and checks actually completed; explicitly name anything not exercised.

Rendered tests should find controls through accessible roles and labels and assert meaningful state
transitions. jsdom tests cannot prove rendered contrast, hit targets, screen-reader reading order,
real focus behavior or the whole application's accessibility. There is no browser accessibility
suite configured yet. Add focused coverage with the feature that needs it rather than claiming an
unrun audit passed.
