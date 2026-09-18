# Blog

## Purpose and boundaries

The inherited blog publishes repository-authored MDX at `/blog`. It is example content, not a
job-posting importer, company-research store or runtime CMS. Public claims follow the
[web guide](../../../AGENTS.md); the blog's presence does not establish a product requirement.

## Owners and behavior

- [blog.index.ts](blog.index.ts) is the public surface; [blog.types.ts](blog.types.ts) owns types.
- [BlogIndex.tsx](BlogIndex.tsx) reads Nextra's page map, excludes the index entry and sorts dates
  newest first. An empty list renders the heading and an empty list; no custom empty state exists.
- [BlogPost.tsx](BlogPost.tsx) loads one page and renders breadcrumb, title, UTC-formatted date and
  body. [blog.utils.ts](blog.utils.ts) owns metadata parsing and date formatting.
- [The dynamic route](../../app/blog/[...mdxPath]/page.tsx) owns static params and title/description
  metadata. It awaits params before loading content. There is no sitemap, canonical-origin setting
  or structured-data implementation in this starter.
- [MDX components](blog.mdx-components.tsx) customize Nextra's wrapper. Keep their alias in
  [next.config.ts](../../../next.config.ts) synchronized.
- Posts live in [src/content](../../content). Use ISO `YYYY-MM-DD` dates and non-empty titles.
  The parser only checks non-empty title/date strings; it does not validate ISO dates or trim them.
- The `postbuild` script in [package.json](../../../package.json) indexes generated blog HTML
  into ignored Pagefind output. Do not edit generated search files.

## Failure and verification

Missing imports or required front matter can fail rendering/building. Non-empty invalid dates can
pass parsing and then fail date rendering or sort incorrectly; there is no custom recovery path.
Do not claim the parser rejects invalid date formats. Tightening it is separate behavior work.

[Utility tests](blog.utils.test.ts) cover a valid date, valid metadata and missing title;
[index tests](BlogIndex.test.tsx) cover ordering/filtering and page-map arguments;
[post tests](BlogPost.test.tsx) cover rendering, breadcrumb and requested path. These are narrow mocks,
not proof of real MDX integration. Run the full web gate from the project guide after changes to
content, metadata, routes or Nextra wiring; the production build and Pagefind step are required.
