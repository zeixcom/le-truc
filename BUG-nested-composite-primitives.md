# Bug: reactivity gaps when composing `List` + `Store` + `Collection`

**Package:** `@zeix/cause-effect@1.4.0`
**Found while building:** `examples/module/calctable/module-calctable.ts` (le-truc, branch `docs/v2-3-preparation`)
**Status:** Not a Le Truc / DOM-wiring bug — reproduced with `@zeix/cause-effect` directly, no `defineComponent`/DOM involved except where noted (Bug 2 needs `reconcile()`).
**Current workaround:** `module-calctable.ts` avoids both patterns below — it sums totals by iterating `list` directly and reading each item's field signals (`for (const item of list) sum += item.amount.get()`), never calling `list.get()`, `store.get()`, or `deriveCollection()` for this purpose. See the comment above `amountTotal`/`priceTotal` in that file.

Both bugs were found using the same setup: a `List<T, Store<T>>` (i.e. `createList(items, { keyConfig, createItem: createStore })`), which is the documented pattern for a keyed list of per-item-reactive records (used by `examples/module/todo/module-todo.ts`'s `TodoItem` list).

---

## Bug 1: `list.get()` does not propagate nested `Store` field changes to a dependent memo

A `createMemo` that reduces over `list.get()` (or `list.get()[i].someField`) never re-runs when a per-item `Store` field is `.set()` — even though reading the same `Store` field **directly** (bypassing `List`) reacts correctly.

### Repro

```ts
import { createList, createStore, createEffect } from '@zeix/cause-effect'

const list = createList(
  [{ id: 'a', amount: 3 }],
  { keyConfig: item => item.id, createItem: createStore },
)

const seen: number[] = []
createEffect(() => {
  seen.push(list.get()[0].amount)
})
console.log('initial', seen) // [3]

list.byKey('a')!.amount.set(10)
console.log('after set', seen) // BUG: still [3] — expected [3, 10]
console.log('list.get() now', list.get()) // BUG: [{ id: 'a', amount: 3 }] — stale even read fresh, outside any effect
```

**Expected:** `seen` becomes `[3, 10]`, and a fresh `list.get()` call after the `.set()` reflects `amount: 10`.
**Actual:** `seen` stays `[3]` forever, and even a fresh, untracked `list.get()` call returns the stale `amount: 3`. This isn't just a missed effect re-run — the cached snapshot itself never invalidates.

### Control case (proves the field-level signal itself is fine)

```ts
import { createStore, createEffect } from '@zeix/cause-effect'

const item = createStore({ id: 'a', amount: 3 })
const seen: number[] = []
createEffect(() => {
  seen.push(item.get().amount)
})
console.log('initial', seen) // [3]

item.amount.set(10)
console.log('after set', seen) // [3, 10] — correct
```

Reading a `Store`'s own aggregate `.get()` directly inside an effect reacts correctly. The bug is specific to the **two-hop** case: an effect (or memo) reads `List.get()`, which internally reads `Store.get()` per item (`src/nodes/list.ts`'s `buildValue`: `signals.get(key)?.get()`). Something about that nested read doesn't establish (or doesn't propagate through) the dependency edge from the `Store`'s underlying field `State` all the way up through the `List`'s own node.

### Suspect code

`src/nodes/list.ts`, the `get()` method's "fast path" (used once `node.sources` is already populated from a prior `refresh()`):

```ts
get() {
  subscribe()
  if (node.sources) {
    if (node.flags) {
      const relink = node.flags & FLAG_RELINK
      node.value = untrack(buildValue)
      ...
```

If `node.flags` (dirty flag) is never set truthy in response to a nested `Store` field changing, `buildValue` is never re-invoked and the stale `node.value` is returned indefinitely. This suggests the edge from the per-item `Store`'s node to the `List`'s own node either isn't created during the initial tracked `refresh()`, or a `Store`'s internal dirty propagation doesn't reach sinks that only hold an edge via another composite node (`List`) rather than a plain effect.

### Workaround used in `module-calctable.ts`

Iterate the `List`'s own `Symbol.iterator` (which yields the per-item signals, not resolved values) and read each field signal directly — this is only **one** hop (memo → `Store` field `State`), matching the working control case above:

```ts
const amountTotal = createMemo(() => {
  let sum = 0
  for (const item of list) sum += item.amount.get()
  return sum
})
```

Confirmed reliable in both isolated repro and the full component (live edits, add, remove).

---

## Bug 2: `Collection` (via `list.deriveCollection()`) stops notifying a downstream memo after a per-item reader is disposed and the source list mutates again

`list.deriveCollection(callback)` creates per-item `Memo`s (documented, and correctly so — see "Working baseline" below). But if **any** per-key reader of that `Collection` is torn down via scope disposal (exactly what `reconcile()` does when a keyed row leaves — `src/helpers/reactive.ts`, the `disposers.get(key)?.()` call), a **separate**, still-live memo that reduces over the `Collection`'s aggregate `.get()` permanently stops updating after the *next* structural mutation of the source `List` (e.g. `list.add()`). Not a timing/scheduling issue — confirmed stuck across 10 successive 200ms polls in a real browser.

### Working baseline (no scope disposal involved — this part is fine)

```ts
import { createList, createStore, createMemo, createEffect } from '@zeix/cause-effect'

const list = createList(
  [{ id: 'item1', amount: 3, pricePerUnit: 12.5 }, { id: 'item2', amount: 5, pricePerUnit: 8 }],
  { keyConfig: item => item.id, createItem: createStore },
)

const rowPrices = list.deriveCollection(item => item.amount * item.pricePerUnit)
const priceTotal = createMemo(() => rowPrices.get().reduce((s, v) => s + v, 0))

const seen: number[] = []
createEffect(() => seen.push(priceTotal.get()))
console.log(seen) // [77.5]

list.byKey('item1')!.amount.set(4)
console.log(seen) // [77.5, 90] — correct, live field edits work

list.add({ id: 'item3', amount: 2, pricePerUnit: 10 })
console.log(seen) // [77.5, 90, 110] — correct, plain add works
```

This much is solid — `deriveCollection` handles live field edits and simple structural `add()` correctly when nothing disposes a per-item reader.

### Failing repro — needs `reconcile()`, not just `deriveCollection`

This is the exact shape used in `module-calctable.ts`: `reconcile()` mounts, per keyed row, a `createScope({ root: true })` around `bindItem`, and disposes that scope when the key leaves the source list (`list.remove()`). If `bindItem` reads `rowPrices.byKey(key)` inside an effect, and a *different* memo elsewhere reads `rowPrices.get()`, the aggregate memo dies after remove+add:

```ts
// bun:test, using the project's real reconcile() and the stub-DOM harness
// from src/tests/reconcile.test.ts (FakeElement / makeTemplate / tick),
// omitted here for brevity — see that file for the harness.
import { createList, createStore, createMemo, createEffect } from '@zeix/cause-effect'
import { reconcile } from '../helpers/reactive'
// ...install a throwaway active collector as reconcile.test.ts does...

const list = createList(
  [{ id: 'item1', amount: 3, pricePerUnit: 12.5 }, { id: 'item2', amount: 5, pricePerUnit: 8 }],
  { keyConfig: item => item.id, createItem: createStore },
)

const rowPrices = list.deriveCollection(item => item.amount * item.pricePerUnit)
const priceTotal = createMemo(() => rowPrices.get().reduce((s, v) => s + v, 0))

reconcile(container, template, list, (_element, _item, key) => {
  const priceSignal = rowPrices.byKey(key)
  if (!priceSignal) return
  return createEffect(() => { priceSignal.get() }) // per-row reader; disposed by reconcile() when `key` leaves
})()

const seen: number[] = []
createEffect(() => seen.push(priceTotal.get()))
await tick()
console.log(seen) // [77.5]

list.byKey('item1')!.amount.set(0)
list.remove('item1')          // disposes item1's per-row reader effect via reconcile()'s scope teardown
await tick()
console.log(seen) // [77.5, 40] — correct so far

list.add({ id: 'item3', amount: 2, pricePerUnit: 10 })
await tick()
console.log(seen) // BUG: stays [77.5, 40] forever — expected [..., 60]
```

**Expected:** final value `60` (40 from `item2` + 20 from the new `item3`).
**Actual:** `priceTotal` never recomputes again after the `add()` — permanently stuck at `40`, confirmed in both the `bun:test` stub-DOM harness and a real headless-Chromium run of the actual component (10× 200ms polls, no change).

### Isolating the trigger

Re-running the exact same repro with a **no-op** `bindItem` (i.e. `reconcile()` present, scopes created and disposed on remove, but nothing ever calls `rowPrices.byKey(key)`) makes the bug disappear — `priceTotal` correctly reaches `60`. So the trigger is specifically: **a per-key `Collection` reader gets disposed (via `createScope` teardown), and afterwards a separate live reader of the same `Collection`'s aggregate stops seeing further structural updates.** This smells like a "watched"-lifecycle bug — `src/nodes/collection.ts` has a `subscribe()`/`makeSubscribe(node, options?.watched)` pattern (mirroring `List`/`Store`) where the collection presumably activates on first subscriber and tears down internal state on last-unsubscribe; if the per-item reader's disposal transiently drops the subscriber count in a way that corrupts that lifecycle before `priceTotal`'s own effect re-establishes its edge, later structural changes would never re-arm it. (Speculative — the actual mechanism wasn't traced further than this; `collection.ts` mentions this exact scenario in a comment: `// No subscribers yet (e.g., chained deriveCollection init) — compute value without establishing graph edges to prevent premature watched activation on upstream sources.`, which may be related.)

### Workaround used in `module-calctable.ts`

Dropped `deriveCollection` entirely. Both the per-row price display (inside `reconcile()`'s `bindItem`) and the footer totals compute `item.amount.get() * item.pricePerUnit.get()` directly per item — no shared `Collection`, so no cross-reader interference is possible:

```ts
reconcile(container, template, list, (element, item) => {
  // ...
  return createEffect(() => {
    priceOutput.textContent = formatter.format(
      item.amount.get() * item.pricePerUnit.get(),
    )
  })
})

const priceTotal = createMemo(() => {
  let sum = 0
  for (const item of list) sum += item.amount.get() * item.pricePerUnit.get()
  return sum
})
```

Confirmed reliable through the full interaction sequence (live edit → remove-on-zero → add-from-entry-row) in a real browser, with the resulting totals verified correct at every step.

---

## Why this matters for the release

Both patterns — `List<T, Store<T>>` for per-item-reactive keyed records, and `deriveCollection()` for derived per-row values — are the documented, idiomatic way to build exactly this kind of UI (an editable table with row-level and aggregate reactivity). Bug 1 makes `list.get()` unsafe to use in a memo/effect whenever items are `Store`s. Bug 2 makes `deriveCollection()` unsafe to share between a per-item consumer that can be disposed (any `reconcile()`-driven UI) and an aggregate consumer. Neither failure throws or warns — both fail silently with stale-forever values, which is the worst failure mode for a reactive primitive.
