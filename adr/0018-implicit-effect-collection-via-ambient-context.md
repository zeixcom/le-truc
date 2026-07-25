# ADR 0018: Implicit Effect Collection via Ambient Context

## Status

✅ Accepted

## Context

[ADR 0007](0007-effect-descriptors-with-deferred-activation.md) established that `watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` return effect descriptors (thunks) that the factory must collect into a `FactoryResult` array and `return`, so `defineComponent` can activate them after dependency resolution (M8).

This explicit-return contract has proven to be a silent footgun. A bug report (`watch(task, fn)` called as a bare statement, not returned) showed that dropping a descriptor's return value produces **no error, no warning** — the effect is simply never created. In the reported case, a `Task` never ran, not even its initial invocation, and the cause was invisible without reading the library's activation internals. The same class of mistake affects `on()`, `pass()`, and `each()` identically, and is easy to hit any time a helper call and its collection into the return array become separated (conditional registration, helper extraction, refactoring).

The explicit-return contract also forces awkward control flow for conditional registration — `[cond && watch(...)].filter(Boolean)` instead of a plain `if`.

Exploration (this ADR's design) confirmed:
- `each()`'s existing per-element scope mechanism (`keyedScopes` in `src/helpers/reactive.ts`) already invokes its `mount(element)` callback synchronously inside a nested `createScope`, which itself pushes/pops cause-effect's `activeOwner` context. This recurses cleanly for arbitrarily deep nested structures (e.g. a grid: rows containing columns) — it is not a depth-limited mechanism, so an analogous descriptor-collector stack can piggyback on the same synchronous call structure without a new depth constraint.
- The factory return type is already `FactoryResult | Falsy | void` (`component.ts`), so a factory that returns nothing has always been valid — implicit collection is additive to the existing type surface, not a signature break.
- Components that iterate DOM-driven collections rely on `each()`'s per-element scoped lifecycle (auto-teardown on element removal, auto-setup on entry). `each()` itself is not replaceable by plain `for...of` control flow — it is a keyed reconciliation primitive, not sugar for iteration — so it is retained unchanged in this decision.

## Decision

Move `watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` from **explicit return** to **implicit collection** via an ambient per-scope collector:

- Each component instance's factory execution has a closure-scoped collector (one per host instance, created in `connectedCallback`) that `watch`/`on`/`pass`/`each`/`provideContexts` push their descriptors into directly, instead of returning them for the factory to collect. `provideContexts()` has the identical `(...) => EffectDescriptor` shape as the other three single-descriptor helpers, so it moves alongside them for API consistency — there is no reason to leave it on the old return-only path while the rest move to implicit collection.
- `each()`'s per-element `mount` callback pushes a fresh nested local collector before invoking the callback, and pops it in a `try`/`finally` on exit — mirroring exactly how `createScope` already manages `activeOwner` for per-element root scopes. This supports arbitrary nesting depth (grids, and beyond), not just two levels.
- Calling `watch()`/`on()`/`pass()`/`each()` with no active collector on the stack (e.g., after an `await`, inside a detached `setTimeout` or event handler defined during setup) throws immediately — analogous to cause-effect's `RequiredOwnerError` for `match()`. This converts today's silent no-op into a hard, immediate, diagnosable error.
- This is purely a *collection-mechanism* change. It does not alter the deferred-activation timing guarantee from ADR 0007 — effects still activate only after dependency resolution (child custom element definition), preserving M8 in full. ADR 0007 is superseded only in how descriptors move from being created to being activated, not in when activation happens.

**Migration:** breaking change, rolled out over two releases:
- **v2.3**: support both forms simultaneously. Explicit `return [...]` keeps working unchanged (zero action required from existing code); implicit collection becomes available as the encouraged form. No type-signature break, since `void` was already a valid factory return type.
- **v3.0**: deprecate and remove the explicit-return form. `EffectDescriptor` stops being part of the public return contract; `watch()`/`on()`/`pass()`/`each()`/`provideContexts()` return `void`.

**Registering hand-authored descriptors:** `watch()`/`on()`/`pass()`/`each()`/`provideContexts()` cover the vast majority of effects, but some components need to wrap non-le-truc reactive primitives or native browser APIs (e.g. `IntersectionObserver`, `createEffect()` from `@zeix/cause-effect` composed with a native event listener) in a hand-authored `EffectDescriptor` — a raw `() => MaybeCleanup` thunk not produced by any helper. `return` remains a registration path for such a descriptor (`FactoryResult` has always permitted authoring one by hand), but components using this pattern couldn't drop explicit `return` even after adopting implicit collection everywhere else.

This ADR originally proposed a sixth `FactoryContext` helper, `run(descriptor)`, for exactly that case — a thin wrapper pushing the descriptor into the ambient collector via `createScope()`. It was implemented and then reverted before release: the same registration is already achievable with the existing `watch()` helper bound to a dependency-free thunk, `watch(() => true, descriptor)`. `createComputed(() => true)` has no signal dependencies, so it evaluates once and never reruns, and `watch()` already calls `createEffect()` internally, which self-registers the descriptor's returned cleanup on the active owner — the exact problem `run()`'s `createScope()` wrapping existed to solve. Adding a dedicated helper for a pattern already expressible through an existing one was judged to be unwarranted API surface growth, so `FactoryContext` keeps five plain-verb helpers (`watch`, `on`, `pass`, `provideContexts`, `requestContext`), not six.

## Alternatives Considered

- **Keep explicit return only.** Rejected — the silent-no-op footgun is a real, recurring class of bug (this ADR exists because of an actual bug report), and the `[cond && watch(...)].filter(Boolean)` conditional-registration pattern has a real DX cost that implicit collection removes entirely.
- **DEV_MODE-only warning for orphaned/uncalled descriptors, keeping explicit return.** Rejected — requires new instrumentation to detect "descriptor created but never returned," and would still be silent in production. Implicit collection eliminates the possibility of the bug outright rather than diagnosing it after the fact.
- **Global mutable stack for all four helpers, rather than a per-instance closure for the top-level collector.** The per-instance closure is preferred for the component-level collector — it avoids any cross-instance leakage risk entirely, since each host gets its own collector by construction. A true push/pop stack is only necessary for the nested `each()`-level case, where the same bound helpers must route to different (nested) collectors depending on call context.
- **Keep `return` alive permanently as an escape hatch for hand-authored descriptors only, instead of adding a dedicated helper.** Rejected — re-introduces the dual-path complexity ADR 0018's own v3.0 milestone (and the LT-005 `forEachUnseen()` consolidation) is meant to retire, and permanently blocks `FactoryResult`/`EffectDescriptor` from leaving the public return contract.
- **Point authors at `createEffect()` (from `@zeix/cause-effect`) directly instead of a hand-authored `EffectDescriptor`.** Rejected — a factory-scope `createEffect()` call runs immediately, outside deferred activation, so it would violate M8 (no guarantee child custom elements are defined first) and wouldn't get automatic cleanup wired into the component's disconnect scope.
- **Add a dedicated `run(descriptor)` helper for hand-authored descriptors.** Implemented, then reverted pre-release — see "Registering hand-authored descriptors" in the Decision section above. `watch(() => true, descriptor)` already covers the case without growing `FactoryContext`'s surface.

## Consequences

**Good:**
- Eliminates an entire class of silent-failure bugs: helpers now either register or throw, never silently no-op.
- Enables normal control flow for conditional registration (`if (cond) watch(...)`), removing the array-filter idiom.
- No timing or activation-order regression — M8 and ADR 0007's deferred-activation guarantee are fully preserved.
- Zero-cost migration path in v2.3: existing components using explicit return continue to work unchanged.
- Simplifies the public type surface in v3.0 (`FactoryResult`/`EffectDescriptor` shrink out of the return contract).

**Bad:**
- Breaking change for v3.0: any code still using explicit `return [...]` must migrate.
- Descriptors lose first-class composability as data — a shared helper function that today builds and `return`s an array of descriptors for reuse across components can no longer do so under implicit collection; it must instead be called synchronously while a collector is active, side-effecting into the ambient collector rather than returning a composable value. Code relying on this pattern needs a different extraction shape (e.g., a helper that takes `context` and calls `watch()` itself).
- Slightly more internal complexity: two collector concepts (per-instance closure at the top level, nested push/pop stack inside `each()`) instead of one flat return-and-flatten (`activateResult`) mechanism.
- Requires a new, hard runtime guard (throw when no collector is active) that does not exist today — must be implemented carefully to give an actionable error message rather than a cryptic stack trace.

## Related

- Requirements: [M8](../REQUIREMENTS.md#m8-dependency-resolution-for-nested-custom-elements), [M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects), [M6](../REQUIREMENTS.md#m6-automatic-dependency-tracking)
- Architecture: [Effect Descriptors](../ARCHITECTURE.md#effect-descriptors) (to be updated by the architect skill — out of scope for this ADR)
- Supersedes: [ADR-0007](0007-effect-descriptors-with-deferred-activation.md)
