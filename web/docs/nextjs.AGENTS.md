# Next.js conventions

Read the [web guide](../AGENTS.md) first. [package.json](../package.json) owns the installed version;
[tsconfig.json](../tsconfig.json) and [next.config.ts](../next.config.ts) own local configuration.
Do not treat an upstream example or another application's guide as this project's current behavior.

## Routes and boundaries

Keep route files under `src/app/` focused on framework composition. Feature UI and behavior live in
flat feature folders and are imported through their public barrels. The existing async route example
is [the blog page](../src/app/blog/[...mdxPath]/page.tsx); its promise-shaped params are owned by
[blog.types.ts](../src/features/blog/blog.types.ts).

Await request APIs such as `params`, `searchParams`, `cookies()` and `headers()` when using them.
Next's route-aware `PageProps`, `LayoutProps` and `RouteContext` helpers are generated globals; do not
copy imports from private `.next/types` paths. `npm run check-types` runs `next typegen` first.
These conventions were checked against the [Next.js 16 migration guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
and [TypeScript reference](https://nextjs.org/docs/app/api-reference/config/typescript) on 2026-09-17.
Recheck version-sensitive APIs when changing the framework.

Keep browser hooks and events behind small client boundaries. The existing
[theme provider](../src/features/theme/AppThemeProvider.tsx) composes server-rendered children;
do not convert the whole route tree to client components to access theme state. Keep server-only
credentials and provider integrations out of client imports and browser-exposed variables.

For new data flows, explicitly choose freshness, caching, authorization and invalidation behavior.
Do not share private user data through a public cache. The starter has no user-data cache, Server
Actions, proxy or API integration to preserve. Add abstractions only for the feature being built.

## Metadata, generation and recovery

Use framework metadata exports rather than scattering document head construction through features.
The blog owns its static params, MDX loading and metadata. Preserve the Nextra alias and verify
changes with the [blog barrel](../src/features/blog/blog.AGENTS.md).

When adding interactive data routes, design loading, empty, missing-resource, partial failure and
retry states. A retry must not silently duplicate a mutation. Error UI must not display private
server details. Describe the actual behavior in the feature barrel and test meaningful transitions.

Run the full web gate from the project guide. Its production build exercises static generation and
Pagefind as well as compilation. Browser behavior, focus and navigation still need the UI checks
appropriate to the changed flow; a successful build is not visual evidence.
