# huntinwabbit web

The web application currently contains a small Next.js starter with feature-based architecture
and an MDX blog. The [product README](../README.md) describes the intended job-search experience;
the starter does not implement it yet.

## Included

- Next.js 16 App Router and React 19
- TypeScript 5
- Tailwind CSS 4 and daisyUI 5
- Light and dark themes with `next-themes`
- Nextra-powered MDX posts and Pagefind indexing
- Vitest for unit tests
- React Testing Library and Biome
- Repository guidance for coding agents

## Start the app

```bash
mise install   # Node 24 and its bundled npm
npm ci
npm run dev
```

Run commands from `web/` with mise activated, or use `mise exec -- npm ...`. This is an
independent npm project with its own `package-lock.json`; there is no npm workspace. Use
`npm install` when changing dependencies and commit the updated lockfile.

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```text
src/
  app/                 # Routing files only
  content/             # MDX blog posts
  features/            # Flat, self-contained feature slices
  shared/              # App-wide components
```

Each feature exposes a single `<feature>.index.ts` public API. Code outside a feature imports from that file rather than reaching into feature internals.

## Add a post

Create an MDX file in `src/content`:

```mdx
---
title: "Post title"
date: "2026-07-28"
description: "A short description."
---

Post content.
```

The filename becomes the route under `/blog`.

## Commands

```bash
npm run dev         # Start the development server
npm run build       # Build the app and generate the Pagefind index
npm start           # Serve the production build
npm test            # Run unit tests once
npm run test:watch  # Run unit tests in watch mode
npm run check-types # Generate route types and check TypeScript
npm run check       # Check formatting, lint and import organization
npm run check:fix   # Apply safe Biome fixes
npm run lint        # Lint with Biome
npm run format      # Format with Biome
```

Biome handles JavaScript, TypeScript, JSON and CSS, including Tailwind directives. Markdown
and MDX content are reviewed manually. Generated files are excluded, and utility class
sorting is not enabled.

## Agent guidance

Repository conventions live in [AGENTS.md](AGENTS.md), with focused guides for
[Next.js](docs/nextjs.AGENTS.md), [design and Tailwind](docs/design.AGENTS.md), and
[accessibility](docs/accessibility.AGENTS.md). The project guide indexes each feature barrel.
