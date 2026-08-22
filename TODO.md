# TODO

- [x] LT-001: Inlined TSRX compiler — emitter core (ADR 0023 milestone 1) — done 2026-08-21
  **Skill:** le-truc-dev
  **Context:** Build the in-repo compiler module (`server/tsrx/`) on pinned `@tsrx/core` 0.1.60: parse `.tsrx`, emit server HTML render functions (dependency-provable thunk evaluation), extract verbatim tag-scoped CSS, and maintain the component registry; wire as a build effect in `server/build.ts`. Golden-test against the existing hand-written `.html`/`.css` artifacts. See [ADR 0023](adr/0023-adopt-tsrx-as-unified-component-format.md) sub-designs 2–3 and `spike/tsrx-phase0/REPORT-unified.md` §Recommendation.
  **Result:** `server/tsrx/` (compiler/analyze/emit-server/emit-client/css/runtime/registry) + `server/effects/tsrx.ts` wired into `build.ts`; CSS byte-equal to the hand-written artifacts; every golden-page demo variant represented by `render(args)` (inline goldens); reactive `@for` gated as TSRX001 (milestone 3).

- [x] LT-002: Inlined TSRX compiler — client codegen, sanctioned subset (ADR 0023 milestone 2) — done 2026-08-21
  **Context:** Generate `defineComponent()` factories from the same sources: text/attribute/class bindings, event attributes, refs, server-data `@for` + `each()`, hoisted-const rebinding, harvest rules (first-by-document-order). Imports solely from `@zeix/le-truc`; golden-test generated clients against the existing hand-written trio. Completion of LT-001 + LT-002 is ADR 0023's acceptance criterion (flip Proposed → Accepted) and unblocks migrating docs/examples to `.tsrx`. See ADR 0023 sub-designs 1, 4–5 and `spike/tsrx-phase0/expected/unified-lowerings.md`.
  **Result:** Generated clients snapshot-match `server/tests/tsrx/snapshots/` (statement-for-statement the hand-written trio's patterns) and typecheck against the real `@zeix/le-truc` types (emit-then-check). ADR 0023 flipped to Accepted. `examples/{basic-counter,module-tabgroup}.tsrx` compile end to end; `module-list.tsrx` awaits milestone 3.

- [ ] LT-003: Reactive lists — `@for` over a `List` → template extraction + slot holes + `reconcile()` (ADR 0023 milestone 3)
  **Context:** The module-list lowering in `spike/tsrx-phase0/expected/unified-lowerings.md` §3 is the spec: server renders initial keyed items in place plus an extracted `<template>` whose `&{ }` holes become `<slot>` markers; client lowers to `reconcile()` with a generated `bindItem` (ADR 0017 contracts). Un-gates `examples/module/list/module-list.tsrx` (TSRX001). Golden-test against the hand-written `module-list.ts`/`.html`.

- [ ] LT-004: Type-flow wiring — Volar projection + editor tooling (ADR 0023 milestone 4)
  **Context:** `createVolarMappingsResult` over the generated client module as primary projection; `globals.d.ts` for ambient `expose`/`host`/signal constructors so raw `.tsrx` sources type-check in editors; emit-then-check is already in CI via `server/tests/tsrx/client.golden.test.ts`.
