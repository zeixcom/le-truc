---
title: 'Events & Effects'
emoji: '⚡️'
description: 'Event listeners, watchers, bindings'
---

{% hero %}
# ⚡️ Events & Effects

**Wire user input to state with `on()`, and state to the DOM with `watch()`.** Le Truc registers listeners and effects for you and removes them automatically on disconnect. No manual DOM manipulation anywhere.
{% /hero %}

{% section %}
## Listen to Events

Every state change starts somewhere. Usually that somewhere is the user. Event listeners respond to interactions, and they are the main cause of changes in component state.

Call `on(target, type, handler)` from the factory context with an explicit target element or `Cell<E[]>` collection:

```js
defineComponent('my-component', ({ all, expose, first, host, on }) => {
  const buttons = all('button')
  const input = first('input')

  expose({ active: 0, value: '' })

  on(buttons, 'click', (_e, target) => {
    // Set 'active' signal to value of data-index attribute of button
    const index = parseInt(target.dataset.index ?? '0', 10)
    host.active = Number.isInteger(index) ? index : 0
  })
  // Set 'value' signal to value of input element
  on(input, 'change', () => ({ value: input.value }))
})
```

The handler receives `(event, element)`. For `Signal` targets, `element` is the matched item from the collection. The handler can also **return an object** to batch-update multiple host properties at once:

```js
on(button, 'click', () => ({
  count: host.count + 1,
  lastClicked: Date.now(),
}))
```

Event listeners are automatically removed when the component disconnects.

{% /section %}

{% section %}
## Synchronize State with Effects

State changed. Now something in the DOM has to catch up. Effects do that work for you: `watch(source, handler)` re-runs the handler whenever the source changes, and nothing else.

```js
watch('open', bindAttribute(host, 'open')) // set attribute from 'open' signal
watch('count', bindText(count))            // update text from 'count' signal
watch('isEven', bindClass(count, 'even'))  // toggle class from 'isEven' signal
```

The order of `watch()` calls does not matter.

### bind* Helpers

Most DOM updates are common operations: set text, toggle a class, show or hide. Le Truc ships a `bind*` helper for each, and every helper is a handler you can pass straight to `watch()`:

| Helper | DOM update | When the source is nil |
|---|---|---|
| `bindText(el)` | Sets the element's text content | DOM unchanged |
| `bindProperty(el, key)` | Assigns to the element's JS property | DOM unchanged |
| `bindClass(el, token)` | Toggles `token` by truthiness | DOM unchanged |
| `bindVisible(el)` | Sets `el.hidden = !value` — `true` means visible | DOM unchanged |
| `bindAttribute(el, name)` | Sets the attribute (string); adds or removes it (boolean) | Removes the attribute |
| `bindStyle(el, prop)` | Sets the inline style property | Removes the inline style, restoring the cascade |
| `bindState(internals, token)` | Toggles a `:state(token)` custom state on `ElementInternals` | No-op when `internals` is `null` |

Two of these deserve a second look.

`bindAttribute()` validates string values before writing them: event-handler attributes (`on*`) are rejected, and URL attributes must pass a safe-protocol allowlist. Violations throw — they are never silent.

`bindState()` toggles a custom state that CSS matches with `:state(token)`. Unlike a class, a custom state belongs to the component; author code or a framework rewriting the host's `class` attribute cannot overwrite it.

{% callout .note title="CSS must define what the class or attribute does" %}
`bindClass(el, 'even')` adds or removes the `even` class. Nothing changes visually unless your CSS has a rule for `&.even { ... }`. The same applies to `bindAttribute()`: a `[aria-selected="true"]` selector in CSS only activates when the attribute is present on the element.

See [Reactive Styles](styling.html#reactive-styles) for examples of how CSS and effects work together.
{% /callout %}

### Derive Inline with a Thunk

Instead of a named signal, you can **pass a thunk** as the `watch` source to derive a value inline:

```js
defineComponent('my-component', ({ expose, first, host, watch }) => {
  const count = first('.count')
  const double = first('.double')

  expose({ count: 0 })

  watch(() => !(host.count % 2), bindClass(count, 'even'))
  watch(() => String(host.count * 2), bindText(double))
})
```

{% callout .tip title="When to use" %}
- **Use a property name or a local signal** when the state is part of the component's public interface or internally reused.
- **Use a thunk** when the derived value is only needed in this one place.
{% /callout %}

### Per-element Effects with each()

A single `watch()` handles one source. When you have a `Cell<E[]>` collection and each element needs its own reactive effects, `each(memo, callback)` creates a per-element scope. Effects activate when elements enter the collection. They are disposed when elements leave:

```js
defineComponent('module-carousel', ({ all, expose, host, watch }) => {
  const dots = all('button[role="tab"]')

  expose({ index: 0 })

  each(dots, dot => {
    watch(
      () => dot.dataset.index === String(host.index),
      selected => {
        dot.ariaSelected = String(selected)
        dot.tabIndex = selected ? 0 : -1
      },
    )
  })
})
```

The callback receives a single element. Inside the callback you can use the reactive helpers (`watch()`, `on()`, `each()`, `pass()`) to define effects.

{% callout .tip title="each() vs on() with a Cell target" %}
Use `on(cell, type, handler)` when a single delegated listener on the host is enough. For example, use one click handler for all tabs.
Use `each(cell, callback)` when you need per-element reactive effects that depend on both the element and a signal. For example, update `ariaSelected` on every dot when the selected index changes.
{% /callout %}

{% callout .tip title="each() nests to any depth" %}
`each()` callbacks can call another `each()`, for example rows containing columns containing cells in a grid. There is no limit on depth. Ordinary inline arrow handlers work at any nesting level. If `watch()` reports a confusing "no overload matches" error, check the handler body. The usual cause is a handler that returns a value instead of `void`.
{% /callout %}

### Bidirectional Binding with Native Elements

Some native elements (checkboxes, text inputs, selects) hold state in **JS properties** not reflected by HTML attributes at runtime. `input.checked` and `input.value` are the canonical examples. The attribute sets only the initial state. The property tracks the live state. To keep a signal in sync with a native element, you need to both read from it and write back to it.

The `form-checkbox` component shows this pattern in full:

```js
defineComponent('form-checkbox', ({ expose, first, host, on, watch }) => {
  const checkbox = first('input[type="checkbox"]', 'Add a native checkbox.')

  expose({
    // Read initial checked state from the DOM property, not the attribute
    checked: checkbox.checked,
  })

  // Capture user interaction → update signal
  on(checkbox, 'change', () => ({ checked: checkbox.checked }))
  // Sync signal → drive native element property
  watch('checked', bindProperty(checkbox, 'checked'))
})
```

Three pieces work together:

1. **`checkbox.checked`** — initializes `checked` from the DOM property at setup time, picking up any server-rendered or pre-set state.
2. **`on(checkbox, 'change', ...)`** — returns `{ checked: checkbox.checked }` to update the signal when the user interacts with the checkbox.
3. **`watch('checked', ...)`** — drives `checkbox.checked = value` whenever the signal changes, including when a parent component sets `host.checked` programmatically.

This creates a full cycle: DOM → signal → DOM, with the signal as the single source of truth.

{% callout .tip title="`bindProperty()` vs `bindAttribute()`" %}
`bindAttribute(el, 'checked')` sets the HTML attribute. This only controls the checkbox's *default* state. It has no effect on the live `.checked` property once the page has loaded. `bindProperty(el, 'checked')` assigns to the element's JS property directly. This is the only reliable way to update native form element state at runtime.

Use `bindProperty()` for properties that diverge from their attribute equivalent: `checked`, `value`, `disabled`, `readOnly`, `selectedIndex`, `ariaLabel`, `ariaExpanded`, `ariaDisabled`.
{% /callout %}

{% /section %}
