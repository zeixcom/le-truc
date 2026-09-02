---
title: 'Props & State'
emoji: '📦'
description: 'Expose props, parse attributes, signal types'
---

{% hero %}
# Props & State

**Declare reactive properties with `expose()`.** Parse initial values from server-rendered attributes, hold private state in local signals, expose read-only values and imperative methods. State lives on the host as plain properties.
{% /hero %}

{% section %}
## Declare Reactive State

Your server already rendered values into the HTML. `expose()` turns them into state: it declares the component's reactive properties and initializes each one — from an attribute, from the DOM, or from a signal you create yourself. The properties are backed by **signals**. Signals are reactive values that propagate changes automatically, and they surface as regular JavaScript properties on the component host:

```js
console.log('count' in el) // Check if the signal exists
console.log(el.count) // Read the signal value
el.count = 42 // Update the signal value
```

### Signal Types

Le Truc re-exports the reactive primitives from [`@zeix/cause-effect`](https://github.com/zeixcom/cause-effect). Every signal type participates in the same dependency graph with the same propagation, batching, and cleanup semantics. Pick the type that matches the data's role:

| Type | Role | When to use it |
|------|------|----------------|
| [`MutableCell`](./api.html#functions/createCell) | Mutable source | Local mutable state you read and write inside the component |
| [`Cell`](./api.html#functions/deriveCell) | Sync or async derivation or external input | Values computed from other signals, content retrieved via async work, and values that arrive from outside the graph |
| [`MutableStore`](./api.html#functions/createStore) | Reactive object | An object whose individual properties are each reactive |
| [`MutableList`](./api.html#functions/createList) | Reactive array | A keyed list with stable item identity across add, remove, sort, and reorder |
| [`DerivedList`](./api.html#functions/deriveList) | Derived keyed list | Map another list per item, or feed one from a fetch or an external stream |
| [`Effect`](./api.html#functions/createEffect) | Side-effect sink | Terminal consumer for work outside the graph. Inside a component, prefer the factory's `watch()` / `on()` over a bare `createEffect()` |

`Slot` is an integration primitive used internally by `pass()` to swap a child's backing signal. You rarely create one directly.

### Migrating Deprecated Signal Names

Upcoming Cause & Effect 2.0 will unify its signal types to `Cell` (was: `State`, `Memo`, `Task`, `Sensor`), `List`, `Store`, and their mutable counterparts. Le Truc re-exports each Cause & Effect replacement name next to its deprecated counterpart, so you can migrate incrementally. See [Cause & Effect's MIGRATION-2.0.md](https://github.com/zeixcom/cause-effect/blob/main/MIGRATION-2.0.md) for the full rename list and a codemod:

```sh
bun tools/codemod-v2.ts 'src/**/*.ts' --module @zeix/le-truc
```

### Signals Are Typed and Non-Nullable

Signals are **statically typed** and **non-nullable**. Effects need no null-checks.

- With **TypeScript**, assigning `null`, `undefined`, or a wrong type to a signal property is a compile-time error.
- With vanilla **JavaScript**, setting a signal to `null` or `undefined` throws a `NullishSignalValueError` at runtime. Type mismatches are not caught.

A watched source can still produce `nil` at runtime — an async value that has not resolved, or a derivation that hit an error. Each `bind*` helper defines what happens then; see the [nil behavior table](effects.html#bind-helpers) on the Events & Effects page.

{% /section %}

{% section %}
## Parse from Attributes

The standard way to set initial state is via **server-rendered attributes** on the component element. Pass a `Parser` function to `expose()`. Le Truc calls it with the attribute value at connect time. Bundled parsers cover common types. `asParser()` wraps any custom parser function. See the [API reference](api.html) for detailed descriptions and usage examples of built-in parsers.

```js
defineComponent('my-component', ({ expose }) => {
  expose({
    count: asInteger(), // Bundled parser: Convert '42' -> 42
    date: asParser(v => new Date(v ?? '')), // Custom parser: '2025-12-12' -> Date object
  })
})
```

{% callout .note title="Parsers run once at connect time" %}
The attribute value drives the initial signal. Per default, attribute changes after connection do not re-run the parser. Use property writes to update state after connect. To make a Parser-backed prop re-parse on attribute mutations, pass the [`observedAttributes()`](extensions.html#attribute-driven-reactivity) extension to `defineComponent()`. This matters for frameworks like React, which set attributes rather than properties.
{% /callout %}

{% /section %}

{% section %}
## Local Signals for Private State

Not every value belongs to the public interface. State that only this component reads and writes stays in the factory closure — create it with `createCell()` or `deriveCell()` and never pass it to `expose()`:

```js
defineComponent('my-component', ({ first, on, watch }) => {
  const increment = first('button.increment')
  const count = first('.count')
  const double = first('.double')

  const countCell = createCell(0)
  const doubleCell = deriveCell(() => countCell.get() * 2)

  on(increment, 'click', () => { countCell.update(v => ++v) })
  watch(countCell, bindText(count))
  watch(doubleCell, bindText(double))
})
```

Outside components cannot access the `countCell` or `doubleCell` signals. Expose a value only when a consumer has a reason to read or write it.

{% /section %}

{% section %}
## Read-Only Properties

Some values are public information but private control. A text length, a form validity, a loading flag — consumers read them, but only the component writes them. Expose the getter, not the cell:

```js#my-input.ts
defineComponent('my-input', ({ expose, first, on }) => {
  const textbox = first('input', 'A textbox is required.')
  const length = createCell(textbox.value.length)

  expose({
    value: textbox.value,
    length: length.get,  // read-only — consumers can read, not set
  })

  on(textbox, 'input', () => {
    length.set(textbox.value.length)
  })
})
```

A consumer who writes `el.length = 5` gets a `ReadonlySignalError`. That is the contract working. To watch this property inside the same factory, pass the signal directly:

```js
watch(length, bindVisible(clearBtn))
```

{% /section %}

{% section %}
## Imperative Methods

Reactive properties cover most of a component's surface. Occasionally a consumer needs a verb — `clear()`, `reset()`, `focus()`. Wrap it in `defineMethod()`:

```js#form-textbox.js
defineComponent('form-textbox', ({ expose, first, host, on, watch }) => {
  const textbox = first('input', 'Add a native input or textarea as descendant.')

  expose({
    value: textbox.value,
    clear: defineMethod(() => {
      host.value = ''
      textbox.value = ''
      textbox.setCustomValidity('')
      textbox.checkValidity()
      textbox.dispatchEvent(new Event('input', { bubbles: true }))
      textbox.dispatchEvent(new Event('change', { bubbles: true }))
      textbox.focus()
    }),
  })

  on(textbox, 'change', () => ({ value: textbox.value }))
  watch('value', bindProperty(textbox, 'value'))
})
```

Common use cases include `reset()`, `stepUp()` / `stepDown()`, or `clear()`. The function operates on the host and hides implementation details. You can expose both reactive values (`value`) and methods (`clear`) side by side.

{% callout .caution title="Always use defineMethod(), never a plain function" %}
Le Truc identifies method producers by a brand symbol that `defineMethod()` attaches. Le Truc treats an unbranded function passed to `expose()` as a thunk instead. This creates a computed reactive property.
{% /callout %}

{% /section %}
