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
[theme provider](../src/features/theme/AppThemeProvider.provider.tsx) composes server-rendered children;
do not convert the whole route tree to client components to access theme state. Keep server-only
credentials and provider integrations out of client imports and browser-exposed variables.

For new data flows, explicitly choose freshness, caching, authorization and invalidation behavior.
Do not share private user data through a public cache. The [auth feature](../src/features/auth/auth.AGENTS.md) owns Server Actions, session verification
and Proxy cookie refresh. Its routes prohibit shared response caching. The job-api feature owns server-only authenticated Route Handlers and a per-account RTK Query cache.

## React architecture and rendering

Follow [the React architecture guide](react-architecture.AGENTS.md). A container is a coordination
role, not a synonym for a Client Component. Server containers can load data and compose client
islands; Redux/action/vendor-state containers require a client boundary. Presentation code remains
server-compatible when it needs no client hooks, and becomes part of the client module graph when
imported by a client entry point. Client Components can receive server-generated initial HTML;
SSR/static generation and Server/Client Component roles are separate decisions.

Only pass serializable data and supported framework references across the server/client boundary.
Ordinary event callbacks stay within a client subtree; Server Action references retain their framework
contract. Pass server-rendered content through composition slots rather than importing server-only
modules into client code. Add `server-only` protection to server data adapters; filenames alone do
not prevent a browser import. Preserve existing static generation, authorization and cache policy.

These distinctions were checked on 2026-09-18 against the installed Next.js documentation and the
[official Server and Client Components guide](https://nextjs.org/docs/app/getting-started/server-and-client-components).
The installed Vitest guide recommends browser coverage for async Server Components; unit tests of
extracted logic or manually awaited functions are not proof of framework rendering and hydration.

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

## Authentication framework requirements

The installed Next.js 16 patch level includes fixes for Server Action origin validation and Proxy
bypasses. Server guards remain mandatory even with Proxy in place. `skipProxyUrlNormalize` preserves
the configured auth origin for loopback redirects; `NEXT_DIST_DIR` isolates browser-test output.
Confirmation requests are excluded from Next's development URL logging because they carry tokens.
Checked 2026-09-18 against the installed framework and the upstream
[Server Actions advisory](https://github.com/vercel/next.js/security/advisories/GHSA-mq59-m269-xvcx)
and [Proxy advisory](https://github.com/vercel/next.js/security/advisories/GHSA-26hh-7cqf-hhc6).
