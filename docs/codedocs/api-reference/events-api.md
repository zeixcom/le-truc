---
title: "Events API"
description: "Reference for the typed event helper surface exposed through the factory context."
---

Import path for everything on this page:

```ts
import {
  type EventType,
  type OnEventHandler,
  type OnHelper,
} from '@zeix/le-truc'
```

Source files: `index.ts`, `src/events.ts`, `types/src/events.d.ts`.

Le Truc does not export a standalone `on()` function. Instead, `on` is provided through `FactoryContext`, and its callable shape is described by the following exported types.

## `EventType<K>`

```ts
type EventType<K extends string> =
  K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event
```

This is the conditional type that narrows standard event names such as `'click'` or `'input'` to the correct DOM event class.

## `OnEventHandler<P, Evt, E>`

```ts
type OnEventHandler<
  P extends ComponentProps,
  Evt extends Event,
  E extends Element,
> = (
  event: Evt,
  element: E,
) => { [K in keyof P]?: P[K] } | Falsy | void | Promise<void>
```

Return a plain object for synchronous host property updates. Returning `Promise<void>` is allowed for fire-and-forget side effects, but the resolved value is ignored.

## `OnHelper<P>`

```ts
type OnHelper<P extends ComponentProps> = {
  <E extends Element, T extends keyof HTMLElementEventMap>(
    target: Memo<E[]> | Falsy,
    type: T,
    handler: OnEventHandler<P, HTMLElementEventMap[T], E>,
    options?: AddEventListenerOptions,
  ): EffectDescriptor
  <E extends Element>(
    target: Memo<E[]> | Falsy,
    type: string,
    handler: OnEventHandler<P, Event, E>,
    options?: AddEventListenerOptions,
  ): EffectDescriptor
  <E extends Element, T extends keyof HTMLElementEventMap>(
    target: E | Falsy,
    type: T,
    handler: OnEventHandler<P, HTMLElementEventMap[T], E>,
    options?: AddEventListenerOptions,
  ): EffectDescriptor
  <E extends Element>(
    target: E | Falsy,
    type: string,
    handler: OnEventHandler<P, Event, E>,
    options?: AddEventListenerOptions,
  ): EffectDescriptor
}
```

## Example

```ts
return [
  on(button, 'click', () => ({ count: host.count + 1 })),
  on(inputs, 'keydown', event => event.key === 'Enter' && { submitted: true }),
]
```

Implementation notes from `src/events.ts`:

- bubbling events on `Memo<Element[]>` targets use delegation from `host.shadowRoot ?? host`,
- non-bubbling events fall back to per-element listeners,
- passive high-frequency events are throttled with `throttle()`,
- object returns are applied inside `batch()` so multiple prop writes flush together.
