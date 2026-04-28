---
title: "Effects API"
description: "Reference for watch-related types, pass, each, and the deferred effect result model."
---

Import path for everything on this page:

```ts
import {
  each,
  type EffectDescriptor,
  type FactoryResult,
  type Falsy,
  type PassedProps,
  type PassHelper,
  type Reactive,
  type WatchHelper,
} from '@zeix/le-truc'
```

Source files: `index.ts`, `src/effects.ts`, `types/src/effects.d.ts`.

## Core Types

```ts
type Falsy = false | null | undefined | '' | 0 | 0n

type EffectDescriptor = () => MaybeCleanup

type FactoryResult = Array<EffectDescriptor | FactoryResult | Falsy>

type Reactive<T, P extends ComponentProps> =
  | keyof P
  | Signal<T & {}>
  | (() => T | Promise<T> | null | undefined)

type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
  [K in keyof Q & string]?: Reactive<Q[K], P> | SlotDescriptor<Q[K] & {}>
}
```

These types explain the grammar of a component factory: return nested arrays of descriptors, optionally mixed with falsy guards, and point watchers or pass-through props at property names, signals, or derived functions.

## `WatchHelper<P>`

```ts
type WatchHelper<P extends ComponentProps> = {
  <K extends keyof P & string>(
    source: K,
    handler: (value: P[K]) => MaybePromise<MaybeCleanup>,
  ): EffectDescriptor
  <K extends keyof P & string>(
    source: K,
    handlers: SingleMatchHandlers<P[K]>,
  ): EffectDescriptor
  <T extends {}>(
    source: Signal<T>,
    handler: (value: T) => MaybePromise<MaybeCleanup>,
  ): EffectDescriptor
  <T extends {}>(
    source: Signal<T>,
    handlers: SingleMatchHandlers<T>,
  ): EffectDescriptor
  <T extends {}>(
    source: () => T | Promise<T> | null | undefined,
    handler: (value: T) => MaybePromise<MaybeCleanup>,
  ): EffectDescriptor
  <T extends {}>(
    source: () => T | Promise<T> | null | undefined,
    handlers: SingleMatchHandlers<T>,
  ): EffectDescriptor
  (
    source: Array<Reactive<NonNullable<unknown>, P>>,
    handler: (values: any[]) => MaybePromise<MaybeCleanup>,
  ): EffectDescriptor
}
```

### Example

```ts
watch('count', bindText(output))
watch(['count', 'label'], ([count, label]) => {
  combined.textContent = `${count}:${label}`
})
watch(taskSignal, {
  ok: value => render(value),
  nil: () => showLoading(),
  err: error => showError(error.message),
})
```

## `PassHelper<P>`

```ts
type PassHelper<P extends ComponentProps> = {
  <Q extends ComponentProps>(
    target: (HTMLElement & Q) | Falsy,
    props: PassedProps<P, Q>,
  ): EffectDescriptor
  <Q extends ComponentProps>(
    target: Memo<(HTMLElement & Q)[]> | Falsy,
    props: PassedProps<P, Q>,
  ): EffectDescriptor
}
```

### Example

```ts
pass(first('basic-number'), { value: 'count' })
pass(all('basic-number.group'), { value: 'count' })
```

## `each<E>`

```ts
function each<E extends Element>(
  memo: Memo<E[]>,
  callback: (element: E) => FactoryResult | EffectDescriptor | Falsy | void,
): EffectDescriptor
```

Use `each()` when a selector memo produces a changing set of elements and each element should get its own scope, watchers, and listeners.

### Example

```ts
each(all('li'), item => {
  const index = Number(item.dataset.index ?? -1)
  return [
    watch('selected', selected => {
      item.classList.toggle('active', selected === index)
    }),
    on(item, 'click', () => ({ selected: index })),
  ]
})
```

## Practical Notes

- `watch()` is source-driven. Incidental reads inside the handler are wrapped in `untrack()`.
- `pass()` only swaps slot-backed descendant properties.
- `each()` is usually the clearest choice for non-bubbling events on a dynamic collection.
