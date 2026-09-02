---
title: 'Components'
emoji: '🏗️'
description: 'Anatomy, lifecycle, element queries'
---

{% hero %}
# Components

**Create lightweight, self-contained Web Components with built-in reactivity.** Le Truc lets you define custom elements that manage state efficiently and update the DOM automatically. Components enhance server-rendered pages without an SPA framework.
{% /hero %}

{% section %}
## Define a Component

A component definition answers three questions: what is the element called, what happens when it connects, and — optionally — which extra capabilities does it opt into. `defineComponent()` takes exactly those three arguments:

- A valid custom element tag name (two or more words joined with `-`)
- A factory function
- An optional array of [extensions](extensions.html)

```js
defineComponent('my-component', ({ expose, first, all, watch, on }) => {
  // Query descendant elements
  const el = first('selector')
  // Declare reactive properties
  expose({ /* ... */ })
  // Call watch(), on(), each(), reconcile(), pass(), or provideContexts()
  watch(/* source */, /* handler */)
  on(el, /* type */, /* handler */)
})
```

The factory receives a `FactoryContext`. Its helpers query descendant elements, declare reactive properties, and register effects. The chapters that follow cover each helper: [Props & State](props.html) for `expose()`, [Events & Effects](effects.html) for `watch()` and `on()`. The optional third argument augments the component with opt-in capabilities like [form participation](extensions.html#form-association) or [attribute-driven reactivity](extensions.html#attribute-driven-reactivity). Each bundled extension is tree-shaken away unless imported and used.

{% callout .note title="Le Truc enhances HTML — it does not replace it" %}
A Le Truc component **wraps existing server-rendered content**. The HTML inside the custom element is the starting point. It is visible before JavaScript runs. See [Progressive Enhancement](getting-started.html#progressive-enhancement) for how this works.
{% /callout %}

{% callout .caution title="Declare props with type, not interface" %}
`defineComponent<P>` constrains `P` to `ComponentProps`, an indexed record. TypeScript infers an index signature for object type **literals** (`type FooProps = { … }`). It never infers one for **interfaces**, because interfaces can be declaration-merged. Always declare component props with `type`. An `interface` does not compile against the constraint.
{% /callout %}

Once registered, use the component like any native HTML element:

```html
<my-component>Content goes here</my-component>
```

{% /section %}

{% section %}
## The Component Lifecycle

The factory function runs inside `connectedCallback()`. Not in the constructor, not at import time — when the element actually connects to the DOM. That timing matters. Element queries, `expose()`, and the registered effects all execute at this point, against markup that already exists and is already visible.

Because the factory runs on connect, it can read the DOM. Because it runs per connection, a component that disconnects and reconnects runs its factory again, with a fresh closure. The factory is the component's setup phase, not its constructor.

### Disconnected from the DOM

In `disconnectedCallback()`, Le Truc runs all cleanup functions returned by effects during the setup phase in `connectedCallback()`. This removes event listeners and unsubscribes signals the component is subscribed to. You do not need to worry about memory leaks.

If you subscribe to **external APIs** that live outside the component's reactive scope — a native `IntersectionObserver`, `ResizeObserver`, or similar — wrap the setup and its cleanup in a hand-authored `EffectDescriptor`. Register it with `watch(() => true, …)`:

```js
defineComponent('my-component', ({ host, watch }) => {
  watch(() => true, () => {
    // Setup logic
    const observer = new IntersectionObserver(([entry]) => {
      // Do something
    })
    observer.observe(host)

    // Cleanup logic
    return () => observer.disconnect()
  })
})
```

`() => true` has no signal dependency. This effect runs its setup exactly once, on connect. `watch()` registers the descriptor's returned cleanup the same way it does for a normal reactive source.

### See it happen

The playground below is live. Disconnect the component and read the log: the cleanup runs, the interval stops, the element goes dark. Connect again and a **new** instance appears with the next number — the factory re-ran from scratch. The log lines come from real events dispatched by a real component, not from a script pretending.

{% demo %}
```html
<docs-lifecycle>
  <div class="stage">
    <docs-pulse>
      <span class="instance"></span>
      <span class="ticks"></span>
    </docs-pulse>
  </div>
  <div class="controls">
    <basic-button>
      <button class="connect constructive" type="button" disabled>Connect</button>
    </basic-button>
    <basic-button>
      <button class="disconnect destructive" type="button">Disconnect</button>
    </basic-button>
  </div>
  <ol class="log"></ol>
</docs-lifecycle>
```
{% /demo %}

{% /section %}

{% section %}
## Query Elements

Components rarely act on the host alone. Most of the DOM they manage is already inside them, rendered by the server. The factory context provides query helpers to find it.

### first()

`first()` returns the first matching element:

```js
defineComponent('basic-counter', ({ first }) => {
  const increment = first(
    'button',
    'Add a native button element to increment the count.',
  )
  const count = first('span', 'Add a span to display the count.')
  // ...
})
```

Without a hint string (second argument), `first()` returns `undefined` if no match is found. Effects for that key are silently skipped. With a hint string, `first()` throws a `MissingElementError` if the element is missing. Use this when the element is truly required for the component to function.

### all()

`all()` returns all matching elements as a live `Cell<E[]>`:

```js
defineComponent('module-tabgroup', ({ all }) => {
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

The `all()` function returns a `Cell<E[]>`, a memoized, reactive signal of all elements matching the selector. Call `.get()` to unwrap the current array. The signal is reactive. Effects that read from it automatically re-run whenever matching elements are added, removed, or rearranged in the DOM. A malformed selector throws `InvalidSelectorError` immediately, at the `all()` call site.

If a queried custom element is not yet defined, Le Truc waits up to 200 ms before running effects. This ensures child components are ready before parent effects activate.

{% callout .tip %}
`all()` observes structural changes and re-runs effects accordingly. Prefer `first()` when targeting a single element known to be present at connect time.
{% /callout %}

### query() and queryAll()

`first()` and `all()` always search from the component host. To search from an element you already have — inside a callback in `reconcile()` or `each()`, or in a free-standing helper function that only receives an element — use `query()` and `queryAll()` instead. They take an explicit root as their first argument:

```js
import { query, queryAll } from '@zeix/le-truc'

const items = queryAll(container, 'li')
const label = query(item, '.label', 'Add a label to each item.')
```

Both share `first()`/`all()`'s selector-to-type inference and `MissingElementError` behavior. Unlike `all()`, `queryAll()` returns a plain array, queried once, not a live `Cell`. Neither waits for an undefined custom element to be defined. That check only applies to `first()`/`all()` at the host level.

{% /section %}
