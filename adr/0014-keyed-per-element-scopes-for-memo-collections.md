# ADR 0014: Keyed Per-Element Scopes for Memo-Driven Collections

## Status

✅ Accepted

## Context

Three helpers iterate a `Memo<Element[]>` and create a per-element scope for each element: `each(memo, callback)`, the Memo branch of `pass(memoTarget, props)`, and the non-bubbling fallback of `on(memoTarget, type, handler)`. All three wrapped a `for (const el of memo.get())` loop in a `createEffect`, calling plain `createScope()` per element inside it.

In `@zeix/cause-effect`, a `createScope` created inside an effect registers its dispose on that effect, and the effect runs all registered cleanups before every re-run. So when a single element entered or left the collection, **all N** per-element scopes were disposed and recreated — O(n) scope churn per mutation. The REQUIREMENTS.md success criterion "Le Truc proves it can scale well in complex web applications with 1000+ frequently updated elements" (§1) and the fine-grained-effects requirement (M5) demanded better; the cause-effect integration reference already *described* the intended keyed lifecycle ("creating new inner scopes for new elements and disposing scopes for removed ones") that the code did not implement.

The architectural question is **where this keyed lifecycle belongs**. Cause & Effect provides reactive primitives — `Slot`, `Memo`, `Sensor`, `Task`, `Scope` — not DOM lifecycles. Per-element scope management tied to a `Memo<Element[]>` produced by `all()` is a Le Truc concern: the elements are DOM nodes, the `Memo` is a `MutationObserver`-backed Le Truc construct, and the cleanups (event listeners, Slot restores, nested effect teardown) are DOM-scoped. Cause & Effect's ownership model gives us the exact escape hatch needed — `ScopeOptions.root` — without extending its API into DOM territory.

## Decision

Introduce a shared internal helper `keyedScopes(memo, mount)` in `src/helpers/reactive.ts`, used by all three helpers. It keeps a `Map<Element, dispose>` keyed by **element identity** and diffs the current collection against it inside a `createEffect`:

- Elements that **leave** get exactly their own scope disposed (removed from the Map), before entering elements are mounted — preserving the old teardown-before-setup ordering for one-mutation replacements.
- Elements that **enter** get a new scope via `createScope(() => mount(el), { root: true })`.
- **Surviving elements are untouched** — no disposal, no re-mount.

Two ownership mechanics are load-bearing:

1. **`{ root: true }` on the per-element scopes.** Without it, each scope registers its dispose on the enclosing effect, which runs all cleanups before every re-run — silently reproducing the wholesale rebuild while the code *looks* keyed. With `root: true`, the returned dispose held in the Map is the sole teardown mechanism; the driving effect's re-run cannot touch surviving scopes.
2. **An outer `createScope` wrapper around the effect.** The descriptor body runs while the component's root scope is the active owner, so the wrapper's dispose registers there. Its returned cleanup (dispose every Map entry) is the **only** thing that tears down still-live root-scoped element scopes on component disconnect. Without it, every `{ root: true }` scope would leak listeners and slot swaps past `disconnectedCallback`.

Throw semantics per ADR [0011](0011-throw-on-pass-binding-failure.md) are preserved: `swapSlots` throws only when the offending element *enters*; `createScope` re-throws, and `scopes.set` runs only after `createScope` returns, so a throw never registers the failed element's scope. A throw still aborts mounting later entering elements in the same run — identical to the previous all-or-nothing behavior, consistent with ADR 0011's homogeneity argument. No per-element try/catch is added.

A consequence of longer-lived scopes: the computed created by `toSignal` for a `pass()` thunk now survives collection changes instead of being recreated per rebuild. Thunks passed to `pass()`/`watch()` must therefore read live sources (`host`/signals), not snapshot values — which is the already-documented contract.

## Alternatives Considered

- **Keep the wholesale rebuild (status quo)**: Simple, but O(n) churn per mutation makes the 1000+-element success criterion unattainable and causes observable side effects (listener churn, child effect re-runs, repeated warnings) that the keyed model eliminates.
- **Key by index or a `data-key` attribute**: Per-element effects in Le Truc do not depend on position, and the element object itself is the natural stable identity — `all()` returns live element references. Index keying would wrongly recycle scopes across different elements on reorder; `data-key` would impose authoring overhead for no benefit.
- **Plain `createScope` (no `root: true`) with a diffing Map**: Passes a superficial reading but keeps old behavior — the enclosing effect disposes owned child scopes on every re-run. Rejected as silently incorrect; the flipped unit tests guard against regressing to it.
- **Use Cause & Effect's `List` primitive**: `createList` (since cause-effect 0.18.0) is a reactive **data** array keyed by generated **string** keys, with per-item value signals, mutated imperatively (`set`/`add`/`remove`). It is orthogonal to the scope-lifecycle problem here: it keys by string, not by element reference (DOM elements have no natural stable string key); it manages per-item `MutableSignal`s, never per-item scopes or cleanups (no mount/unmount hook — only a whole-list `watched`); it cannot consume a `Memo<E[]>` upstream (no `createList(source)` overload), so driving it from `all()` would require a side-channel sync effect that double-diffs the array; and it does not use `ScopeOptions.root`. For all three call sites, `List` would add a string-key layer, a sync effect, and still hand-rolled scope lifecycle — strictly more code, reintroducing the double-diff that `{ root: true }` exists to avoid. This confirms the layering boundary: cause-effect owns reactive primitives, Le Truc owns DOM-scoped per-element lifecycles.
- **Fix at the cause-effect layer (e.g. a keyed-collection primitive with per-item scopes)**: The diffing need is specific to DOM element collections produced by `all()`; cause-effect owns reactive primitives, not DOM lifecycles ([ADR 0001](0001-use-cause-effect-as-reactive-primitive-layer.md)). `ScopeOptions.root` already provides the required escape hatch, so no cause-effect API change is warranted.

## Consequences

**Good:**

- A single element entering or leaving an N-element collection now costs O(changed), not O(n): surviving elements keep their listeners, slot swaps, and nested effects untouched.
- Children bound via `pass(Memo)` no longer see their slot signal replaced (and their downstream effects re-run) when an unrelated sibling enters or leaves; the injected signal instance is identity-stable.
- A pure reorder of the same element set creates and disposes nothing (the memo invalidates, the diff finds no delta) — correct, since per-element effects don't depend on position.
- DEV_MODE `pass()` deprecation warnings now fire once per entering element, matching the "once per offending binding" wording in the 2.2.0 changelog.
- The cause-effect integration reference's description of keyed lifecycle is now an accurate description of the implementation.

**Bad / accepted tradeoffs:**

- ~300 B of additional source (Map bookkeeping); gzip stays under the 14 kB ceiling.
- The Map holds strong references to elements between runs; entries are removed when elements leave and the wrapper cleanup clears the Map on disconnect, so lifetime is bounded by the component scope.
- Longer-lived per-element computeds mean stale-closure bugs in `pass()` thunks are no longer masked by per-change recreation (see contract note in Decision).
- The `{ root: true }` + Map + wrapper-scope ownership model is subtle enough that a well-meaning "simplification" (dropping `root: true`, or removing the wrapper cleanup) silently reintroduces the O(n) rebuild or leaks scopes. The flipped unit tests guard the runtime behavior; this ADR records the *why*.

## Related

- Requirements: §1 Success criteria (1000+ frequently updated elements), [M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects) fine-grained DOM effects, [M6](../REQUIREMENTS.md#m6-automatic-dependency-tracking) automatic cleanup on disconnect, [M7](../REQUIREMENTS.md#m7-dynamic-element-collections-via-all) dynamic collections via `all()`, [M11](../REQUIREMENTS.md#m11-signal-injection-between-components-via-pass) signal injection via `pass()`, §4 Performance
- Architecture: [Effect Descriptors](../ARCHITECTURE.md#effect-descriptors) and per-element scopes
- Related ADRs: [ADR 0001](0001-use-cause-effect-as-reactive-primitive-layer.md) (layering — reactive primitives vs. DOM lifecycle), [ADR 0006](0006-lazy-mutationobserver-for-all-collections.md) (lazy Memo backing `all()`), [ADR 0007](0007-effect-descriptors-with-deferred-activation.md) (descriptors run under the component scope, which anchors the wrapper scope), [ADR 0011](0011-throw-on-pass-binding-failure.md) (throw semantics preserved per entering element)
