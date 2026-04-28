---
title: "Forms and State"
description: "Build a form control that starts from server-rendered HTML and stays reactive without re-rendering."
---

This guide shows the most common Le Truc workflow: enhance existing form markup, expose typed host properties, react to native events, and update only the DOM nodes that actually changed.

## Problem

You have server-rendered HTML for a quantity picker. The initial value is already correct, but you need increment/decrement buttons, an accessible live display, and a disabled state that stays synchronized with the current count.

## Solution

Use `defineComponent()` with `expose()`, `on()`, and `watch()` so the element becomes a typed boundary around the existing markup.

<Steps>
<Step>
### Start with backend-rendered HTML

```html
<quantity-picker value="2" max="5">
  <button type="button" data-action="decrement">-</button>
  <output>2</output>
  <button type="button" data-action="increment">+</button>
</quantity-picker>
```

</Step>
<Step>
### Define the component

```ts
import {
  asClampedInteger,
  bindAttribute,
  bindText,
  defineComponent,
} from '@zeix/le-truc'

type QuantityPickerProps = {
  value: number
  max: number
}

declare global {
  interface HTMLElementTagNameMap {
    'quantity-picker': HTMLElement & QuantityPickerProps
  }
}

defineComponent<QuantityPickerProps>('quantity-picker', ({ expose, first, host, on, watch }) => {
  const decrement = first('button[data-action="decrement"]', 'Needed for decrement.')
  const increment = first('button[data-action="increment"]', 'Needed for increment.')
  const output = first('output', 'Needed to show the current value.')

  expose({
    value: asClampedInteger(0, Number.MAX_SAFE_INTEGER),
    max: asClampedInteger(1, Number.MAX_SAFE_INTEGER),
  })

  return [
    on(decrement, 'click', () => ({ value: Math.max(0, host.value - 1) })),
    on(increment, 'click', () => ({ value: Math.min(host.max, host.value + 1) })),

    watch('value', bindText(output)),
    watch(() => host.value <= 0, bindAttribute(decrement, 'disabled')),
    watch(() => host.value >= host.max, bindAttribute(increment, 'disabled')),
    watch(() => `Quantity: ${host.value}`, bindAttribute(output, 'aria-label')),
  ]
})
```

</Step>
<Step>
### Expected behavior

```txt
Initial value: 2
After one increment: 3
At value 5: increment button becomes disabled
At value 0: decrement button becomes disabled
```

</Step>
</Steps>

## Why This Pattern Works

The component does not own a template. It assumes the server already produced the correct buttons and output node. `expose()` turns the `value` and `max` attributes into typed, signal-backed host properties, while `watch()` converts state into tiny DOM writes. Under the hood, `watch()` resolves function sources through `createComputed()` in [`src/effects.ts`](../../../../le-truc/src/effects.ts), which is why expressions like `() => host.value >= host.max` stay reactive without manual subscription code.

This guide also shows when binders are more useful than hand-written watchers. `bindText(output)` keeps text updates terse, while `bindAttribute(..., 'disabled')` automatically maps booleans to `toggleAttribute()` semantics. That behavior comes from [`src/helpers.ts`](../../../../le-truc/src/helpers.ts).

## Variations

If the form control needs async validation, keep the same event pattern but feed a task instead of returning async values from `on()`. For example, `on(input, 'change', () => ({ query: input.value }))` can trigger a `createTask()` re-export that `watch()` then matches with `ok`, `nil`, `stale`, and `err` branches.

If you need multiple items in a repeated list, combine this pattern with [`each()`](/docs/api-reference/effects-api) so each repeated row gets its own listeners and cleanup scope.
