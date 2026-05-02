# Cause-Effect Integration

How @zeix/le-truc uses @zeix/cause-effect internally. This is NOT a full cause-effect API reference.

## Re-export Surface

Le Truc re-exports the entire cause-effect public API from its own entry point. Consumers of le-truc do not need a separate `@zeix/cause-effect` install.

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

## Slot — Backing Store for Every Reactive Prop

Every mutable reactive property defined via `expose()` is backed by a `Slot` from cause-effect. The `Slot` is an indirection layer: its `get`/`set` are installed as a property descriptor on the component instance via `#setAccessor` in `src/component.ts`.

This design enables two things:
1. Reading `host.propName` inside a `createEffect` registers the signal as a dependency automatically
2. `pass()` can swap the backing signal (`slot.replace(parentSignal)`) without redefining the property descriptor

The cleanup in `pass()` restores the original signal when the parent disconnects.

## Memo — `all()` Element Collection

`all(selector, required?)` returns a `Memo<E[]>` created by `createElementsMemo()` in `src/ui.ts`. If `required` is a non-empty string and no elements match at query time, a `MissingElementError` is thrown before the Memo is returned.

The `Memo` uses the `watched` option to set up a `MutationObserver` lazily — the observer only activates when the Memo has an active reactive reader.

The `equals` option uses element-identity comparison. Since cause-effect, `equals` is fully respected by `invalidate()` — effects skip re-runs when the matched element set has not changed.

## Sensor — Advanced Async or Callback-Driven State

`createSensor<T>` from cause-effect is re-exported by le-truc. It creates a reactive value that is only writable from within its own setup callback. It activates lazily (when first read inside a reactive context) and deactivates when it has no more readers.

For event-driven component props, use `createState` + `on` instead — the setup is explicit, the listener attaches at connect time, and there is no delegation. `createSensor` is appropriate when the value source is asynchronous or requires complex lifecycle management beyond what `on()` provides.

## createScope — Effect Lifetime

`connectedCallback` wraps all component effects in a `createScope()`. This scope is created in `connectedCallback` and disposed in `disconnectedCallback` via the stored cleanup function.

`pass()` and `on()` also use `createScope()` for their own cleanup, nested within the component scope. This ensures event listeners and signal subscriptions are correctly torn down when the component disconnects.

## createEffect — Reactive DOM Updates

`watch()` (via `makeWatch`) wraps `match()` inside `createEffect()`. The `createEffect` is nested inside the `createScope` created in `connectedCallback`. This is why `watch` returns an `EffectDescriptor` — the effect is deferred until after dependency resolution.

For `all()` targets, `each()` wraps the per-element effect loop in an outer `createEffect` that tracks the Memo. When the Memo invalidates (element set changes), the outer effect re-runs, creating new inner scopes for new elements and disposing scopes for removed ones.

## batch — Event Handler Updates

When an `on()` handler returns a partial props object `{ prop: value }`, le-truc applies all returned entries to `host` in a single `batch()` call:

```typescript
batch(() => {
  for (const [key, value] of Object.entries(result)) {
    host[key] = value
  }
})
```

`batch()` defers effect propagation until all signal updates are complete.

## Key cause-effect Constraints that Affect le-truc Development

- **`T extends {}`** — no `null` or `undefined` in signal generics. Le-truc parsers must return `T`, not `T | null`. Use wrapper types or fallback values.
- **`createEffect` must be inside an owner.** Always nest inside `createScope()` or another effect. In le-truc, the component scope is the owner.
- **`unown`** — used in test environments or SSR contexts where effects should not be tracked by a parent scope. Rarely needed in le-truc source.
- **`match`** — handles the `nil` (unset) and `err` states of `Sensor` and `Task`. Used in components with sensor-driven props to handle the pre-first-event state.
