# React container/component architecture

Read the [web guide](../AGENTS.md), [state policy](state-management.md) and
[Next.js conventions](nextjs.AGENTS.md). This guide defines the architecture for all handwritten
web UI. Feature barrels own each feature's state lifetime, contracts and failure behavior.

## Responsibilities and naming

`Name.container.tsx` exports `NameContainer`. It coordinates selected state, intent callbacks,
server data, action lifecycles, navigation decisions and stateful vendor adapters. It chooses
loading/error/available views and assembles connected children. Keep coordination thin: substantial
validation, transformations and business rules belong in pure functions, selectors and reducers.
A container may return small composition markup; it must not become the owner of large view trees.

`Name.component.tsx` exports `Name`. It renders typed props and emits callbacks, with ordinary
conditional markup for labels, empty states, validation and visibility. It must be renderable without
an application store or service provider when its props are supplied. It must not import containers,
application-state owners, server operations or stateful vendor adapters, even indirectly through
barrels or custom hooks. `Link` and `Image` remain appropriate declarative framework UI.

Simple UI state, refs, stable IDs and effects for local UI behavior may remain in components.
A password visibility toggle does not need a container. A parent can own a draft and pass values
and callbacks to a nearby child. Use Redux when mutable feature state needs broader ownership or a
longer lifetime, not merely because two components participate. Avoid duplicating props/store values
into synchronized local state. Keep state updaters pure.

Providers use `.provider.tsx`; external-state wrappers that are not view coordinators use
`.adapter.tsx`. These are explicit roles, not escape hatches for presentation code. Next.js route
files and the Nextra MDX convention retain framework names. Existing flat feature folders, named
function exports and public feature barrels remain the organization rules. Do not create empty
container wrappers or a custom hook for every component; extract a hook for a cohesive stateful
responsibility when it makes ownership or reuse clearer.

## Composition and contracts

Containers pass typed values and intent callbacks, not stores, Redux dispatch functions or service clients.
They assemble nested containers and pass the resulting elements through `children` or named slots.
For example, a header component receives theme/sign-out slots; its container creates those connected
controls. A board column receives cards as children and drag state/refs as props.

Keep public contracts small enough to explain the component's responsibility. Pure formatting may
stay in a component; domain decisions and shared derivations belong in pure helpers/selectors.
Splitting code must preserve state lifetime, keys, focus, form semantics and failure states.
Preserve module-safe feature exports: type-only contracts and pure helpers are suitable presentation
imports; server-only exports stay separated. Do not bypass the public barrel to evade the guard.

Server/client execution is a separate axis. Prefer server composition, with small client boundaries
for hooks, events and browser APIs. A `.component.tsx` file imported by a client container joins its
client graph; renaming it cannot make it a Server Component. Route caching and static generation
remain explicit Next.js decisions. Keep ordinary callbacks inside client boundaries and use only
supported Server Action references across them. Credentials remain at their existing auth boundary.

## Verification and enforcement

- Test presentation using explicit props, accessible output, local interactions and emitted callbacks.
  Tests should cover meaningful states without requiring Redux or vendor providers.
- Test connected containers using a fresh real store/provider and deterministic initial state. Exercise
  real selectors, reducers and actions; assert user-visible behavior rather than mocking Redux hooks.
  Mock network/framework boundaries where needed and keep fixtures fictional.
- Test load-bearing pure rules directly and preserve the existing auth/state coverage gates. Browser
  tests cover actual routes, drag geometry, focus, hydration and end-to-end user intent; production
  builds cover server/static rendering and MDX integration.
- Run `npm run test:architecture` while changing boundaries and the full web gates before handoff.
  [The checker barrel](../src/architecture/architecture.AGENTS.md) describes executable checks and
  limitations. Review still decides whether component boundaries and logic placement are sensible.

Adopted 2026-09-18. The testing policy follows the
[Redux testing guide](https://redux.js.org/usage/writing-tests); rendering boundaries follow the
[Next.js Server and Client Components guide](https://nextjs.org/docs/app/getting-started/server-and-client-components).
The container/component names are this project's convention, not a React framework requirement.
