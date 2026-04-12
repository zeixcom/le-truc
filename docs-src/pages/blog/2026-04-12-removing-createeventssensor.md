---
title: Removing createEventsSensor
description: We removed createEventsSensor from Le Truc 2.0. Here is what it did, why we dropped it, and how to implement the same pattern yourself with createState and on.
emoji: 🗑️
layout: blog
date: 2026-04-12
author: Esther Brunner
tags: architecture, breaking-change
---

{% section %}
`createEventsSensor` shipped as a convenience for a specific pattern: a component property that is read-only to consumers, derived from DOM events, and never directly writable. The classic example is a text input's character count.

```ts#form-combobox.ts
expose({
  value: textbox.value,
  length: createEventsSensor(textbox, textbox.value.length, {
    input: () => textbox.value.length,
  }),
})
```

Three lines. Declarative. It looks clean until you read the implementation.

## What it actually does

`createEventsSensor` wraps `createSensor` from Cause & Effect. A `Sensor<T>` is a reactive value that can only be set from within its own setup callback — it has no public setter. That write-protection is the whole point: consumers can read `host.length`, but they cannot assign to it.

Two implementation details shaped how `createEventsSensor` behaved in practice:

**Event delegation.** Listeners were attached to `target`, but the handler checked `e.target.contains(eventTarget)` — so events from *children* of `target` also triggered the sensor. For an `<input>` element this is a no-op, since inputs have no children. For any container element it changes the behavior in a way that's easy to miss.

**Lazy listener setup.** The `Sensor` API is lazy: the setup callback (and therefore the event listener) only runs when the sensor is first read inside a reactive context. If you `expose({ length: sensor })` but never bind `length` to the DOM, the listener is never attached. In practice components always bind their properties, so this rarely caused a bug — but it meant the listener timing was determined by the reactive graph, not by the component's `connectedCallback`, and that's not the mental model developers bring to event listeners.

Both details are correct behavior for the use cases `createSensor` was designed for. They're the wrong defaults for a simple per-element event listener inside a component factory.

## The alternative

Everything `createEventsSensor` did can be done with `createState` and `on`, at the cost of a few extra lines:

```ts#form-combobox.ts
const length = createState(textbox.value.length)

expose({
  value: textbox.value,
  length: length.get,  // expose the getter, not the state — consumers cannot set it
})

return [
  on(textbox, 'input', () => {
    length.set(textbox.value.length)
  }),
  clearBtn && watch(length, bindVisible(clearBtn)),
]
```

The write protection comes from exposing `length.get` — a plain function — rather than the full `State<number>`. Consumers see a reactive getter with no corresponding setter. The `on` handler updates `length` directly, synchronously, with no delegation or laziness involved.

This pattern is more verbose but more obvious. The event listener attaches at connect time, like every other `on` call. The initial value is set explicitly. The reactive dependency is declared in the return array where all other effects live.

## Why we removed it

**The non-obvious behaviors caused real bugs.** The most common one: a developer would use `createEventsSensor` on a container element, not realise events from child elements were also handled, and end up with duplicate updates or incorrect `prev` values. The fix in every case was to switch to `on` with an explicit check. We never saw a case where the delegation behavior was intentional.

**The alternative is not that much more code.** Three lines become seven. That's a real increase, but it's lines that tell the full story: here's the state, here's its initial value, here's when it updates, here's what watches it. Nothing is hidden in an initializer signature.

**It conflated two concerns.** The property's write-protection and its event-driven update logic are separate things. `createEventsSensor` bundled them into one call, which made both harder to understand and impossible to change independently. The `createState` pattern separates them: write-protection is about what you expose, event handling is about what you return.

**The escape hatch exists.** If you need a sensor that is truly owned by its setup callback — because you want lazy listener setup, or you have an async value source, or you're building something more sophisticated — `createSensor` is still there, exported directly from Le Truc (re-exported from Cause & Effect). You can implement `createEventsSensor` yourself in userland in about fifteen lines:

```ts#events-sensor.ts
import { createSensor, type Sensor } from '@zeix/le-truc'

type SensorEventHandlers<T> = {
  [K in keyof HTMLElementEventMap]?: (
    event: HTMLElementEventMap[K],
    prev: T,
  ) => T | void
}

export function createEventsSensor<T extends {}>(
  target: Element,
  init: T,
  handlers: SensorEventHandlers<T>,
): Sensor<T> {
  let value = init
  return createSensor<T>(set => {
    const controller = new AbortController()
    for (const [type, handler] of Object.entries(handlers)) {
      target.addEventListener(
        type,
        (e: Event) => {
          const next = (handler as (e: Event, prev: T) => T | void)(e, value)
          if (next != null && !Object.is(next, value)) {
            value = next
            set(next)
          }
        },
        { signal: controller.signal },
      )
    }
    return () => controller.abort()
  }, { value })
}
```

The key difference from the version we removed: no event delegation, no `contains` check. What you pass as `target` is what gets the listener.

## The migration

Search your codebase for `createEventsSensor`. For each call:

1. Replace the initializer in `expose()` with `stateName.get`, where `stateName` is a new `createState(init)` in the factory closure.
2. Add an `on(target, 'eventType', () => { stateName.set(newValue) })` to the return array.
3. Any `watch('propName', ...)` that watched the exposed property by string can be changed to `watch(stateName, ...)` to watch the signal directly — that skips the host slot lookup and is marginally more efficient.

For most components, the migration takes under five minutes.
{% /section %}
