# ADR 0023: Adopt TSRX as the Unified Component Format

## Status

🔄 Proposed — direction validated by Phase 0 spikes; to be Accepted only once a working prototype (emitter core + client codegen for the sanctioned subset, per the milestones in [`REPORT-unified.md`](../spike/tsrx-phase0/REPORT-unified.md)) demonstrates the shape holds. The recorded decisions below are the current direction, not a commitment.

## Context

Every Le Truc component is authored as three hand-maintained files (`.ts` / `.html` / `.css`) whose mutual contract is checked only at runtime — `first()` failures are the symptom, drift is the disease. REQUIREMENTS.md [§1](../REQUIREMENTS.md#the-core-insight) requires server-rendered HTML with a thin reactive enhancement layer, [§5](../REQUIREMENTS.md#5-technical-constraints) prohibits client-side rendering and any SSR layer *in the library*, and [§7](../REQUIREMENTS.md#7-out-of-scope) anticipated a companion project for the server half. TSRX (Ripple ecosystem) is a TypeScript superset with a shared parser (`@tsrx/core`) and per-target codegen; every existing target renders and re-renders its own DOM — Le Truc would be the first server-oriented target. Two Phase 0 spikes ([Option C](../spike/tsrx-phase0/REPORT.md), [unified](../spike/tsrx-phase0/REPORT-unified.md)) validated the direction on `@tsrx/core` 0.1.60: every syntactic position needed is grammar-native, and hand-compiling unified sources reproduces today's hand-written components statement for statement.

## Decision

Adopt a **unified single-file `.tsrx` format** — server args, signals, `expose()`, markup, event handlers, and scoped styles in one source — compiled by a **split compiler** built in-repo on pinned `@tsrx/core`. Sub-designs:

1. **One format, no coexistence.** The unified format is the only authoring format. No authored-client fallback, no escape hatches; event delegation is a compiler optimization for bubbling events. The Option C spike remains a feasibility proof, never a shipping format.
2. **Split compiler, isolated dependency.** Server evaluation runs the `@{ }` setup once (signals as plain values) and renders HTML; client generation emits a `defineComponent()` factory that imports solely from `@zeix/le-truc` (CE v2 names via the 2.5.1 bridge) — sources import nothing. `@tsrx/core` is pinned at 0.1.60 behind one emitter module; upgrades are reviewed changes; loss of `stylesheet.source` is a conscious pin-breaker. CSS is emitted verbatim, tag-scoped, no class hashing. The compiler is **inlined in this repo — no separate package ships before TSRX reaches 1.0**; with Le Truc v3.0 it ships as `@tsrx/le-truc`, while `@zeix/le-truc` remains the backend-agnostic client layer.
3. **DOM-is-truth seeding, end to end.** The server renders each reactive expression's initial value; the client harvests its initial state from that DOM (ADR [0003](0003-attributes-drive-state-at-connect-time-only.md) preserved; no serialized state payload). Lists seed from server args server-side and are adopted from the rendered HTML client-side. Harvest canonical site: first by document order, DEV_MODE warns on disagreement. Thunk attributes are server-evaluated when their dependency closure is server-known (args, seeded list state); otherwise omitted — `<template>` clones auto-augment on client insertion — with authored static markup controlling the no-JS initial state.
4. **Author-declared reactivity, no marker identifiers.** A function-valued attribute is a reactive binding; `on*`-prefixed are events (stripped server-side); `{ get, set }` object literals are mediated `pass()` (ADR [0012](0012-deprecate-unrestricted-write-short-forms-in-pass.md)); `&{ }` is the grammar-native reactive child. No upstream grammar changes required.
5. **Dual `@for` lowering.** Over server data: rendered once, enhanced via `each()` per-element scopes (ADR [0014](0014-keyed-per-element-scopes-for-memo-collections.md)). Over a reactive `List`: server-rendered keyed items + extracted `<template>` whose holes become `<slot>` markers, reconciled by `reconcile()` (ADR [0017](0017-keyed-template-clone-reconciliation-for-lists.md)). Loop context crosses to the client via **hoisted-const rebinding** (server-data consts rebind to element-derived attribute reads); direct loop-variable references inside reactive thunks are compile errors with a hoist-first diagnostic.
6. **Type flow by projection.** The generated client module is the primary Volar projection (`createVolarMappingsResult` over the generated-TS source map); element interfaces are authored inline via `declare global` `HTMLElementTagNameMap` augmentations and resolved in generated code by [M4](../REQUIREMENTS.md#m4-type-safe-dom-queries) selector inference; CI type-checks by emit-then-check. Wiring remains, invention does not.
7. **Library boundary unchanged.** The compiler is separate build-time tooling; `@zeix/le-truc` stays browser-only and never renders initial HTML — the generated client enhances, and `reconcile()` remains the only DOM-creation primitive. This realizes §7's anticipated companion project as build-time compilation, not a server runtime.

## Alternatives Considered

- **Status quo (hand-written trio)**: rejected — the drift problem is the motivation; runtime contract errors are the tax.
- **Option B — TSRX as server templating only**: rejected — components stay three files; drift unsolved.
- **Option C — authored split (client export alongside the template)**: validated as feasible (the first spike), rejected as a shipping format — two truths still coexist per component, and coexistence doubles format maintenance.
- **Compiler-inferred reactivity (taint walk from declared roots)**: rejected — author-declared markers (thunks, `&{ }`) eliminate the inference entirely; a `live()` marker identifier was likewise dropped once grammar-native thunks proved sufficient.
- **JSX instead of TSRX**: rejected — no first-class control flow, no host-owned scoped styles, no shared parser to build on; TSRX's lazy `&` semantics already match Le Truc's reactive reads.

## Consequences

**Good:**

- Single source of truth per component; the HTML contract is checked at compile time (root-tag match, selector uniqueness, hoist-rule enforcement) instead of surfacing as `MissingElementError` in the browser.
- Generated client code is exactly today's idiomatic Le Truc — the existing examples corpus doubles as golden-test expectations.
- Zero-import, fully co-located authoring; runtime semantics match the Solid/Ripple first-pass-then-pinpoint model.
- No state payload to hydrate from; pages are correct before JavaScript loads.

**Bad / accepted tradeoffs:**

- The rewrite rules (hoisted-const rebinding, harvest rules, dual `@for`) are now product surface — exhaustive specification and golden tests are mandatory; a wrong rewrite is a wrong component.
- `@tsrx/core` is 0.x and fast-moving: the pin holds, but upgrade churn is expected and reviewed.
- Raw `.tsrx` files are untyped without the projection toolchain; the Volar wiring is the largest residual implementation risk.
- Thunk attributes with non-server-known dependencies render client-corrected (flash risk accepted; authored statics mitigate).
- The examples corpus migrates wholesale — no coexistence path — and authors debug generated factories (mitigated by the DEV_MODE `debug()` extension, ADR 0022).

## Related

- Requirements: [§1 core insight](../REQUIREMENTS.md#the-core-insight), [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), [M3](../REQUIREMENTS.md#m3-attribute--property-initialisation-via-parsers), [M4](../REQUIREMENTS.md#m4-type-safe-dom-queries), [§5 Technical Constraints](../REQUIREMENTS.md#5-technical-constraints), [§7 Out of Scope](../REQUIREMENTS.md#7-out-of-scope)
- Architecture: [Effect Descriptors](../ARCHITECTURE.md#effect-descriptors)
- Related ADRs: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (connect-time seeding), [ADR 0012](0012-deprecate-unrestricted-write-short-forms-in-pass.md) (mediated `pass()`), [ADR 0014](0014-keyed-per-element-scopes-for-memo-collections.md) (`each()` scopes), [ADR 0017](0017-keyed-template-clone-reconciliation-for-lists.md) (`reconcile()` — the stated precondition), [ADR 0018](0018-implicit-effect-collection-via-ambient-context.md) (ambient collection in generated factories)
- Spike inputs: [`spike/tsrx-phase0/REPORT.md`](../spike/tsrx-phase0/REPORT.md) (Option C feasibility, GO on `@tsrx/core`), [`spike/tsrx-phase0/REPORT-unified.md`](../spike/tsrx-phase0/REPORT-unified.md) (format spec, lowering table, type-flow exploration, pre-ADR decisions)
