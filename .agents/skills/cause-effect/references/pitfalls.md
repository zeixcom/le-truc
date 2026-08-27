# Cause & Effect — Pitfalls & Sharp Edges

Verified against `@zeix/cause-effect` 1.5.2 `src/`. Each entry: the trap, why it happens, and the one-line fix. When the README and `src/` disagree, `src/` wins (two entries below correct common misreadings).

## 1. `T extends {}` — no `null` / `undefined` in signal values

All signal generics enforce `T extends {}`, which excludes `null` and `undefined` at the type level. At runtime, `validateSignalValue` throws `NullishSignalValueError` on a nullish value.

```ts
createState<string | null>(null)   // ✗ type error
createState<string | undefined>()  // ✗ type error
```

**Fix:** model absence with a wrapper (`{ value: string | null }`, an option/either type, or an explicit sentinel), or use an unseeded `Task`/`Sensor` + `match()`'s `nil` branch to represent "no value yet" — that is exactly what `nil` is for.

## 2. `.set()` stores functions; `.update()` is the updater

A common confusion (reinforced by some signal libraries): expecting `state.set(fn)` to treat `fn` as an updater. In cause-effect **`.set(next)` stores `next` verbatim** — `state.ts`'s `set` calls `setState(node, next)` with no function-invocation branch. To compute from the previous value, use `.update(fn)`.

```ts
const f = () => 42
state.set(f)            // stores the function itself as the value
state.update(prev => prev + 1)   // ← this is the updater
```

Consequence: if you actually *want* a signal whose value is a function, `state.set(fn)` does the right thing — it stores the function, it does not call it. There is no ambiguity to wrap around.

## 3. Top-level effects leak — wrap them in `createScope`

`createEffect` does **not** throw without an owner (inspect `effect.ts`: it only does `if (activeOwner) registerCleanup(activeOwner, dispose)`). But a top-level effect with no active owner is **never auto-disposed** — its cleanup runs only when you call the returned `dispose()`, so it (and its subscriptions) leak for the lifetime of the page.

**Fix:** wrap top-level effects in `createScope(() => { createEffect(...) })`, or — when an external lifecycle owns teardown — `createScope(() => { ... }, { root: true })` and call the returned `dispose()` from that lifecycle (e.g. `disconnectedCallback`). Le Truc's `connectedCallback` already provides the owner scope for component effects.

Note: **`match()` is the one primitive that *does* throw without an owner** — `RequiredOwnerError('match')` — because it registers async-handler cleanup on the owner.

## 4. Scopes/effects created inside a re-runnable effect are disposed on every re-run

When an effect re-runs, its cleanups run first — and that includes any scope/effect it created via auto-registration. So per-element or cached scopes created naively inside an effect vanish on the next dep change.

```ts
createEffect(() => {
  // ✗ disposed every time the element set changes — loses per-item state
  const dispose = createScope(() => { /* per-item effect */ })
})
```

**Fix:** create such scopes with `{ root: true }` and track them manually (keyed by element/key) so you dispose only the ones whose element left the set. This is the exact mechanism behind le-truc's `each()` per-element loop — see `../le-truc-dev/references/cause-effect-integration.md`.

## 5. Synchronous Memo/Slot callbacks must not return a Promise (`PromiseValueError`)

`createMemo` validates its callback is a sync function, and at recompute time the engine checks the return value: if it's a `Promise`, `recomputeMemo` throws `PromiseValueError` (it will not silently cache the Promise as the value). The same applies to `deriveCell` (deprecated aliases `createComputed`, `deriveSignal`) when it commits to the sync path.

```ts
createMemo(() => fetch(url).then(r => r.json()))  // ✗ PromiseValueError on first read
```

**Fix:** make the callback `async` and use `createTask` (or `deriveCell`, which auto-detects `async`). The sync/async split is decided **statically** by inspecting the function prototype, before it ever runs — so forgetting `async` on a function that returns a Promise commits to the sync path and fails later, not upfront.

## 6. Async effect handlers can't be cancelled — keep them free of state writes

An `ok`/`err` handler in `match()` may return a `Promise` (for fire-and-forget side effects: DOM, analytics, logging, IndexedDB). But the library did not start the underlying operation, so it **cannot cancel it** when the effect re-runs. If that stale operation eventually rejects, the rejection is routed to `err` even though a newer run is already active.

**Fix:** use async handlers only for pure external side effects. If the async result needs to drive reactive state, model it as a `Task` — Tasks receive an `AbortSignal`, auto-cancel on re-run, and expose pending/error as first-class reactive values. Never call `.set()` on a signal inside an async handler: once run 2 has landed, a stale write from run 1 corrupts the graph.

## 7. Unseeded Task first read throws → routes to `nil`, not `stale`

`stale` in `match()` fires only when a signal has a **retained** value AND `isPending(signal)`. An unseeded Task has no retained value, so its first read throws `UnsetSignalValueError`, which routes to `nil`. Routing precedence is `nil` > `err` > `stale` > `ok`.

```ts
const data = createTask(async (_, s) => fetch('/x', { signal: s }).then(r => r.json()))
createEffect(() => match(data, {
  ok: render,
  stale: () => showSpinner(),   // ✗ never fires on first run — nil does
}))
```

**Fix:** seed with `{ value }` to get `stale` semantics on subsequent refreshes, and/or provide a `nil` handler for the initial unset state. Remember `stale` is a **thunk** (no arguments) — the retained value is intentionally withheld; the stale-display concern belongs in `stale`'s returned cleanup, not a second render.

## 8. `untrack` vs `unown` — dependency tracking vs ownership registration

These answer different questions and are not interchangeable:

| | Reads tracked? | Ownership registered? |
|---|---|---|
| `untrack(fn)` | No (no edges linked) | Yes (still inside current owner) |
| `unown(fn)` | Yes | No (scopes/effects inside don't attach to current owner) |

```ts
createEffect(() => {
  const name = untrack(() => label.get())  // read label without depending on it
  console.log(`${name}: ${count.get()}`)    // re-runs only when count changes
})
```

Use `untrack` to read a signal without subscribing. Use `unown` to create a scope/effect whose lifetime is independent of the current (possibly re-runnable) owner.

## 9. `.byKey(key).set()` on a List doesn't reach all subscribers

`List.byKey(key)` returns the item's **own** signal. Writing to it updates that item but is **not guaranteed** to propagate to subscribers that read the list structurally (`.keys()`, `.length`, the iterator).

**Fix:** update an existing item with `.replace(key, value)` — it propagates to all subscribers regardless of how they subscribed.

## 10. Direct Store proxy mutation throws (`InvalidStoreMutationError`)

Because `Store` uses a Proxy, plain assignment / `delete` / `Object.defineProperty` on a property are intercepted and rejected: `Cannot assign to property "x" directly — use store.x.set(value), store.set(next), or store.add(key, value)`.

**Fix:** use the property's own signal (`store.x.set(v)` / `.update(fn)`), `store.set(nextObj)` to replace wholesale, or `.add(key, value)` / `.remove(key)` for dynamic keys.

## 11. Conditional reads delay `watched` activation

Dependencies are tracked based on which `.get()` calls actually execute. If a read sits inside an untaken branch (e.g. inside `match()`'s `ok` branch while a Task is pending), the source's `watched` callback won't activate until that branch eventually runs.

**Fix:** read signals eagerly before conditional logic to force immediate activation:

```ts
createEffect(() => {
  match([task, derived], {   // `derived` is always tracked, even while task is pending
    ok: ([result, values]) => renderList(values, result),
    nil: () => showLoading(),
  })
})
```
