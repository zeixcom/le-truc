<overview>
How @zeix/le-truc uses @zeix/cause-effect internally.
This is NOT a full cause-effect API reference — for that, use the cause-effect or cause-effect-dev skill.
This file covers only how le-truc wires cause-effect into its own system.
</overview>

## Re-export surface

Le Truc re-exports the entire cause-effect public API from its own `index.ts`. Consumers of le-truc do not need a separate `@zeix/cause-effect` install.

```typescript
// All of these come from @zeix/cause-effect, re-exported by @zeix/le-truc:
import {
  createState, createMemo, createSensor, createTask,
  createEffect, createScope, createSlot, createStore,
  createList, createCollection, deriveCollection,
  batch, untrack, unown, match,
  isState, isMemo, isSignal, isFunction, isRecord,
} from '@zeix/le-truc'
```

## Slot — backing store for every reactive prop

Every mutable reactive property defined in `props` is backed by a `Slot` from cause-effect. The `Slot` is an indirection layer: its `get`/`set` are installed as a property descriptor on the component instance via `#setAccessor`.

This design enables two things:
1. Reading `host.propName` inside a `createEffect` registers the signal as a dependency automatically.
2. `pass()` can swap the backing signal (`slot.replace(parentSignal)`) without redefining the property descriptor.

The cleanup in `pass()` restores the original signal (`slot.replace(original)`) when the parent disconnects.

## Memo — `all()` element collection

`all(selector)` returns a `Memo<E[]>` created by `createElementsMemo()` in `src/ui.ts`. The `Memo` uses the `watched` option to set up a `MutationObserver` lazily — the observer only activates when the Memo has an active reactive reader.

The `equals` option uses element-identity comparison (`a.length === b.length && a.every((el, i) => el === b[i])`). Since cause-effect 0.18.4, `equals` is fully respected by `invalidate()` — effects skip re-runs when the matched element set has not changed.

## Sensor — event-driven readonly props

`createEventsSensor(init, key, events)` in `src/events.ts` wraps a cause-effect `Sensor<T>` for event delegation. The sensor activates when first read and deactivates when it has no more readers. Used for form state props (e.g., `checked` on a checkbox).

## createScope — effect lifetime

`runEffects` wraps all component effects in a `createScope()`. This scope is created in `connectedCallback` and disposed in `disconnectedCallback` via the cleanup function returned by `runEffects`.

Individual effects (`on()`, `pass()`) also use `createScope()` for their own cleanup, nested within the component scope. This ensures event listeners and signal subscriptions are correctly torn down when the component disconnects.

## createEffect — reactive DOM updates

`updateElement` (the shared abstraction for most built-in effects) calls `createEffect()` to create a reactive computation that re-runs when its signal dependencies change. The `createEffect` is nested inside the `createScope` created by `runEffects`.

For `all()` targets, `runEffects` wraps the per-element effect loop in an outer `createEffect` that tracks the Memo. When the Memo invalidates (element set changes), the outer effect re-runs, creating new inner effects for new elements.

## batch — event handler updates

When an `on()` handler returns a partial props object `{ prop: value }`, le-truc applies all returned entries to `host` in a single `batch()` call:

```typescript
batch(() => {
  for (const [key, value] of Object.entries(result)) {
    host[key] = value
  }
})
```

`batch()` defers effect propagation until all signal updates are complete.

## Key cause-effect constraints that affect le-truc development

- **`T extends {}`** — no `null` or `undefined` in signal generics. Le-truc parsers must return `T`, not `T | null`. Use wrapper types or fallback values.
- **`createEffect` must be inside an owner.** Always nest inside `createScope()` or another effect. In le-truc, the component scope is the owner.
- **`unown`** — used in test environments or SSR contexts where effects should not be tracked by a parent scope. Rarely needed in le-truc source.
- **`match`** — handles the `nil` (unset) and `err` states of `Sensor` and `Task`. Used in components with sensor-driven props to handle the pre-first-event state.
