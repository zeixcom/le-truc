# `map()` and `forEach()` on list signals (Cause & Effect 1.6.0)

Handoff from the Le Truc LT-280 design session (2026-10-04). It records the shape
agreed with the owner. Implement it in `cause-effect` and release it as a
non-breaking minor (1.6.0). Le Truc then bumps its dependency.

## Why

Le Truc compiles keyed lists written in JSX. In `.tsx` a reactive list is
spelled as a `.map()` call:

```tsx
<ul>
  {items.map((item, key) => (
    <li>
      <span>{() => item.get().label}</span>
      <button onClick={() => items.remove(key)}>Remove</button>
    </li>
  ))}
</ul>
```

For fine-grained client reactivity the callback has to receive each item's
**signal**, not its value. It also needs the item's stable **string key**. Today a
list offers `get()` (an array of values; the server would bake these in as plain
values), iteration over signals with no key, and `keys()`/`byKey()` (a key, then a
lookup). None of them fits the standard JSX `.map()` pattern. Calling `.map()` on a
list currently fails to typecheck, because no list type declares it.

## Shape

On both list kinds: the readonly `DerivedList` (`collection.ts`, returned by
`deriveList`, the v2.0 `List`) and `MutableList` (`list.ts`, returned by
`createList`). The deprecated aliases `Collection` and `List` (1.x meaning)
inherit it through the types.

```ts
map<R>(callbackfn: (item: S, key: string) => R): R[]
forEach(callbackfn: (item: S, key: string) => void): void
```

- **Arguments:** the item's signal `S` (for `createList` with
  `createItem: createStore` that is the `MutableStore<T>`), then its key. There is no
  third argument: `Array.prototype.map` passes the array and `Map.prototype.forEach`
  passes the map, but nothing needs it.
- **Order:** current list order, the same order as `keys()` and iteration.
- **Return:** `map` returns a plain `R[]` snapshot, not a signal. Reactive mapping
  over values stays `deriveList`'s job: `list.map` maps over the signals once,
  `deriveList` maps over the values reactively.
- **Tracking: structure only.** Like `keys()`, `byKey()` and iteration, the method
  calls `subscribe()` once. It never reads an item's value (`signal.get()`). Inside
  an effect, a `map`/`forEach` re-runs on add, remove, reorder or replace, but not
  when an item's content changes. Whatever reads happen inside `callbackfn` are the
  caller's, and they track as usual.
- **Precedent for the parameter order:** `Map.prototype.forEach((value, key) => …)`.
  A list is created from an array but keyed like a `Map`, by stable string keys.
  The second parameter is a `string` key, not an array index; tsc keeps the two
  apart by the receiver's type.

## Not in scope

- No `entries()`. The pair form was considered and dropped, because JSX
  consumes a `.map()` directly.
- No `filter`/`reduce`/`some` family. Values-side work goes through `get()` or
  `deriveList`.
- No key stamped on item signals (`item.key`). A signal does not know its key,
  and a stamped property would collide with a store field named `key`.

## Tests to add

- `map` and `forEach` visit every `[signal, key]` pair in list order, with
  `signal === list.byKey(key)`.
- An effect that only calls `map` re-runs on `add`, `remove`, `sort` and
  `splice`, and does **not** re-run on `list.byKey(k).set(…)` or
  `list.replace(k, …)` content changes that keep the key. (Check `replace` against
  the existing semantics: it notifies sinks, so confirm whether that is a structural
  notification and pin the answer.)
- The same pair of tests on a `deriveList` result.
- Type tests: `S` is inferred (`MutableStore<T>` under `createItem: createStore`),
  `key` is `string`, and `map`'s return is `R[]`.
