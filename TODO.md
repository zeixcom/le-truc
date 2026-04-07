# TODO — v1.1 Polish & Stabilization

Reference: `API_DX_REVIEW.md`, `ARCHITECTURE.md` §v1.1 Specification

All phases from the v1.1 refactoring are complete. The tasks below cover the remaining polish work needed before the v1.1 API is considered stable.

## Phase 11: Type Cleanup — Rename `EventHandlers`/`SensorEventHandler` v1/v2 naming

> The `src/events.ts` exports `EventHandlers`, `SensorEventHandler` (v1.0 form) alongside `EventHandlersV2`, `SensorEventHandlerV2` (v1.1 form). The V2 suffix is an internal migration marker, not a good public name. Resolve before stabilization.

- [ ] **11.1** Decide on final public names: e.g. deprecate `EventHandlers`/`SensorEventHandler` (v1.0) and rename `EventHandlersV2`/`SensorEventHandlerV2` to simply `EventHandlers`/`SensorEventHandler`, or keep both with clearer documentation.
- [ ] **11.2** If renaming: update `src/events.ts`, add `@deprecated` JSDoc to old types, update `index.ts` exports.
- [ ] **11.3** Run `bun run build`; run `bunx tsc --noEmit`.

---

## Phase 12: Public API Audit — Unexported internals and over-exported utilities

> A review of `index.ts` shows some exports that may not belong on the public surface, and some types that could be clarified or consolidated.

- [ ] **12.1** Audit `index.ts`: check whether `resolveReactive`, `runEffects`, `updateElement`, `Effects`, `ElementEffects`, `ElementUpdater`, `Reactive`, `UpdateOperation` should remain public — these are v1.0 effect-building primitives. Consider marking them `@deprecated` or moving to a separate `legacy` re-export path.
- [ ] **12.2** Audit whether `ComponentFactory`, `ComponentFactoryResult`, `ComponentSetup`, `ComponentUI` still need to be public in v1.1, or if they should be `@deprecated` in the type surface.
- [ ] **12.3** Check that all `FactoryContext` helper types (`FactoryWatchHelper`, `FactoryEachHelper`, `FactoryOnHelper`, `FactoryPassHelper`, `FactoryProvideContextsHelper`, `FactoryRequestContextHelper`) are exported and documented — component authors may need them for type-annotated helper functions.
- [ ] **12.4** Update `index.ts` version comment from `// Le Truc 1.0.1` to reflect the current version.
- [ ] **12.5** Run `bun run build`; run `bunx tsc --noEmit`.

---

## Phase 13: Canonical Examples and Docs

> The API_DX_REVIEW recommends one minimal, authoritative example per helper. These serve as the primary onboarding material.

- [ ] **13.1** Write or update `docs-src/api/functions/defineComponent.md` — feature the v1.1 factory form as the canonical example; relegate v1.0/4-param to a "legacy" section.
- [ ] **13.2** Write a canonical `watch` example in `docs-src/api/functions/` (after rename from `run`).
- [ ] **13.3** Write a canonical `each` example in `docs-src/api/functions/`.
- [ ] **13.4** Write a canonical `pass` example in `docs-src/api/functions/`.
- [ ] **13.5** Write a canonical context provider/consumer example in `docs-src/api/functions/provideContexts.md` and `requestContext.md`.
- [ ] **13.6** Write a canonical `expose` (or `exposeAPI`) example in `docs-src/api/functions/` — covering values, sensors, methods, and context-backed properties.
- [ ] **13.7** Audit `docs-src/pages/getting-started.md` and `docs-src/pages/data-flow.md` — update any code examples that use the old v1.0 or 4-param form.
- [ ] **13.8** Mark any remaining v1.0 example components in `examples/` as legacy (comment or README note) so they do not weaken the v1.1 narrative.

---

## Phase 14: Migration Guide

> The API_DX_REVIEW recommends a concise guide showing how v1.0 components map to v1.1.

- [ ] **14.1** Write `docs-src/pages/migration.md` covering:
  - how prop declarations move from the 4-param `props` map into `expose()`
  - how the UI `select` function collapses into direct `first()`/`all()` calls in the factory closure
  - how the `effects` record maps to the returned `FactoryResult` array
  - how `run('prop', handler)` (now `watch`) replaces effect-map entries
  - how `on(type, handler)` (target-less) maps to `on(element, type, handler)`
  - how `pass(props)` (target-less) maps to `pass(element, props)`
  - why `observedAttributes` is empty in the factory form, and when to keep the 4-param form
- [ ] **14.2** Add a link to the migration guide from `docs-src/pages/getting-started.md`.
