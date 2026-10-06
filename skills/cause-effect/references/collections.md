# Collections: Store, List, DerivedList

Describes @zeix/cause-effect 1.6.x. Only the behaviors that differ from what a plain object or array suggests.

## MutableStore (`createStore`)

- Properties convert by shape. A plain object (prototype `Object.prototype`) becomes a nested `MutableStore`, an array becomes a `MutableList`, and anything else becomes a `State`, including a `Date`, a `Map` or a class instance. The only option is `{ watched }`; there is no `equals` or `guard`.
- `store.name` is the property's **signal**, so destructuring keeps reactivity. Assigning, deleting or defining a property through the proxy throws `InvalidStoreMutationError`. Write with `store.name.set(v)`, `store.set(next)`, `store.update(fn)`, `store.add(key, v)` or `store.remove(key)`.
- A data key named `get`, `set`, `update`, `keys`, `add`, `remove` or `byKey` is shadowed by the method of that name. Reach it with `store.byKey('set')`.
- Property access (`store.b?.get()`) does not subscribe to the store's key set. An effect that read `store.b` before `store.add('b', …)` does not re-run. Track structure with `store.keys()`, iteration, or `store.get()`.
- `store.set(next)` diffs deeply and updates only the changed properties. A property whose shape changes (primitive, record, array) gets a **new** child signal, so a reference held to the old child goes stale. Iterating yields `[key, signal]` pairs.

## MutableList (`createList`)

- Iteration, `at(i)` and `byKey(key)` return **item signals**, not values. Use `.get()` for the plain array.
- `map((item, key) => …)` and `forEach((item, key) => …)` (also on `DerivedList`) pass the item **signal** and its stable key, value first as in `Map.prototype.forEach`. `map` returns a plain array snapshot, not a signal; use `deriveList` for a reactive mapping. Like iteration, both subscribe to the list structure only.
- Options are `keyConfig`, `itemEquals` (default `DEEP_EQUALITY`), `createItem` and `watched: () => Cleanup`. There is no `equals` or `guard`.
- `keyConfig` decides what identity survives a `list.set(next)`:
  - omitted: position is identity, and a changed item at index *i* keeps its key.
  - string prefix (`'item-'`): a changed item at a position is retired and re-added under a **new** key.
  - function `item => key`: content-based, so keys survive reordering. A returned `undefined` falls back to a counter. A duplicate key throws `DuplicateKeyError`.
- `sort()` without a comparator compares `String(a).localeCompare(String(b))`: `[10, 9, 100]` sorts to `[10, 100, 9]`, and objects all compare as `"[object Object]"`.
- `remove()` accepts a key or an index. `add()` returns the new key. `replace(key, v)` is a no-op for a missing key or a deep-equal value.

## DerivedList (`deriveList`) — read-only

- `deriveList(source, itemFn)` accepts a `MutableList`, a `DerivedList`, **or any `Signal<T[]>`** (Memo, Task, State, Slot). A plain array signal is keyed on read with `keyConfig` (positional by default). An unresolved Task source reads as `[]`.
- Per-item results compare with `DEEP_EQUALITY`. A fresh but deep-equal object from `itemFn` does not re-notify the list's subscribers.
- Items whose per-item result is nullish, or whose async per-item Task has not resolved yet, are left out of `.get()` but still count in `.keys()`/`.length`.
- External push, `deriveList(seed, { watched: apply => cleanup })`: `apply({ add, change, remove })` matches `change`/`remove` entries by the exact tracked object reference, unless `keyConfig` is a function. An untracked item throws `UnresolvableKeyError`. A mutation pushed through `apply` does not restart the `watched` lifecycle.
- Reading a derived list activates `watched` callbacks up the whole chain. Cleanup cascades upstream when the last subscriber leaves.

## DerivedStore (`deriveStore`) — read-only

- Built from a sync function, an async function (`{ initial }`), or a seed record with `{ watched: emit => cleanup }`, where `emit(patch)` shallow-merges.
- Each property is a deep-equal Memo over the source, so readers get per-property granularity. Nested values are **not** converted into stores or lists. Properties are typed `Signal | undefined`, so read them as `user.name?.get()`.
- `isMutableStore` rejects a `DerivedStore`. The deprecated `isStore`, and `isMutableSignal`, accept both.
