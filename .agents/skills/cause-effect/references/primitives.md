# Cause & Effect — Primitive Reference

Per-primitive signatures, laziness/`watched` activation, equality, and canonical examples. Sourced from `@zeix/cause-effect` 1.5.2 `src/` and README — when they disagree, `src/` wins. This file selects and warns; it does not mirror the README (read it directly in `node_modules/@zeix/cause-effect/README.md` for the full tour).

All signals enforce `T extends {}` — `null` and `undefined` are rejected at the type level and throw `NullishSignalValueError` at runtime (see `pitfalls.md`).

## Common shape

Every signal has `.get()`. Inside an effect/memo/task, `.get()` both returns the value and registers a dependency edge (explicit reactivity — no hidden subscriptions). Outside a reactive context `.get()` just returns the current value.

`SignalOptions<T>` (accepted by most creators):

- `equals?: (a: T, b: T) => boolean` — default `===` (`DEFAULT_EQUALITY`). When equal, propagation stops for this signal's **entire downstream subtree**, not just this signal. Built-ins: `DEEP_EQUALITY` (structural, cycle-safe), `SKIP_EQUALITY` (always re-propagate — for mutable objects observed by reference).
- `guard?: (value: unknown) => value is T` — validates on `.set()`/`.update()`; throws `InvalidSignalValueError` on failure.

## State

```ts
createState<T extends {}>(value: T, options?: SignalOptions<T>): State<T>
```

Mutable source. API: `get()`, `set(next: T)`, `update(fn: (prev: T) => T)`. `.set()` **stores** the value — it does not invoke a function argument (that is what `.update()` is for; see `pitfalls.md`). Use for primitives or objects you replace wholesale.

```ts
const count = createState(42)
count.set(24)
count.update(v => ++v)
```

## Sensor

```ts
createSensor<T extends {}>(
  watched: (set: (next: T) => void) => Cleanup,
  options?: SensorOptions<T>   // SignalOptions & { value?: T }
): Sensor<T>   // read-only
```

Read-only external input. `watched` runs when the sensor gains its **first** downstream subscriber; its returned `Cleanup` runs when the **last** subscriber leaves (lazy resource lifecycle). `.get()` **throws `UnsetSignalValueError`** before the first event unless `{ value }` seeds it — so for unseeded sensors, always route through `match()`'s `nil` branch.

`watched` must be a **sync** function (`isSyncFunction` is validated) — never `async`.

```ts
const mousePos = createSensor((set) => {
  const handler = (e: MouseEvent) => set({ x: e.clientX, y: e.clientY })
  window.addEventListener('mousemove', handler)
  return () => window.removeEventListener('mousemove', handler)
}, { value: { x: 0, y: 0 } })
```

Mutable-object observation (same reference, internal state changes): use `{ equals: SKIP_EQUALITY }` and re-`set` the same node from a `MutationObserver`.

## Memo

```ts
createMemo<T extends {}>(
  fn: (prev: T | undefined) => T,
  options?: ComputedOptions<T>   // SignalOptions & { value?: T, watched? }
): Memo<T>   // read-only
```

Synchronous memoized derivation. Lazy — recomputes only when a tracked dependency actually changed **and** something reads it. The callback receives `prev` (the previous value, or `undefined` on first run), enabling reducer patterns with `{ value: T }`.

For cheap/simple derivations a **plain function** `() => count.get() * 2` is often faster than a Memo — reserve `createMemo` for expensive, shared, or stateful derivations.

Deprecated type alias: `Memo` — no mechanical replacement (removed at 2.0; origin is no longer part of the consumption contract). Annotate with `Signal<T>` instead, or the tighter `Cell<T>` (since 1.5.2) if the collection types (`List`/`Store`) genuinely don't apply; use `isSignal()`/`isMutableSignal()`/`isCell()` or a plain property check if you truly need to distinguish origin.

`watched?: (invalidate: () => void) => Cleanup` activates when the memo gains its first reader; `invalidate()` marks it dirty and triggers recomputation (e.g. a `MutationObserver` for DOM-query memos — this is how le-truc's `all()` works). **Conditional reads delay activation** — if a read sits inside an untaken branch, `watched` won't fire until that branch runs. Read signals eagerly before conditional logic to force immediate activation.

```ts
const counter = createMemo(prev => {
  switch (actions.get()) {
    case 'increment': return prev + 1
    case 'reset': return 0
    default: return prev
  }
}, { value: 0 })
```

## Task

```ts
createTask<T extends {}>(
  fn: (prev: T | undefined, signal: AbortSignal) => Promise<T>,
  options?: ComputedOptions<T>
): Task<T>   // read-only, +isPending()/abort()
```

Async derivation with automatic cancellation. When dependencies change mid-flight, the previous run's `AbortSignal` aborts (pass it to `fetch`, etc.). API adds `isPending()` and `abort()`. `.get()` returns the last resolved value even while a new run is pending — but throws `UnsetSignalValueError` on first read unless `{ value }` seeds it.

`fn` must be an **`async`** function (`isAsyncFunction` is validated). A forget-`async` callback that still returns a Promise is misdetected as sync and throws `PromiseValueError` on first read (see `pitfalls.md`).

Use Task — not a plain async function — when you need memoization, cancellation, and reactive pending/error states. Pending/error are first-class reactive values that compose naturally with `match()`.

Deprecated type alias: `Task` — no mechanical replacement (removed at 2.0; origin is no longer part of the consumption contract). Annotate with `Signal<T>` instead, or the tighter `Cell<T>` (since 1.5.2) if the collection types (`List`/`Store`) genuinely don't apply; use the free functions `isPending(signal)`/`abort(signal)` in place of the deprecated `.isPending()`/`.abort()` methods.

```ts
const data = createTask(async (oldValue, abort) => {
  const response = await fetch(`/api/users/${id.get()}`, { signal: abort })
  if (!response.ok) throw new Error('Failed to fetch')
  return response.json()
})
id.set(2) // cancels the previous fetch automatically
```

## deriveCell (sync-or-async auto-detect)

```ts
deriveCell<T extends {}>(
  input: TaskCallback<T>, options?: DeriveCellOptions<T>): Cell<T>
deriveCell<T extends {}>(
  input: MemoCallback<T>, options?: DeriveCellOptions<T>): Cell<T>
```

Returns a `Memo` or a `Task` depending on whether `callback` is `async`. The decision is made **statically, before the callback ever runs** (it inspects the function prototype, not the return value). This is why a non-`async` function returning a Promise becomes a `Memo` that later throws `PromiseValueError` — the library already committed to the sync path.

`createMemo` and `createTask` are the explicit primitives; `deriveCell` is the convenience dispatcher. Le Truc uses `deriveCell` internally where the sync/async split is data-dependent. Deprecated aliases: `createComputed` and `deriveSignal` (same dispatch; `options.value` is `options.initial` on `deriveCell`). `deriveSignal` was itself the terminal name for one release (1.5.0) before `deriveCell` replaced it in 1.5.1 — `Signal` stays the umbrella term, `Cell` names the single-value shape.

Since 1.5.2, `deriveCell` (and its overloads) is typed to return `Cell<T>` — `State<T> | Memo<T> | Task<T> | Sensor<T>` — rather than the wider `Signal<T>`; still assignable anywhere `Signal<T>` is expected.

### Cell / MutableCell (since 1.5.2)

```ts
type Cell<T extends {}> = State<T> | Memo<T> | Task<T> | Sensor<T>
type MutableCell<T extends {}> = State<T>
isCell<T extends {}>(value: unknown): value is Cell<T>
isMutableCell<T extends {}>(value: unknown): value is MutableCell<T>
createCell<T extends {}>(value: T, options?: SignalOptions<T>): MutableCell<T>  // alias of createState
```

`Cell<T>` is a 1.x bridge for the v2.0 shape-indexed type model: a genuine structural narrowing of `Signal<T>` (each origin already carries its own `Symbol.toStringTag`), excluding `List`/`Store`/`Collection` at the type level with no runtime tag change. Use `Cell<T>` in place of `Signal<T>` wherever a value is known to never be a list or store. `isMutableCell` is equivalent to `isState`, exported under the forward-compatible name.

## Store

```ts
createStore<T extends UnknownRecord>(obj: T, options?: { watched?, equals?, guard? }): MutableStore<T>
```

Reactive object — each property (recursively, for nested plain objects) becomes its own signal, exposed via a Proxy: `user.age.get()`, `user.age.update(v => v + 1)`. Direct proxy mutation (`user.age = 30`, `delete user.x`, `Object.defineProperty`) throws `InvalidStoreMutationError` — use `.set()`/`.update()` on the property signal, `.add(key, value)`/`.remove(key)` for dynamic keys, or `store.set(nextObj)` to replace the whole object. Iterate keys reactively with `.keys()`; access by key with `.byKey(key)`. Deprecated type alias: `Store`.

## MutableList

```ts
createList<T extends {}>(arr: readonly T[], options?: { keyConfig?, watched?, equals?, guard? }): MutableList<T>
```

Reactive array with stable keys and per-item signals. `keyConfig` is either a string prefix (`'item-'` → `'item-0'`, `'item-1'`) or `(item: T) => string`. Keys are stable across sort/reorder. API: `.at(i)`, `.byKey(key)`, `.indexOfKey(key)`, `.keyAt(i)`, reactive `.length`, `.keys()`, `.add(item)` (returns the new key), `.remove(key)`, `.replace(key, value)`, `.sort()`, `.splice(...)`. Deprecated type alias: `List`.

**Update items with `.replace(key, value)`, not `.byKey(key).set()`.** `.byKey()` returns the item's own signal; calling `.set()` on it updates that item but is **not guaranteed** to reach subscribers that read the list structurally (`.keys()`, `.length`, the iterator). `.replace()` propagates to all subscribers regardless of how they subscribed. Unlike Store, deeply nested item properties are **not** converted to individual signals.

Duplicate keys throw `DuplicateKeyError`.

## DerivedList (deriveList)

```ts
deriveList<T extends {}>(input: () => T[], options?: DeriveListOptions<T>): DerivedList<T>
deriveList<T extends {}>(input: (prev: T[], abort: AbortSignal) => Promise<T[]>,
  options: DeriveListOptions<T> & { initial: T[] }): DerivedList<T>
deriveList<T extends {}>(input: T[], options: DeriveListOptions<T> & { watched: ListCallback<T> }): DerivedList<T>
deriveList<T extends {}, U extends {}>(input: ListSource<U>,
  itemCallback: (sourceValue: U) => T, options?: DeriveListOptions<U>): DerivedList<T>
```

Keyed derived list with item-level memoization. Three flavors:

- **Derived from a thunk or async function** — the fetch pipeline: `deriveList(fetchUsers, { initial: [], keyConfig })`. Cancellation and refresh are managed internally; `isPending(list)` exposes the async state.
- **Externally-driven** (`deriveList(seed, { watched })`) — receives data from WebSocket / SSE / etc. via the watched callback. Same lazy lifecycle as Sensor. Deprecated alias: `createCollection`. Since 1.5.2, a `change`/`remove` entry passed to `applyChanges()` that doesn't match an existing key throws `UnresolvableKeyError` instead of being silently dropped.
- **Derived from another list** (`deriveList(list, itemFn)`) — sync or async per-item mapping; chains compose data pipelines. Replaces the deprecated `.deriveCollection()` method. **Watched propagation:** reading a derived list activates the source's `watched` callback through every chain level; mutations on the source don't tear down the watcher; cleanup cascades upstream when the last effect disposes.

Deprecated type alias: `Collection`. `DerivedList` renames once more at 2.0 — it becomes the readonly `List` base there.

## Slot

```ts
createSlot<T extends {}>(
  initialSignal: Signal<T> | SlotDescriptor<T>,
  options?: SignalOptions<T>
): Slot<T>

type SlotDescriptor<T extends {}> = { get(): T; set?(next: T): void }
```

Stable reactive source that delegates to a **swappable** backing signal. Subscribers link to the slot itself, so `replace(nextSignal)` invalidates them without breaking edges. The slot object is shaped as an `Object.defineProperty` descriptor (`get`/`set`/`configurable`/`enumerable`) — install it directly as a property. A Slot is a **forwarding layer, not a value owner**: `set()` delegates to the backing signal (throws `ReadonlySignalError` if read-only), and **`update()` is intentionally absent**. `replace<U extends T>(next)` allows narrowing; `current()` returns the delegated signal.

This is what backs every le-truc reactive prop, and what `pass()` swaps — see `../le-truc-dev/references/cause-effect-integration.md`.

## Effect

```ts
createEffect(fn: () => MaybeCleanup): Cleanup
```

Terminal side-effect sink — consumes values, produces none. Runs immediately on creation, re-runs on dep changes, executed during the flush phase after updates batch. The returned function disposes the effect. If `fn` returns a function, it is registered as cleanup and runs **before each re-run and on dispose**.

**Owner behavior:** `createEffect` registers its cleanup on `activeOwner` *if one exists* — it does **not** itself throw on a missing owner. A top-level effect with no owner is never auto-disposed and will leak until you call the returned `dispose()`. (Only `match()` throws `RequiredOwnerError` outright.) Always create effects inside a `createScope` unless you intend to own the lifetime manually.

An effect that writes to a signal it also reads re-runs until the graph settles; graphs that never settle (unconditional self-increment, two effects writing each other's deps) throw `EffectConvergenceError` after a bounded number of flush passes.

## Coordination utilities

| Utility | Signature | Effect |
|---|---|---|
| `createScope(fn, { root })` | `(fn: () => MaybeCleanup, options?: ScopeOptions) => Cleanup` | Creates an ownership scope; returns a `dispose`. `{ root: true }` detaches from the parent owner — the `dispose` is the sole teardown. |
| `batch(fn)` | `(fn: () => void) => void` | Defers effect propagation until the outermost batch completes. Nestable. |
| `untrack(fn)` | `<T>(fn: () => T) => T` | Suppresses **dependency tracking** (reads don't link edges) for `fn`; still runs inside the current owner. |
| `unown(fn)` | `<T>(fn: () => T) => T` | Suppresses **ownership registration** (scopes/effects inside don't attach to the current owner) for `fn`; deps still tracked. |
| `match(signal(s), handlers)` | see SKILL.md | Routes on signal state (`nil`> `err` > `stale` > `ok`); **requires an active owner**. |

`untrack` and `unown` answer different questions — see `pitfalls.md` for the distinction.

## Polymorphic factories & predicates

- `createSignal(value)` — infers type from value: array → `MutableList`, plain object → `MutableStore`, async fn → `Task`, sync fn → `Memo`, else → `State`. Returns the input unchanged if it's already a signal. Deprecated alias: `createMutableSignal` (same call, restricted to mutable results).
- `isPending(signal)` — true while an async computation is in progress; reactive when read inside a computation; `false` without tracking for signals with no async origin. `abort(signal)` cancels the in-flight computation (no-op otherwise). Both work on any signal — asynchrony is an origin, not a shape.
- Predicates: `isSignal` (all 9 types), `isMutableSignal` (`MutableCell`/`MutableStore`/`MutableList`), `isSlot`, `isMutableList`, `isDerivedList`, `isMutableStore`, `isCell` (`State`/`Memo`/`Task`/`Sensor`, since 1.5.2), `isMutableCell` (`State`, since 1.5.2). The origin guards (`isState`, `isMemo`, `isTask`, `isSensor`, `isComputed`, `isList`, `isCollection`, `isStore`) are deprecated aliases — removed at 2.0 in favor of `isSignalOfType()`.

All type checks use `Symbol.toStringTag` branding (`isSignalOfType`), not structural duck-typing.
