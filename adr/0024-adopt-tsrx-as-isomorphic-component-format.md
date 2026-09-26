# ADR 0024: Adopt TSRX as the Isomorphic Component Format

## Status

✅ Accepted — amended by [ADR 0029](0029-tiered-server-evaluation.md) (tiered server evaluation), [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) (`.tsx` primary), [ADR 0033](0033-scope-component-styles-by-custom-element-name.md) (compiled CSS, sub-design 2) and [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) (template-cloned arms, sub-design 13).

## Context

Components were three hand-maintained files whose contract was checked only at runtime — `first()` failures the symptom, drift the disease. REQUIREMENTS.md [§1](../REQUIREMENTS.md#the-core-insight) requires server-rendered HTML with a thin reactive enhancement layer, [§5](../REQUIREMENTS.md#5-technical-constraints) prohibits client-side rendering and an SSR layer *in the library*, and [§7](../REQUIREMENTS.md#7-out-of-scope) anticipated a companion project for the server half. TSRX (Ripple ecosystem) provides a shared parser (`@tsrx/core`) with per-target codegen; Le Truc is its first server-oriented target, validated by spikes.

## Decision

Adopt an **isomorphic single-file `.tsrx` format** — server args, signals, `expose()`, markup, handlers, and styles in one source, the single source of truth for server render and client enhancement — compiled by a **split compiler** built in-repo on pinned `@tsrx/core`. Sub-design numbers are stable; other ADRs cite them. For `.tsx` components, ADR 0032 supersedes sub-designs 4, 6 and 14 and amends 16. These surface sub-designs remain in force for `.tsrx`, which stays supported.

1. **Full expressiveness, no escape hatches** — every Le Truc feature is expressible in the format, so no author drops to hand-written TypeScript for want of syntax; hand-written components stay supported ([M15](../REQUIREMENTS.md#m15-no-build-cdn-usage-supported)). Event delegation is a compiler optimization.

2. **Split compiler, isolated dependency** — per component it emits server markup, a generated `defineComponent()` client factory importing solely from `@zeix/le-truc`, component-scoped CSS ([ADR 0033](0033-scope-component-styles-by-custom-element-name.md)), and a registry entry. `@tsrx/core` is pinned behind a single emitter module; the compiler lives in this repo (distribution: [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md)).

3. **DOM-is-truth seeding, end to end** — the server renders initial values by the Evaluation Tier's mechanism; the client harvests them from that DOM at connect — no state payload ([ADR 0003](0003-attributes-drive-state-at-connect-time-only.md)). Expressions no phase can resolve are omitted and client-corrected, never simulated (ADR 0029). **One site, three roles:** a child-harvested prop is rendered, harvested, and rebound in one authored site. Exclusions: declared signals; the root's own attributes (the root IS the host — that value is the channel, not a copy); Parser-exposed props (their channel is the host attribute — double-rendering warns).

4. **Author-declared reactivity, no markers** — a function-valued attribute is a reactive binding, an `on*` attribute an event, a reactive `{expr}` child the reactive child: reactivity is what the expression reads, never a marker. Reactive `aria-*` (IDREF ARIA excepted) lowers to `bindAria()` by target ([ADR 0026](0026-aria-reflection-via-elementinternals-and-bindaria.md)) — never style the host on `aria-*`; `:state()` ([ADR 0016](0016-element-internals-for-form-association-and-states.md)) is the styling hook.

5. **Dual `@for` lowering** — over server data: rendered once, enhanced via `each()` scopes ([ADR 0014](0014-keyed-per-element-scopes-for-memo-collections.md)); over a reactive List: keyed items plus an extracted `<template>` reconciled by `reconcile()` ([ADR 0017](0017-keyed-template-clone-reconciliation-for-lists.md)). Server-known expressions fold into every item.

6. **Type flow by emit-then-check** — CI `tsc`-checks both generated modules through the compiler's own span-table mappings.

7. **Library boundary unchanged** — compiler and driver are build-time tooling: `@zeix/le-truc` stays browser-only and never renders; jsdom never ships ([ADR 0027](0027-server-simulation.md)); `reconcile()` remains the only DOM-creation primitive. §7's companion project is build-time compilation, not a server runtime.

8. **Extension activation via `export const config`** — a zero-import, statically analyzable third argument (form flag; `observedAttributes` names must be Parser-exposed props), compiler-validated; form variant first — [ADR 0019](0019-extension-based-dependency-injection-for-definecomponent.md)'s ordering, structurally enforced.

9. **CEM generation from the generated clients** — the analyzer and plugin read the generated clients, so the manifest needs no compiler support. The registry already holds every fact the manifest states, so a compiler-emitted CEM stays feasible — in the compiler or as an external emit target.

10. **Composition: PascalCase invocation, explicit `truc:pass`** — a capitalized tag bound to a sibling-module import composes that component; top-level attributes are the child's server args. `truc:pass` is the sole client-signal interop channel. Children become the child's reserved `children` parameter, inserted at a bare `{children}` — not `<slot>`, which collides with Declarative Shadow DOM. A required child without children is a type error.

11. **Optional element references: the weaker of two claims** — site-inferred: a single-branch `@if` addresses its root as maybe-cardinality under one presence guard (with `@else`: union addressing); author-declared: one selector literal is optional (`T | undefined`), two are required, throwing the authored reason. **The template proves what a component renders, never what it will find** — required refs alone are structurally verified.

12. **Arg-to-site substitution** — an arg used only to compute a value may be traced to a descendant attribute the client reads back at connect; initializers stay one unconditional constructor call.

13. **Async boundaries route on `isPending`** — the guarded signal is the `@try` body's direct lazy child; arms are template-cloned branches keyed `ok`/`nil`/`err` ([ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) s4): the shipped arm renders live beside inert templates, and a state change clones its arm in. The plain sync `@try`/`@catch` boundary stays a separate shape.

14. **Import placement is inferred** — only sibling-component imports are compose imports (sub-design 10); every other import re-emits verbatim into the modules that use it.

15. **Context protocol support** — `requestContext(Context, fallback)` is a recognized signal-constructor form and `provideContexts` an ambient call; the server renders the fallback, the client corrects once a provider resolves.

16. **Real exports explicit, Factory Context ambient** — real `@zeix/le-truc` exports are imported explicitly, keeping sources honest TypeScript; the Factory Context vocabulary stays ambient via `globals.d.ts` — an authored import would falsely declare a generated parameter.

## Alternatives Considered

- **Status quo (the hand-written trio)**: drift persists, with or without a server templating layer; runtime contract errors are the tax.
- **Authored split (client export beside the template)**: two truths coexist per component.
- **Compiler-inferred reactivity (taint walk)**: author-declared thunks eliminate the inference.
- **Extension hooks in setup (`useExtensions`, export arrays)**: a directive that never executes, or unvalidatable shapes; the closed `export const config` enforces ordering structurally.
- **Ripple's `createVolarMappingsResult`**: its every-token invariant is tied to Ripple's transforms; the compiler emits its own span table.
- **Binary "fold failed, therefore simulate" routing**: sends the largest cost driver into a realm that cannot answer it; [ADR 0029](0029-tiered-server-evaluation.md) tiers instead.
- **An opt-in `enhancer` mode**: deletes the server half under a flag; widen the default path instead of exempting components from it.
- **Duplicating a harvested prop onto the host attribute**: ships template and data twice (sub-design 3).
- **Inferring `first()` cardinality from the site**: take the weaker claim (sub-design 11).
- **JSX instead of TSRX**: no first-class control flow, no host-owned styles, no shared parser; revisited by [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md).
- **Shape-inferred `pass()` dispatch**: ambiguous once a name is both server arg and client prop.
- **`<slot>` as the children insertion marker**: a real DOM element; collides with Declarative Shadow DOM.

## Consequences

**Good:**

- Single source of truth; the HTML contract is compile-checked (root-tag match, selector uniqueness), not discovered as runtime errors.
- Generated clients are exactly idiomatic Le Truc — the corpus doubles as golden tests.
- No state payload — pages are correct before JavaScript loads; ref drift is build-caught.

**Bad / accepted tradeoffs:**

- The rewrite rules are product surface — goldens are mandatory; a wrong rewrite is a wrong component.
- `@tsrx/core` is 0.x: the pin holds, churn is expected; `.tsrx` stays untyped without the projection toolchain.
- Approximated values render client-corrected (the flash trade); two evaluation mechanisms coexist — the audit is a standing obligation ([ADR 0029](0029-tiered-server-evaluation.md)).
- The corpus migrated to compiled sources (hand-written twins kept as variants, [ADR 0039](0039-canonical-plus-variants-authored-surfaces.md)); authors debug generated factories (`debug()` and tiered error surfacing mitigate).
- The one-site rule fires on a name coincidence with no opt-out; an optional reference turns a missing element into a silent no-op.
- An async boundary ships every arm's markup, the non-shipped ones as inert templates — heavier HTML, consistent with enhance-don't-render.

## Related

- Requirements: [§1](../REQUIREMENTS.md#the-core-insight), [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), [M10](../REQUIREMENTS.md#m10-context-protocol), [§5](../REQUIREMENTS.md#5-technical-constraints), [§7](../REQUIREMENTS.md#7-out-of-scope)
- Host profile: [HOST_PROFILE.md](../server/compiler/HOST_PROFILE.md)
