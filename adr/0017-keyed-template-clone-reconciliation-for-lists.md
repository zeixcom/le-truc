# ADR 0017: Keyed Template-Clone Reconciliation for Lists

## Status

✅ Accepted

## Context

Data-driven lists (add/remove/reorder interfaces) need a keyed reactive data source synced to a container's children. Hand-rolled versions of this — harvest `data-key` children, remove leavers, clone a `<template>` for enterers, reposition by child index — are too brittle to ask authors to write: copies diverge in how they fill cloned content, index-based positioning breaks with any unmanaged child in the container, and none mount per-item bindings in disposable scopes, so per-item reactivity and event handlers leak on every removal.

The existing collection helpers don't cover this. `each()` enhances DOM the component does **not** own: it is DOM-driven, keyed by element identity from a `Memo<Element[]>` (ADR [0014](0014-keyed-per-element-scopes-for-memo-collections.md)). Here the component **owns** the container's children and the source of truth is data — cause-effect's keyed lists, keyed by string.

This is Le Truc's first data-driven DOM **creation** primitive. REQUIREMENTS.md §6 Assumptions states that server-rendered HTML is the truth at load time and Le Truc does not reconcile initial state with the server; this decision preserves that stance — the first run *adopts* server-rendered keyed children as-is, and where the source list gets its initial data (including parsing it from the DOM) stays the author's business. It is also a precondition for the server-component work (ADR 0024 onward).

## Decision

Add a top-level primitive `reconcile(container, template, source, bindItem)`, exported like `each()` and returning an effect descriptor (ADR [0007](0007-effect-descriptors-with-deferred-activation.md)). It is a plain verb, not a `bind*` setter, because it manages scopes and cleanup. The signature and JSDoc live in `src/helpers/reactive.ts`; the mechanics in [ARCHITECTURE.md, List Reconciliation](../ARCHITECTURE.md#list-reconciliation).

- **Data contract:** the **branded** cause-effect keyed-list types (`List<T> | Collection<T>`), which provide `keys()` and `byKey()`. `Store<T>` has the same structural shape but is excluded: its items are not homomorphic (each property is its own signal), which the per-item `bindItem` contract assumes. No `Memo<T[]>` support — that is `each()`'s domain.
- **One-way sync, data → DOM.** `reconcile()` never reads item data back from the DOM. On the first run, keyed children whose key is not in the source are removed (DEV_MODE warning), and so are all other unkeyed children (self-cleaning container). Event handlers that mutate the list are the legitimate path to structural change.
- **Template contract.** The author passes the `<template>`; it must hold exactly one root element (`InvalidTemplateError`, a `TypeError` subclass). `bindItem` does all content work — there is no default fill convention. It runs for **adopted** server-rendered elements too and owns its idempotency against server-rendered content; `reconcile()` itself is idempotent (a re-run against a matching DOM is a no-op).
- **`data-unreconciled` opt-out (public SSR contract, permanent).** Children carrying `data-unreconciled` are exempt: never removed, never repositioned, no `bindItem`. Use case: a drag-and-drop marker or a server-streamed item arriving mid-interaction must not be yanked by a re-run. An element `reconcile()` placed that later gains the attribute (the mid-drag item) still **claims its key** while exempt, so a re-run never clones a duplicate for a merely pinned key. Unreconciled children `reconcile()` never placed are fully invisible to it.
- **Keyed-relative positioning.** Keyed elements are positioned relative to the **keyed subset** (after the previous keyed sibling, or at the head if first), not by absolute child index, so unmanaged elements interspersed in the container do not shift keyed positions. Moves use `insertBefore()` only; nodes are always reused on reorder, never recreated.
- **Bookkeeping.** Runtime element→key matching is internal; `data-key` stays on cloned and adopted elements as the DOM-facing attribute for SSR adoption and event-delegation ergonomics. The two are complementary, not either/or.
- **Reactivity split.** The driving effect tracks *structural* changes only (`source.keys()`); per-item value changes flow through the `byKey` signal passed to `bindItem` and never trigger structural work.
- **Collector parity with `each()`.** `bindItem` runs inside an ambient effect-descriptor collector exactly like `each()`'s callback (ADR 0018): `bindItem`'s job — mount this item's DOM and reactivity — is the same job, and withholding the collector at one mount seam while granting it at the other would be arbitrary. Collected descriptors activate against the per-item scope, not the driving structural effect, so item-level `watch(item, …)` never makes the structural effect depend on item signals. The returned `MaybeCleanup` is the per-item scope's teardown, never a descriptor; there is no reconciliation of the return value.
- **Ownership** carries over ADR 0014's two load-bearing details: per-item scopes are root scopes so effect re-runs don't dispose them wholesale, and an outer scope registers the teardown-all cleanup on the component scope for disconnect. Leavers are disposed before enterers are mounted (teardown-before-setup).

## Alternatives Considered

- **Overload `each()`**: the two helpers sit on opposite sides of an ownership boundary — `each()` is DOM-driven and never mutates structure; `reconcile()` is data-driven and owns the container's children. Overloading would blur the clearest line in the helper vocabulary.
- **`Memo<T[]>` + key function**: cause-effect's keyed lists already own the keyed-data problem (stable keys, per-item signals). A key function over a plain array would re-derive that and lose per-item reactivity to whole-array invalidation.
- **Two-way DOM seeding** (read initial item data from server-rendered children): it would put a parsing contract into the primitive and break the one-way rule. Authors who want DOM-seeded state parse the DOM themselves and build the initial list from it.
- **Structural `KeyedSignals<T>` interface** (anything with `keys()`/`byKey()`): `Store<T>` would satisfy it accidentally with non-homomorphic items; branding keeps the contract honest.
- **Collector-free `bindItem`**: it forces every consumer either down to a raw `createEffect` for per-item reactivity or out to container-level `on()` delegation for per-item events. Since collected descriptors activate against the per-item scope, parity costs nothing.
- **`moveBefore()` for state-preserving moves**: deferred, not rejected — adopting it later is a pure UX improvement as browser support solidifies and needs no API migration. Likewise deferred: built-in empty-state handling (compose `watch(…, bindVisible(fallback))`), view transitions, RAF batching via `schedule()`, nested-reconciler guidance. Revisit with evidence.

## Consequences

**Good:**

- Hand-written reconciliation blocks become unnecessary; the pattern is a tested library primitive with a per-item scope lifecycle (O(changed) per mutation, as in ADR 0014).
- Per-item bindings are disposed on leave and on disconnect — hand-rolled versions typically dispose nothing.
- `data-unreconciled` gives SSR streaming and transient interaction state (DnD markers) a first-class, documented escape hatch.
- `each()` and `reconcile()` compose: `all()`'s lazy MutationObserver fires on reconcile-driven mutations, so `each()`-mounted scopes on reconciled descendants dispose correctly.
- Authors use the full reactive vocabulary (`watch`, `on`, `pass`, `provideContexts`) inside `bindItem` as inside `each()`'s callback, with no raw `createEffect` or container-level delegation workarounds.

**Bad / accepted tradeoffs:**

- `data-unreconciled` is a **permanent public contract** once shipped — server templates emit it; it cannot be renamed or repurposed.
- Le Truc now creates DOM from data in this one primitive — a deliberate, bounded exception to the "enhance, don't render" posture. The template still lives in server-rendered HTML; there is no client-side template language. [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) widens the exception to conditional arms, adding a current-arm-key source form.
- Keyed-relative positioning is subtler than index-based positioning.
- Single-pass `insertBefore()` positioning can move more nodes than the theoretical minimum on some permutations (no LIS optimization) — accepted; the same behavior class as the hand-written code it replaces.
- Every collector-based helper, including a hand-authored descriptor wrapped in `watch(() => true, …)`, activates inside `bindItem`, so `bindItem` is one of the seams the no-active-collector error names.

## Related

- Requirements: §1 Success criteria (1000+ frequently updated elements), [M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects) fine-grained DOM effects, [M6](../REQUIREMENTS.md#m6-automatic-dependency-tracking) automatic cleanup on disconnect, §4 Performance, §6 Assumptions (server-rendered HTML is the truth at load time)
- Architecture: [Effect Descriptors](../ARCHITECTURE.md#effect-descriptors), [List Reconciliation](../ARCHITECTURE.md#list-reconciliation); `src/helpers/reactive.ts`
- Related ADRs: [ADR 0001](0001-use-cause-effect-as-reactive-primitive-layer.md) (layering — keyed lists are cause-effect's, the DOM lifecycle is Le Truc's), [ADR 0007](0007-effect-descriptors-with-deferred-activation.md) (descriptor form, deferred-activation throw for `InvalidTemplateError`), [ADR 0014](0014-keyed-per-element-scopes-for-memo-collections.md) (ownership discipline reused; `each()` boundary), [ADR 0018](0018-implicit-effect-collection-via-ambient-context.md) (ambient collector), [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) (conditional arms)
