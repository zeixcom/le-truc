# TODO

v2.3 implementation of implicit effect collection — see [ADR 0018](adr/0018-implicit-effect-collection-via-ambient-context.md). Goal: `watch()`/`on()`/`pass()`/`each()`/`provideContexts()` register into an ambient collector when called, so the factory no longer needs to `return` a `FactoryResult` array. Explicit `return [...]` keeps working unchanged (dual support) — the array is simply unused, since collection already happened via the push. No type-signature break: the factory return type is already `FactoryResult | Falsy | void`.

- [ ] LT-001: Ambient collector primitive and no-active-collector guard
  **Skill:** le-truc-dev
  **Context:** Add the core collection mechanism: a way to push an `EffectDescriptor` into a currently-active collector, and a way to establish/tear down a collector for a scope (top-level per component instance, and nested per `each()` element). Model the push/pop discipline on `try`/`finally`, mirroring how cause-effect's `activeOwner` is managed by `createScope` (see `keyedScopes` in `src/helpers/reactive.ts` for the existing analogous pattern). Add a new error class in `src/errors.ts` (follow the existing `class FooError extends Error`/`TypeError` pattern) thrown when a helper is called with no active collector — e.g. after an `await`, in a detached `setTimeout`, or in an event handler defined during setup. Message should name the helper and explain the constraint (called outside synchronous factory/`each()` execution), analogous to cause-effect's `RequiredOwnerError` for `match()`.

- [ ] LT-002: Wire `watch()`, `on()`, `pass()` into the collector
  **Skill:** le-truc-dev
  **Context:** In `src/helpers/reactive.ts` (`makeWatch`, `makePass`) and `src/helpers/events.ts` (`makeOn`), push the produced `EffectDescriptor` into the active collector at call time, in addition to returning it (return value is kept for backward-compat call sites that still capture/return it — the returned value becomes otherwise unused after LT-005). Depends on LT-001.

- [ ] LT-003: Wire `each()` into a nested per-element collector
  **Skill:** le-truc-dev
  **Context:** `each()` (`src/helpers/reactive.ts`) currently expects its `mount(element)` callback to return a `FactoryResult | EffectDescriptor | Falsy` which `each()` activates itself. Change `keyedScopes`' `mount` invocation to push a fresh local collector before calling `mount(element)` and pop it (in `try`/`finally`) after — descriptors created by `watch()`/`on()`/`pass()` calls inside the callback register into this local collector instead of (in addition to, for back-compat) being returned. Must support arbitrary nesting depth (an `each()` callback that itself calls `each()`, e.g. a grid of rows containing columns) — verify by construction, not just by the two-level examples that exist today. Depends on LT-001, LT-002.

- [ ] LT-004: Wire `provideContexts()` into the collector
  **Skill:** le-truc-dev
  **Context:** `makeProvideContexts` (`src/helpers/context.ts`) has the same `(...) => EffectDescriptor` shape as `watch`/`on`/`pass`. Apply the same push-into-active-collector change as LT-002 for consistency — ADR 0007 covered five helpers (`watch`, `on`, `pass`, `each`, `provideContexts`) and there's no reason to leave `provideContexts()` on the old explicit-return-only path while the other four move to implicit collection. Depends on LT-001.

- [ ] LT-005: Switch `defineComponent` to use the ambient collector as `#setup`
  **Skill:** le-truc-dev
  **Context:** In `src/component.ts`, `connectedCallback` currently does `const result = factory(context); if (result) this.#setup = result`. Create the per-instance collector before calling `factory(context)`, and after the call use the collector's contents as `this.#setup` (the factory's return value is no longer read). Confirm existing components using `return [...]` still work unchanged — every descriptor in that array was already pushed into the collector when its helper was called, so the returned array becomes redundant, not required. Depends on LT-001–LT-004.

- [ ] LT-006: Regression and behavior tests
  **Skill:** le-truc-dev
  **Context:** Add tests covering: (1) the original bug report shape — `watch(task, fn)` called as a bare statement with no `return`, now must activate and run the Task; (2) mixed usage in one factory — some helpers called bare, others still `return`ed — exactly one activation each, no duplicates, no drops; (3) `each()` with implicit collection nested 2+ levels deep (grid-like); (4) calling `watch()`/`on()`/`pass()`/`each()` with no active collector (e.g. from inside a `setTimeout` scheduled during factory setup, or after an `await`) throws the new error immediately. Depends on LT-001–LT-005.

- [ ] LT-007: Update user-facing docs to the implicit-collection style
  **Skill:** tech-writer
  **Context:** `README.md:54-64`, `docs-src/pages/index.md:49`, `docs-src/pages/getting-started.md:159`, and `docs-src/pages/components.md` (lines 32, 262, 286, 306, 310-312, 336, 373-374, 393-394, 423, plus the prose at line 306 explaining "the factory returns a flat array of `EffectDescriptor`s") all show the explicit-`return` pattern as the primary/only documented form. Update primary examples to the implicit style (calling helpers without `return`), and add a short note that explicit `return [...]` still works in v2.3 but is deprecated as of v3.0 — link [ADR 0018](adr/0018-implicit-effect-collection-via-ambient-context.md). Depends on LT-005 shipping.

- [ ] LT-008: Migrate example components to implicit-collection style
  **Skill:** tech-writer
  **Context:** Seven example components use `each()`'s explicit-return form for nested descriptors: `form-radiogroup`, `form-listbox`, `form-colorgraph` (4 call sites), `module-carousel` (2), `module-todo` (3), `module-ticker`, `test-each`. Update each to drop `return`/array-wrapping per the patterns worked out during design (e.g. `form-colorgraph`'s guard-clause `each()` calls go from `if (!axis) return []` / `return [watch(...)]` to a bare `if (!axis) return` followed by an un-returned `watch(...)` call). Lower priority than LT-007 — these keep working unchanged under dual support, so this is a cleanup/dogfooding pass, not a correctness fix. Depends on LT-003 shipping.
