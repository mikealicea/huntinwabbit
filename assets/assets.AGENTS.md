# Brand assets

This directory preserves supplied source artwork. The web app serves smaller derivatives, not these
originals. The [header](../web/src/features/header/header.AGENTS.md) uses the rabbit mark;
the [auth frame](../web/src/features/auth/auth.AGENTS.md) uses theme-specific rabbit/wordmark artwork.
Images carry no user data, requests to external providers or mutable application state.

## Runtime owners

- [Public brand files](../web/public/brand) contain transparent WebP logos and JPEG social cards.
- [Root layout metadata](../web/src/app/layout.tsx) registers both OG cards, light first, and the
  light card for Twitter's large-image preview. Social previews are static; the receiving service
  chooses among OG images, independently of the visitor's app theme.
- The root layout resolves absolute social image URLs against the existing server-side APP_ORIGIN
  deployment setting, with localhost for local development. Set APP_ORIGIN at build time for hosted
  static pages. Preview metadata contains only branding, never application or account details.
- [favicon.ico](../web/src/app/favicon.ico), [icon.png](../web/src/app/icon.png) and
  [apple-icon.png](../web/src/app/apple-icon.png) use Next's file metadata conventions and are public.

## Rebuilding exports

Run these ImageMagick commands from the repository root after changing the source artwork.
Trimming removes transparent margins; aspect ratios and alpha are preserved in the logo exports.
Keep component dimensions in sync with the resulting files.

```sh
mkdir -p web/public/brand
magick assets/huntinwabbit-logo.png -trim +repage -resize 128x128 -strip -quality 90 web/public/brand/huntinwabbit-logo.webp
magick assets/huntinwabbit-logo-text-light.png -trim +repage -resize 640x640 -strip -quality 90 web/public/brand/huntinwabbit-logo-text-light.webp
magick assets/huntinwabbit-logo-text-dark.png -trim +repage -resize 640x640 -strip -quality 90 web/public/brand/huntinwabbit-logo-text-dark.webp
magick assets/favicon.png -resize 48x48 -strip -define icon:auto-resize=48,32,16 web/src/app/favicon.ico
magick assets/favicon.png -resize 192x192 -strip web/src/app/icon.png
magick assets/favicon.png -resize 180x180 -strip web/src/app/apple-icon.png
magick assets/og-light.png -strip -sampling-factor 4:4:4 -quality 88 web/public/brand/og-light.jpg
magick assets/og-dark.png -strip -sampling-factor 4:4:4 -quality 88 web/public/brand/og-dark.jpg
```

Run the documentation and web gates from the [repository guide](../AGENTS.md). Inspect header and
auth layouts at narrow/desktop widths in both themes, confirm image requests succeed, and inspect
rendered favicon and social metadata. Local checks do not prove a social platform has refreshed its
cached preview; deployed crawler verification is separate.
