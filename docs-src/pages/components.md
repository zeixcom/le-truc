---
title: 'Components'
emoji: '🏗️'
description: 'Anatomy, lifecycle, signals, effects'
---

{% hero %}
# 🏗️ Components

**Create lightweight, self-contained Web Components with built-in reactivity**. Le Truc lets you define custom elements that manage state efficiently, update the DOM automatically, and enhance server-rendered pages without an SPA framework.
{% /hero %}

{% section %}
## Defining a Component

Le Truc builds on **Web Components**, extending `HTMLElement` to provide **built-in state management and reactive updates**.

{% callout .tip title="Le Truc enhances HTML — it doesn't replace it" %}
A Le Truc component **wraps existing server-rendered content**. The HTML inside the custom element is the starting point — visible before JavaScript runs. See [Progressive Enhancement](getting-started.html#progressive-enhancement) for how this works.
{% /callout %}

Le Truc creates components using the `defineComponent()` function:

```js
defineComponent('my-component', ({ expose, first, all, watch, on }) => {
  // Query descendant elements
  const el = first('selector')
  // Declare reactive properties
  expose({ /* ... */ })
  // Return a flat array of effect descriptors
  return [
    watch(/* source */, /* handler */),
    on(el, /* type */, /* handler */),
  ]
})
```

Every Le Truc component must be registered with a valid custom element tag name (two or more words joined with `-`) as the first parameter.

### Using the Custom Element in HTML

Once registered, the component can be used like any native HTML element:

```html
<my-component>Content goes here</my-component>
```

### Anatomy of a Component

Let's examine a complete component example to understand how Le Truc works. The HTML it enhances looks like this:

```html
<basic-hello>
  <label>
    Your name<br />
    <input name="name" type="text" autocomplete="given-name" />
  </label>
  <p>Hello, <output>World</output>!</p>
</basic-hello>
```

```js
defineComponent('basic-hello', ({ expose, first, on, watch }) => {
  const input = first('input', 'Needed to enter the name.')
  const output = first('output', 'Needed to display the name.')
  const fallback = output.textContent || ''

  expose({ name: asString(output.textContent ?? '') })

  return [
    on(input, 'input', () => ({ name: input.value || fallback })),
    watch('name', bindText(output)),
  ]
})
```

#### Reactive Properties

```js
expose({ name: asString(output.textContent ?? '') })
```

This declares `name` as a reactive property:

- `expose()` is called inside the factory to register reactive signal-backed accessors on `host`; it must be called before any effect references a property by name
- `asString(fallback)` parses the `name` HTML attribute at connect time; if the attribute is absent, the fallback string is used
- The fallback `output.textContent ?? ''` is a static value captured from the factory closure — Le Truc reads `"World"` from the `<output>` element, preserving the server-rendered content
- When `name` changes, any effects that depend on it automatically update

#### Querying Elements

Element queries happen inline at the top of the factory body:

```js
const input = first('input', 'Needed to enter the name.')
const output = first('output', 'Needed to display the name.')
```

`first()` finds the first descendant matching a selector. Also available is `all()`, which returns a `Memo<E[]>` — a lazily observed collection that dynamically updates when matching elements are added or removed from the DOM. Both helpers take a selector string and an optional error message:

```js
// Optional element — the result is null if not found; use && to skip effects conditionally
const input = first('input')

// Required element — throws MissingElementError with your message if not found
const input = first('input', 'Needed to enter the name.')
```

If a queried element is a custom element that has not been defined yet, Le Truc waits up to 200 ms for it to be defined before running effects. This ensures child components are always ready before parent effects activate.

#### Returning Effects

The factory returns a flat array of **effect descriptors** — deferred thunks that activate after all child custom element dependencies are resolved:

```js
return [
  on(input, 'input', () => ({ name: input.value || fallback })),
  watch('name', bindText(output)),
]
```

Effects define **component behaviors**:

- `on(input, 'input', ...)` adds an event listener to the `<input>` element; the handler may return `{ prop: value }` to batch-update host properties
- `watch('name', bindText(output))` keeps `output`'s text in sync with the `name` property

Characteristics of effects:

- Effects run when the component connects to the DOM (after dependency resolution)
- Reactive effects re-run when their declared source changes
- Effects may return a cleanup function executed when the component disconnects

{% /section %}

{% section %}
## Component Lifecycle

Le Truc manages the **Web Component lifecycle** from creation to removal. Here's what happens.

### Connected to the DOM

The factory function runs inside `connectedCallback()`. Element queries, `expose()`, and the returned effect descriptors all execute at this point — the factory is the component's setup phase, not its constructor. If the component disconnects and reconnects, the factory runs again with a fresh closure. See [Managing State with Signals](#managing-state-with-signals) for the ways to initialize reactive properties.

### Disconnected from the DOM

In the `disconnectedCallback()` Le Truc runs all cleanup functions returned by effects during the setup phase in `connectedCallback()`. This will remove all event listeners and unsubscribe all signals the component is subscribed to, so you don't need to worry about memory leaks.

If you subscribe to **external APIs** that live outside the component's reactive scope, return a cleanup function from the effect descriptor:

```js
defineComponent('my-component', ({ host }) => {
  return [
    () => {
      // Setup logic
      const observer = new IntersectionObserver(([entry]) => {
        // Do something
      })
      observer.observe(host)

      // Cleanup logic
      return () => observer.disconnect()
    },
  ]
})
```

{% /section %}

{% section %}
## Managing State with Signals

Le Truc manages state using **signals**, which are atomic reactive states that trigger updates when they change. We use regular properties for public component states:

```js
console.log('count' in el) // Check if the signal exists
console.log(el.count) // Read the signal value
el.count = 42 // Update the signal value
```

### Characteristics and Special Values

Signals in Le Truc are of a **static type** and **non-nullable**. This allows to **simplify the logic** as you will never have to check the type or perform null-checks.

- If you use **TypeScript** (recommended), **you will be warned** that `null` or `undefined` cannot be assigned to a signal or if you try to assign a value of a wrong type.
- If you use vanilla **JavaScript** without a build step, setting a signal to `null` or `undefined` **will throw a `NullishSignalValueError`**. However, strict type checking is not enforced at runtime.

When a `watch()` reactive source produces `null` or `undefined`, the `nil` branch of `WatchHandlers` fires if present:

- **`bindAttribute(el, name)`** nil branch: calls `el.removeAttribute(name)` — removes the attribute entirely
- **`bindStyle(el, prop)`** nil branch: calls `el.style.removeProperty(prop)` — restores the CSS cascade value
- Plain function handlers (`bindText`, `bindProperty`, `bindClass`, `bindVisible`) have no nil branch — a nil source leaves the DOM unchanged

### Initializing State from Attributes

The standard way to set initial state in Le Truc is via **server-rendered attributes** on the component that needs it. No props drilling as in other frameworks. Le Trucs provides some bundled attribute parsers to convert attribute values to the desired type. And you can also define your own custom parsers.

```js
defineComponent('my-component', ({ expose }) => {
  expose({
    count: asInteger(), // Bundled parser: Convert '42' -> 42
    date: asParser(v => new Date(v ?? '')), // Custom parser: '2025-12-12' -> Date object
  })
})
```

{% callout .tip %}
**Parsers run once at connect time.** The attribute value drives the initial signal. Attribute changes after connection do not re-run the parser — use event handlers or direct property writes to update state post-connect.
{% /callout %}

### Bundled Attribute Parsers

Le Truc provides several built-in parsers for common attribute types. See the [Parsers section](api.html#parsers) in the API reference for detailed descriptions and usage examples.

{% /section %}

{% section %}
## Selecting Elements

Use the provided selector utilities to find descendant elements within your component:

### first()

Selects the first matching element:

```js
defineComponent('basic-counter', ({ expose, first, host, on, watch }) => {
  const increment = first(
    'button',
    'Add a native button element to increment the count.',
  )
  const count = first('span', 'Add a span to display the count.')
  // ...
})
```

### all()

Selects all matching elements as a `Memo<E[]>`:

```js
defineComponent('module-tabgroup', ({ all, expose, on, watch }) => {
  const tabs = all(
    'button[role="tab"]',
    'At least 2 tabs as children of a <[role="tablist"]> element are needed. Each tab must reference a unique id of a <[role="tabpanel"]> element.',
  )
  const panels = all(
    '[role="tabpanel"]',
    'At least 2 tabpanels are needed. Each tabpanel must have a unique id.',
  )
  // ...
})
```

Without a hint string (second argument), `first()` returns `undefined` if no match is found and effects for that key are silently skipped. With a hint string, `first()` throws a `MissingElementError` if the element is missing — use this when the element is truly required for the component to function.

The `all()` function returns a `Memo<E[]>` — a memoized, reactive signal of all elements matching the selector. Call `.get()` to unwrap the current array. Because it's reactive, effects that read from it automatically re-run whenever matching elements are added, removed, or rearranged in the DOM.

{% callout .tip %}
**Tip**: `all()` observes structural changes and re-runs effects accordingly. Prefer `first()` when targeting a single element known to be present at connection time.
{% /callout %}

{% /section %}

{% section %}
## Adding Event Listeners

Event listeners respond to user interactions. They are the main cause for changes in component state.

### on() — Event Handling

`on(target, type, handler)` is called from the factory context with an explicit target element or `Memo<E[]>` collection, and returned in the effect array:

```js
defineComponent('my-component', ({ all, expose, first, host, on }) => {
  const buttons = all('button')
  const input = first('input')

  expose({ active: 0, value: '' })

  return [
    on(buttons, 'click', (_e, target) => {
      // Set 'active' signal to value of data-index attribute of button
      const index = parseInt(target.dataset.index ?? '0', 10)
      host.active = Number.isInteger(index) ? index : 0
    }),
    // Set 'value' signal to value of input element
    on(input, 'change', () => ({ value: input.value })),
  ]
})
```

The handler receives `(event, element)` — for `Memo` targets, `element` is the matched item from the collection. The handler can also **return an object** to batch-update multiple host properties at once:

```js
on(button, 'click', () => ({
  count: host.count + 1,
  lastClicked: Date.now(),
}))
```

`on()` returns an `EffectDescriptor` that is activated inside a reactive scope, so event listeners are automatically removed when the component disconnects.

### Read-Only Event-Driven Properties

To expose a property that consumers can read but never directly set, create a `State` in the factory closure and expose only its getter. The `on()` handler updates the value:

```js#my-input.ts
defineComponent('my-input', ({ expose, first, on }) => {
  const textbox = first('input', 'A textbox is required.')
  const length = createState(textbox.value.length)

  expose({
    value: textbox.value,
    length: length.get,  // read-only — consumers can read, not set
  })

  return [
    on(textbox, 'input', () => {
      length.set(textbox.value.length)
    }),
  ]
})
```

Exposing `state.get` rather than the full `State` is what makes the property read-only. When watching this property inside the same factory, pass the signal directly instead of a string prop name — it skips the host slot lookup:

```js
watch(length, bindVisible(clearBtn))
```

{% /section %}

{% section %}
## Synchronizing State with Effects

Effects **automatically update the DOM** when signals change, avoiding manual DOM manipulation.

### Applying Effects

The factory returns a flat array of `EffectDescriptor`s. Each one is created by `watch()`, `on()`, `each()`, `pass()`, `provideContexts()`, or a plain thunk. The `watch(source, handler)` helper drives a DOM update from a declared reactive source:

```js
return [
  watch('open', bindAttribute(host, 'open')), // set attribute from 'open' signal
  watch('count', bindText(count)),            // update text from 'count' signal
  watch('isEven', bindClass(count, 'even')),  // toggle class from 'isEven' signal
]
```

The order of descriptors does not matter.

{% callout .tip %}
**CSS must define what the class or attribute does**

`bindClass(el, 'even', ...)` adds or removes the `even` class — but nothing changes visually unless your CSS has a rule for `&.even { ... }`. The same applies to `bindAttribute()`: a `[aria-selected="true"]` selector in CSS only activates when the attribute is present on the element.

See [Reactive Styles](styling.html#reactive-styles) for examples of how CSS and effects work together.
{% /callout %}

### Per-element Effects with each()

When you have a `Memo<E[]>` collection and need different effects for each element — not just one delegated listener — use `each(memo, callback)`. It creates a per-element reactive scope: effects activate when elements enter the collection and are disposed when they leave.

```js
defineComponent('module-carousel', ({ all, expose, host, watch }) => {
  const dots = all('button[role="tab"]')

  expose({ index: 0 })

  return [
    each(dots, dot =>
      watch(
        () => dot.dataset.index === String(host.index),
        selected => {
          dot.ariaSelected = String(selected)
          dot.tabIndex = selected ? 0 : -1
        },
      ),
    ),
  ]
})
```

The callback receives a single element and returns either a single `EffectDescriptor` or a `FactoryResult` array. `each()` itself returns an `EffectDescriptor` to include in the factory return array.

{% callout .tip title="each() vs on() with a Memo target" %}
Use `on(memo, type, handler)` when a single delegated listener on the host is enough — one click handler for all tabs, for example. Use `each(memo, callback)` when you need per-element reactive effects that depend on both the element and a signal — like updating `ariaSelected` on every dot when the selected index changes.
{% /callout %}

### DOM Binding Helpers

Le Truc provides `bind*` helpers for common DOM update patterns. Each returns a handler (or `WatchHandlers` object) to pass to `watch()`. See the [Helpers section](api.html#helpers) in the API reference for descriptions and usage examples.

### Using Local Signals for Private State

Local signals are useful for state that should not be exposed outside the component. Create them in the factory closure:

```js
defineComponent('my-component', ({ first, on, watch }) => {
  const increment = first('button.increment')
  const count = first('.count')
  const double = first('.double')

  const countState = createState(0)
  const doubleState = createMemo(() => countState.get() * 2)

  return [
    on(increment, 'click', () => { countState.update(v => ++v) }),
    watch(countState, bindText(count)),
    watch(doubleState, bindText(double)),
  ]
})
```

Outside components cannot access the `countState` or `doubleState` signals.

### Using Functions for Ad-hoc Derived State

Instead of a named signal, you can **pass a thunk** as the `watch` source to derive a value inline:

```js
defineComponent('my-component', ({ expose, first, host, watch }) => {
  const count = first('.count')
  const double = first('.double')

  expose({ count: 0 })

  return [
    watch(() => !(host.count % 2), bindClass(count, 'even')),
    watch(() => String(host.count * 2), bindText(double)),
  ]
})
```

{% callout .tip %}
**When to use**

- **Use a property name or a local signal** when the state is part of the component's public interface or internally reused.
- **Use a thunk** to **derive a value on the fly** when it is needed only in this one place.
{% /callout %}

### Bidirectional Binding with Native Elements

Some native elements — checkboxes, text inputs, selects — hold state in **JS properties** that are not reflected by HTML attributes at runtime. `input.checked` and `input.value` are the canonical examples: the attribute only sets the initial state, but the property tracks the live state. To keep a signal in sync with a native element, you need to both read from it and write back to it.

The `form-checkbox` component shows this pattern in full:

```js
defineComponent('form-checkbox', ({ expose, first, host, on, watch }) => {
  const checkbox = first('input[type="checkbox"]', 'Add a native checkbox.')

  expose({
    // Read initial checked state from the DOM property, not the attribute
    checked: checkbox.checked,
  })

  return [
    // Capture user interaction → update signal
    on(checkbox, 'change', () => ({ checked: checkbox.checked })),
    // Sync signal → drive native element property
    watch('checked', bindProperty(checkbox, 'checked')),
  ]
})
```

Three pieces work together:

1. **`checkbox.checked`** — initializes `checked` from the DOM property at setup time, picking up any server-rendered or pre-set state.
2. **`on(checkbox, 'change', ...)`** — returns `{ checked: checkbox.checked }` to update the signal when the user interacts with the checkbox.
3. **`watch('checked', ...)`** — drives `checkbox.checked = value` whenever the signal changes, including when a parent component sets `host.checked` programmatically.

This creates a full cycle: DOM → signal → DOM, with the signal as the single source of truth.

{% callout .tip %}
**`bindProperty()` vs `bindAttribute()`**

`bindAttribute(el, 'checked')` sets the HTML attribute, which only controls the checkbox's *default* state and has no effect on the live `.checked` property once the page has loaded. `bindProperty(el, 'checked')` assigns to the element's JS property directly — the only reliable way to update native form element state at runtime.

Use `bindProperty()` for properties that diverge from their attribute equivalent: `checked`, `value`, `disabled`, `readOnly`, `selectedIndex`, `ariaLabel`, `ariaExpanded`, `ariaDisabled`.
{% /callout %}

{% /section %}
