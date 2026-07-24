# ADR 0017: Keyed Template-Clone Reconciliation for Lists

## Status

✅ Accepted

## Context

Data-driven lists (add/remove/reorder interfaces) require syncing a keyed
reactive data source to a container's children. Authors who need this today
hand-roll the same pattern: a `watch()` on the source's keys that harvests
`data-key` children, removes leavers, clones a `<template>` for enterers, and
repositions by absolute child index. It is too brittle to ask authors to write
— hand-written copies of this pattern tend to diverge (ad hoc fill
conventions for populating cloned content, index-based positioning that
breaks with any unmanaged child in the container), and none mount per-item
bindings in disposable scopes, so per-item reactivity and event handlers leak
on every removal.

Le Truc's existing collection helpers don't cover this. `each()` enhances DOM
the component does **not** own: it is DOM-driven, keyed by element identity
from a `Memo<Element[]>` (ADR [0014](0014-keyed-per-element-scopes-for-memo-collections.md)).
Here the component **owns** the container's children and the source of truth is
data — cause-effect's `List`/`Collection`, keyed by string.

This is Le Truc's first data-driven DOM **creation** primitive. REQUIREMENTS.md
(§6 Assumptions) states that server-rendered HTML is the truth at load time and
Le Truc does not reconcile initial state with the server — this decision
preserves that stance: the first run *adopts* server-rendered keyed children
as-is; where the source `List` gets its initial data (including parsing it from
the DOM) remains the author's business. It is also a precondition for the
server-component exploration (deferred, ADR 0018+).

## Decision

Add a top-level primitive `reconcile()` (plain verb per the factory-helper
naming convention — it manages scopes and cleanup, so it is not a `bind*`
setter), exported from the package like `each()`, returning an effect
descriptor (ADR [0007](0007-effect-descriptors-with-deferred-activation.md)):

```ts
reconcile<T>(
	container: Element,
	template: HTMLTemplateElement,
	source: List<T> | Collection<T>,
	bindItem: (element: HTMLElement, item: Signal<T>, key: string) => MaybeCleanup,
): EffectDescriptor
```

- **Data contract:** the **branded** union `List<T> | Collection<T>` — both
  provide `keys()` and `byKey()`. `Store<T>` satisfies the structural shape but
  is excluded: its items are not homomorphic (each property is its own signal),
  which the per-item `bindItem` contract assumes. No `Memo<T[]>` support — that
  is `each()`'s domain.
- **One-way sync, data → DOM.** `reconcile()` never reads item data back from
  the DOM. On the first run, keyed children whose key is not in the source are
  removed (DEV_MODE warning); all other unkeyed children are removed
  (self-cleaning container). Event handlers that mutate the list are the
  legitimate path to change structural DOM state.
- **Template contract.** The author passes the `<template>`; exactly one root
  element inside it is enforced (`InvalidTemplateError`, a `TypeError` subclass
  per `src/errors.ts` conventions). `bindItem` does all content work — no
  default fill convention. It runs for **adopted** server-rendered elements
  too, and is responsible for its own idempotency against server-rendered
  content; `reconcile()` itself is idempotent (re-running against a matching
  DOM is a no-op).
- **`data-unreconciled` opt-out (public SSR contract, permanent).** Children
  carrying `data-unreconciled` are exempt: never removed, never repositioned,
  no `bindItem`. Use case: a drag-and-drop marker or a server-streamed item
  arriving mid-interaction must not be yanked by a reconcile re-run. An
  element `reconcile()` itself placed that later gains the attribute (the
  mid-drag item) still **claims its key** while exempt — a re-run must not
  clone a duplicate for a key whose element is merely pinned. Unknown
  unreconciled children (never reconciled, e.g. streamed-in) are fully
  invisible.
- **Keyed-relative positioning.** Keyed elements are positioned relative to the
  **keyed subset** (after the previous keyed sibling, or at the head if first),
  not by absolute child index, so unmanaged elements interspersed in the
  container do not drift keyed positions. Moves use `insertBefore()` only;
  nodes are always reused on reorder, never recreated.
- **Bookkeeping.** Runtime element→key matching uses an internal
  `WeakMap<Element, string>`; `data-key` is retained on cloned/adopted elements
  as the DOM-facing attribute for SSR adoption harvest and event-delegation
  ergonomics. Complementary, not either/or.
- **Reactivity split.** The driving effect tracks *structural* changes only
  (`source.keys()` read inside the `createEffect`); per-item value changes flow
  through the `byKey` signal passed to `bindItem` and never trigger structural
  work.
- **Collector parity with `each()`.** `bindItem` runs inside an ambient
  effect-descriptor collector, exactly like `each()`'s callback: the call is
  wrapped in `withCollector(collected, ...)`, then `activateResult(collected)`
  activates every descriptor the helpers pushed, and the callback's returned
  `MaybeCleanup` is handed to the per-item `createScope`. This is deliberate
  parity — `bindItem`'s job is "mount this item's DOM and reactivity," the
  same job `each()`'s callback does, and withholding the collector would hand
  authors the full reactive vocabulary at one mount seam while withholding it
  at the other. The collected descriptors activate against the per-item
  `{ root: true }` scope (not the driving structural effect), so item-level
  `watch(item, …)` does not make the structural effect depend on item signals.
  **No `forEachUnseen` reconciliation of the return value:** `reconcile()` is
  new in 2.3 with no backward-compat constraint, and `forEachUnseen` itself is
  v3.0 cleanup. The return value is a teardown, captured by `createScope` —
  not a descriptor. (`each()` keeps `forEachUnseen` only to remain
  non-breaking through the v2.3 → v3.0 window, since it shipped before ADR
  0018's ambient collection.)
- **Ownership** carries over ADR 0014's two load-bearing details: per-item
  scopes are created with `{ root: true }` so effect re-runs don't dispose them
  wholesale, and an outer `createScope` registers the teardown-all cleanup on
  the component scope for disconnect. Leavers are disposed before enterers are
  mounted (teardown-before-setup).

## Alternatives Considered

- **Overload `each()`**: rejected — the two helpers sit on opposite sides of an
  ownership boundary. `each()` is DOM-driven (element identity, `Memo<Element[]>`,
  never mutates structure); `reconcile()` is data-driven and owns the
  container's children. Overloading would blur the clearest line in the helper
  vocabulary.
- **`Memo<T[]>` + key function**: rejected — cause-effect's `List`/`Collection`
  already own the keyed-data problem (stable keys, per-item signals). A key
  function on a plain array would re-derive what `List` maintains, and per-item
  reactivity would be lost (whole-array invalidation).
- **Two-way DOM seeding** (read initial item data out of server-rendered
  children): rejected — it would put a parsing contract into the primitive and
  violate the one-way data → DOM rule. Authors who want DOM-seeded state parse
  the DOM themselves and build the initial `List` from it.
- **Structural `KeyedSignals<T>` interface** (accept anything with
  `keys()`/`byKey()`): rejected — `Store<T>` would satisfy it accidentally with
  non-homomorphic items; branding the parameter keeps the contract honest.
- **Collector-free `bindItem`**: rejected — it is the same job as `each()`'s callback at the same
  kind of seam, and withholding the collector forced every consumer to either
  drop to a raw `createEffect` for any per-item reactivity or push all
  interactivity out to container-level `on()` event delegation. The collected descriptors
  activate against the per-item scope, so the structural effect never depends
  on item signals; parity is free.
- **`moveBefore()` for state-preserving moves**: deferred, not rejected —
  landing it later is a pure UX improvement as browser support solidifies and
  requires no API migration. Likewise deferred: built-in empty-state handling
  (compose `watch(…, bindVisible(fallback))`), view transitions, RAF batching
  via `schedule()`, nested-reconciler guidance. Revisit with evidence.

## Consequences

**Good:**

- Hand-written reconciliation blocks become unnecessary; the pattern becomes
  a tested library primitive with per-item scope lifecycle (O(changed) per
  mutation, as in ADR 0014).
- Per-item bindings get proper disposal on leave and on disconnect — hand-rolled
  versions of this pattern typically never dispose anything.
- The `data-unreconciled` contract gives SSR streaming and transient
  interaction state (DnD markers) a first-class, documented escape hatch.
- `each()` and `reconcile()` compose: `all()`'s lazy MutationObserver fires on
  reconcile-driven mutations, so `each()`-mounted scopes on reconciled
  descendants dispose correctly.
- **Collector parity with `each()`:** authors use the full reactive vocabulary
  (`watch`, `on`, `pass`, `provideContexts`) inside `bindItem` as they already
  do inside `each()`'s callback. Per-item reactivity no longer requires a raw
  `createEffect`, and per-item events no longer require container-level
  delegation, eliminating a class of workarounds authors otherwise reach for.

**Bad / accepted tradeoffs:**

- `data-unreconciled` is a **permanent public contract** once shipped — server
  templates will emit it; it cannot be renamed or repurposed.
- Le Truc now creates DOM from data in this one primitive — a deliberate,
  bounded exception to the "enhance, don't render" posture. The template still
  lives in server-rendered HTML; there is no client-side template language.
- Keyed-relative positioning is subtler than index-based positioning; the unit
  tests for interspersed unmanaged elements guard the rule.
- Naive single-pass `insertBefore()` positioning can move more nodes than the
  theoretical minimum on some permutations (no LIS optimization) — accepted;
  same behavior class as the hand-written code it replaces.
- Collector parity means `watch()`/`on()`/`pass()`/`each()`/`provideContexts()`/
  `run()` now activate inside `bindItem`; the `NoActiveCollectorError` message
  (`src/errors.ts`) mentions `each()` and `reconcile()`.

## Related

- Requirements: §1 Success criteria (1000+ frequently updated elements),
  [M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects) fine-grained DOM effects,
  [M6](../REQUIREMENTS.md#m6-automatic-dependency-tracking) automatic cleanup on
  disconnect, §4 Performance, §6 Assumptions (server-rendered HTML is the truth
  at load time)
- Architecture: [Effect Descriptors](../ARCHITECTURE.md#effect-descriptors),
  helpers in `src/helpers/reactive.ts`
- Related ADRs: [ADR 0001](0001-use-cause-effect-as-reactive-primitive-layer.md)
  (layering — `List`/`Collection` are cause-effect's, the DOM lifecycle is Le
  Truc's), [ADR 0007](0007-effect-descriptors-with-deferred-activation.md)
  (descriptor form, deferred-activation throw for `InvalidTemplateError`),
  [ADR 0014](0014-keyed-per-element-scopes-for-memo-collections.md) (ownership
  discipline reused; `each()` boundary)
