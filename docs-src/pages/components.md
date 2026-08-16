---
title: 'Components'
emoji: '🏗️'
description: 'Anatomy, lifecycle, signals, effects'
---

{% hero %}
# 🏗️ Components

**Create lightweight, self-contained Web Components with built-in reactivity.** Le Truc lets you define custom elements that manage state efficiently and update the DOM automatically. Components enhance server-rendered pages without an SPA framework.
{% /hero %}

{% section %}
## Define a Component

Le Truc builds on **Web Components**. It extends `HTMLElement` to provide **built-in state management and reactive updates**.

{% callout .note title="Le Truc enhances HTML — it does not replace it" %}
A Le Truc component **wraps existing server-rendered content**. The HTML inside the custom element is the starting point. It is visible before JavaScript runs. See [Progressive Enhancement](getting-started.html#progressive-enhancement) for how this works.
{% /callout %}

Create components with the `defineComponent()` function. It takes:
- A valid custom element tag name (two or more words joined with `-`)
- A factory function
- An optional array of [extensions](#extensions)

```js
defineComponent('my-component', ({ expose, first, all, watch, on }) => {
  // Query descendant elements
  const el = first('selector')
  // Declare reactive properties
  expose({ /* ... */ })
  // Call watch(), on(), each(), pass(), or provideContexts()
  watch(/* source */, /* handler */)
  on(el, /* type */, /* handler */)
})
```

The factory receives a `FactoryContext`. Its helpers query descendant elements, declare reactive properties, and register effects. Later sections cover each helper. The optional third argument augments the component with opt-in capabilities like [form participation](#form-association) or [attribute-driven reactivity](#attribute-driven-reactivity). Each bundled extension is tree-shaken away unless imported and used.

{% callout .caution title="Declare props with type, not interface" %}
`defineComponent<P>` constrains `P` to `ComponentProps`, an indexed record. TypeScript infers an index signature for object type **literals** (`type FooProps = { … }`). It never infers one for **interfaces**, because interfaces can be declaration-merged. Always declare component props with `type`. An `interface` does not compile against the constraint.
{% /callout %}

### Use the Custom Element in HTML

Once registered, you can use the component like any native HTML element:

```html
<my-component>Content goes here</my-component>
```

{% /section %}

{% section %}
## Component Lifecycle

Le Truc manages the **Web Component lifecycle** from creation to removal. Here is what happens.

### Connected to the DOM

The factory function runs inside `connectedCallback()`. Element queries, `expose()`, and the registered effects all execute at this point. The factory is the component's setup phase, not its constructor. If the component disconnects and reconnects, the factory runs again with a fresh closure. See [Manage State with Signals](#manage-state-with-signals) to learn how to initialize reactive properties.

### Disconnected from the DOM

In `disconnectedCallback()`, Le Truc runs all cleanup functions returned by effects during the setup phase in `connectedCallback()`. This removes all event listeners and unsubscribes all signals the component is subscribed to. You do not need to worry about memory leaks.

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
{% /section %}

{% section %}
## Manage State with Signals

Le Truc manages state using **signals**. Signals are reactive values that propagate changes automatically. They are exposed as regular JavaScript properties on the component host:

```js
console.log('count' in el) // Check if the signal exists
console.log(el.count) // Read the signal value
el.count = 42 // Update the signal value
```

### Signal Types

Le Truc re-exports the reactive primitives from [`@zeix/cause-effect`](https://github.com/zeixcom/cause-effect). Every signal type participates in the same dependency graph with the same propagation, batching, and cleanup semantics. Use the type that matches the data's role:

| Type | Role | When to use it |
|------|------|----------------|
| [`State`](./api.html#functions/createState) | Mutable source | Local mutable state you read and write inside the component |
| [`Sensor`](./api.html#functions/createSensor) | External input (lazy) | Values that arrive from outside the graph — `matchMedia`, `IntersectionObserver`, geolocation. Seeds an initial value via `{ value }` |
| [`Memo`](./api.html#functions/createMemo) | Sync derivation | A value computed from other signals — e.g. the sum of a spinbutton collection. For cheap one-off derivations, a plain thunk passed to `watch()` is often enough |
| [`Task`](./api.html#functions/createTask) | Async derivation | `fetch`, dynamic imports, or any async work. Auto-cancels in-flight work when its dependencies change and exposes pending / error / ok states via `match()` |
| [`MutableStore`](./api.html#functions/createStore) | Reactive object | An object whose individual properties are each reactive |
| [`MutableList`](./api.html#functions/createList) | Reactive array | A keyed list with stable item identity across add, remove, sort, and reorder |
| [`DerivedList`](./api.html#functions/deriveList) | Derived keyed list | Derived sequences — map another list per item with `deriveList(list, fn)`, or feed one from a fetch or an external stream |
| [`Effect`](./api.html#functions/createEffect) | Side-effect sink | Terminal consumer for work outside the graph. Inside a component, prefer the factory's `watch()` / `on()` over a bare `createEffect()` |

`Slot` is an integration primitive used internally by `pass()` to swap a child's backing signal. You rarely create one directly.

### Prepare for Cause & Effect 2.0

Cause & Effect 1.5 deprecates a set of names ahead of its 2.0 release. Le Truc re-exports each replacement next to the deprecated name, so migration is incremental. The deprecated names keep working for all of 1.x.

Renames to apply now — the new name is final v2 vocabulary:

| Deprecated | Use instead |
|---|---|
| `List` | `MutableList` |
| `isList` | `isMutableList` |
| `Store` | `MutableStore` |
| `isStore` | `isMutableStore` |
| `createComputed` | `deriveSignal` |
| `createMutableSignal` | `createSignal` |
| `createCollection` | `deriveList(seed, { watched })` |
| `list.deriveCollection(fn)` | `deriveList(list, fn)` |
| `CollectionSource` | `ListSource` |
| `CollectionCallback` | `ListCallback` |
| `CollectionChanges` | `ListChanges` |
| `DeriveCollectionCallback` | `PerItemCallback` |

Two of today's names are interim bridges. They rename once more at 2.0, when the readonly base takes the short name:

| Today | At 2.0 | Deprecated alias today |
|---|---|---|
| `DerivedList` | `List` | `Collection` |
| `isDerivedList` | `isList` | `isCollection` |

The origin type names `State`, `Memo`, `Task`, and `Sensor` and their guards (`isState`, `isMemo`, `isTask`, `isSensor`, `isComputed`) are removed at 2.0 with no alias. The factories (`createState`, `createMemo`, `createTask`, `createSensor`) stay. Use `isSignalOfType()` where an origin check is required.

The full guide, including a codemod, lives in [Cause & Effect's `MIGRATION-2.0.md`](https://github.com/zeixcom/cause-effect/blob/main/MIGRATION-2.0.md):

```sh
bun tools/codemod-v2.ts 'src/**/*.ts' --module @zeix/le-truc
```

The `--module` flag scopes the codemod to imports from `@zeix/le-truc`, so it works without a direct `@zeix/cause-effect` dependency. The `createComputed` → `deriveSignal` rename has no codemod rule — apply it by hand and rename `options.value` to `options.initial`.

### Characteristics and Special Values

Signals are **statically typed** and **non-nullable**. Effects need no null-checks.

- With **TypeScript**, assigning `null`, `undefined`, or a wrong type to a signal property is a compile-time error.
- With vanilla **JavaScript**, setting a signal to `null` or `undefined` throws a `NullishSignalValueError` at runtime. Type mismatches are not caught.

When a `watch()` reactive source produces `null` or `undefined`, the `nil` branch of `SingleMatchHandlers` fires if present:

- **`bindAttribute(el, name)`** nil branch: calls `el.removeAttribute(name)` — removes the attribute entirely
- **`bindStyle(el, prop)`** nil branch: calls `el.style.removeProperty(prop)` — restores the CSS cascade value
- Plain function handlers (`bindText`, `bindProperty`, `bindClass`, `bindVisible`) have no nil branch — a nil source leaves the DOM unchanged

### Initialize State from Attributes

The standard way to set initial state is via **server-rendered attributes** on the component element. Pass a `Parser` function to `expose()`. Le Truc calls it with the attribute value at connect time. Bundled parsers cover common types. `asParser()` wraps any custom parser function.

```js
defineComponent('my-component', ({ expose }) => {
  expose({
    count: asInteger(), // Bundled parser: Convert '42' -> 42
    date: asParser(v => new Date(v ?? '')), // Custom parser: '2025-12-12' -> Date object
  })
})
```

{% callout .note title="Parsers run once at connect time" %}
The attribute value drives the initial signal. Attribute changes after connection do not re-run the parser. Use event handlers or direct property writes to update state after connect. To make a Parser-backed prop re-parse on attribute mutations, pass the [`observedAttributes()`](#attribute-driven-reactivity) extension to `defineComponent()`. This matters for frameworks like React, which set attributes rather than properties.
{% /callout %}

### Bundled Attribute Parsers

Le Truc provides several built-in parsers for common attribute types. See the [Parsers section](api.html#parsers) in the API reference for detailed descriptions and usage examples.

{% /section %}

{% section %}
## Query Elements

Use the provided selector utilities to find descendant elements within your component:

### first()

`first()` queries the first matching element:

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

`all()` queries all matching elements as a live `Memo<E[]>`:

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

Without a hint string (second argument), `first()` returns `undefined` if no match is found. Effects for that key are silently skipped. With a hint string, `first()` throws a `MissingElementError` if the element is missing. Use this when the element is truly required for the component to function.

The `all()` function returns a `Memo<E[]>`, a memoized, reactive signal of all elements matching the selector. Call `.get()` to unwrap the current array. The signal is reactive. Effects that read from it automatically re-run whenever matching elements are added, removed, or rearranged in the DOM. A malformed selector throws `InvalidSelectorError` immediately, at the `all()` call site.

If a queried custom element is not yet defined, Le Truc waits up to 200 ms before running effects. This ensures child components are always ready before parent effects activate.

{% callout .tip %}
`all()` observes structural changes and re-runs effects accordingly. Prefer `first()` when targeting a single element known to be present at connection time.
{% /callout %}

### query() and queryAll()

`first()` and `all()` always search from the component host. To search from an element you already have — inside a `reconcile()` `bindItem` or `each()` callback, or in a free-standing helper function that only receives an element — use `query()` and `queryAll()` instead. They take an explicit root as their first argument:

```js
import { query, queryAll } from '@zeix/le-truc'

const items = queryAll(container, 'li')
const label = query(item, '.label', 'Add a label to each item.')
```

Both share `first()`/`all()`'s selector-to-type inference and `MissingElementError` behavior. Unlike `all()`, `queryAll()` returns a plain array, queried once — not a live `Memo`. Neither waits for an undefined custom element to be defined; that check only applies to `first()`/`all()` at the host level. See [Manage Dynamic Lists](data-flow.html#manage-dynamic-lists) for `reconcile()`'s and `each()`'s own scoped `first` parameter, a `query()` pre-bound to the current item.

{% /section %}

{% section %}
## Add Event Listeners

Event listeners respond to user interactions. They are the main cause of changes in component state.

### on() — Event Handling

Call `on(target, type, handler)` from the factory context with an explicit target element or `Memo<E[]>` collection:

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

The handler receives `(event, element)`. For `Memo` targets, `element` is the matched item from the collection. The handler can also **return an object** to batch-update multiple host properties at once:

```js
on(button, 'click', () => ({
  count: host.count + 1,
  lastClicked: Date.now(),
}))
```

`on()` returns an `EffectDescriptor` that activates inside a reactive scope. Event listeners are automatically removed when the component disconnects.

### Read-Only Event-Driven Properties

To expose a property that consumers can read but never set, create a `State` in the factory closure. Expose only its getter. The `on()` handler updates the value:

```js#my-input.ts
defineComponent('my-input', ({ expose, first, on }) => {
  const textbox = first('input', 'A textbox is required.')
  const length = createState(textbox.value.length)

  expose({
    value: textbox.value,
    length: length.get,  // read-only — consumers can read, not set
  })

  on(textbox, 'input', () => {
    length.set(textbox.value.length)
  })
})
```

You make the property read-only by exposing `state.get` rather than the full `State`. To watch this property inside the same factory, pass the signal directly instead of a string prop name. This skips the host slot lookup:

```js
watch(length, bindVisible(clearBtn))
```

### Expose Imperative Methods

Not every property is a value you read or watch. Some are **commands**: functions a consumer calls imperatively from event handlers, like `reset()`, `stepUp()` / `stepDown()`, or `clear()`. Wrap the function in `defineMethod()`. Pass it to `expose()`:

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

Use methods to expose a function to other components. The function operates on the host and hides implementation details. You can expose both reactive values (`value`) and methods (`clear`) side by side.

{% callout .tip title="Always use defineMethod(), never a plain function" %}
Le Truc identifies method producers by a brand symbol that `defineMethod()` attaches. Le Truc treats an unbranded function passed to `expose()` as a thunk instead. This creates a computed reactive property.
{% /callout %}

{% /section %}

{% section %}
## Synchronize State with Effects

Effects **automatically update the DOM** when signals change. You do not need manual DOM manipulation.

### Apply Effects

`watch()`, `on()`, `each()`, `pass()`, and `provideContexts()` each produce an `EffectDescriptor` and register it automatically when called. You do not need `return`. If you write a hand-authored descriptor instead of using one of these five helpers, register it the same way, via `watch(() => true, descriptor)`. See [Disconnected from the DOM](#disconnected-from-the-dom) for details. The `watch(source, handler)` helper drives a DOM update from a declared reactive source:

```js
watch('open', bindAttribute(host, 'open')) // set attribute from 'open' signal
watch('count', bindText(count))            // update text from 'count' signal
watch('isEven', bindClass(count, 'even'))  // toggle class from 'isEven' signal
```

The order of calls does not matter.

{% callout .note title="CSS must define what the class or attribute does" %}
`bindClass(el, 'even')` adds or removes the `even` class. Nothing changes visually unless your CSS has a rule for `&.even { ... }`. The same applies to `bindAttribute()`: a `[aria-selected="true"]` selector in CSS only activates when the attribute is present on the element.

See [Reactive Styles](styling.html#reactive-styles) for examples of how CSS and effects work together.
{% /callout %}

### Per-element Effects with each()

Use `each(memo, callback)` when you have a `Memo<E[]>` collection and need different effects for each element, not just one delegated listener. It creates a per-element reactive scope. Effects activate when elements enter the collection. They are disposed when elements leave.

```js
defineComponent('module-carousel', ({ all, expose, host, watch }) => {
  const dots = all('button[role="tab"]')

  expose({ index: 0 })

  each(dots, dot =>
    watch(
      () => dot.dataset.index === String(host.index),
      selected => {
        dot.ariaSelected = String(selected)
        dot.tabIndex = selected ? 0 : -1
      },
    ),
  )
})
```

The callback receives a single element. It returns either a single `EffectDescriptor` or a `FactoryResult` array. Alternatively, it can call `watch()`, `on()`, or a nested `each()` directly, the same as the factory itself.

{% callout .tip title="each() vs on() with a Memo target" %}
Use `on(memo, type, handler)` when a single delegated listener on the host is enough. For example, use one click handler for all tabs.
Use `each(memo, callback)` when you need per-element reactive effects that depend on both the element and a signal. For example, update `ariaSelected` on every dot when the selected index changes.
{% /callout %}

{% callout .tip title="each() nests to any depth" %}
`each()` callbacks can call another `each()`, for example rows containing columns containing cells in a grid. There is no limit on depth. Ordinary inline arrow handlers work at any nesting level. If `watch()` reports a confusing "no overload matches" error, check the handler body. The usual cause is a handler that returns a value instead of `void` (e.g. a one-line `array.push(...)`).
{% /callout %}

### DOM Binding Helpers

Le Truc provides `bind*` helpers for common DOM update patterns. Each returns a handler (or `SingleMatchHandlers` object) to pass to `watch()`. See the [Helpers section](api.html#helpers) in the API reference for descriptions and usage examples.

### Use Local Signals for Private State

Local signals are useful for state that should not be exposed outside the component. Create them in the factory closure:

```js
defineComponent('my-component', ({ first, on, watch }) => {
  const increment = first('button.increment')
  const count = first('.count')
  const double = first('.double')

  const countState = createState(0)
  const doubleState = createMemo(() => countState.get() * 2)

  on(increment, 'click', () => { countState.update(v => ++v) })
  watch(countState, bindText(count))
  watch(doubleState, bindText(double))
})
```

Outside components cannot access the `countState` or `doubleState` signals.

### Use Functions for Ad-hoc Derived State

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

{% section %}
## Extensions

The third argument to `defineComponent()` is an optional array of **extensions**. Extensions are small, tree-shakable modules that augment a component with opt-in capabilities without bloating the core. `component.ts` never statically imports feature-specific code, so a consumer who never calls an extension never bundles it.

Each extension implements the `ComponentExtension` interface:
- A `name`
- A set of `staticProps` to install on the generated class (e.g. `static formAssociated = true`)
- `observedAttributes` and `reservedMembers` it contributes
- Optional lifecycle hooks (`installOnPrototype`, `onConnect`, `onAttributeChanged`)

`defineComponent()` folds the array once at class-definition time. `staticProps` collisions throw `ExtensionCollisionError` in dev mode (first declaration wins in production). `observedAttributes` and `reservedMembers` are unions across all extensions.

```js
defineComponent('my-element', factory, [formAssociated()])
```

Le Truc ships three extensions, each imported separately:

| Extension | Purpose |
|---|---|
| [`formAssociated()`](#form-association) | Form participation via `ElementInternals` — value sync, reset, state restore, disabled, native-parity host contract |
| [`formAssociatedCheckbox()`](#checkbox-shaped-controls) | Form participation keyed on a `checked: boolean` prop — submits nothing when unchecked |
| [`observedAttributes()`](#attribute-driven-reactivity) | Re-parses Parser-backed props when their attribute mutates after connect |

A fourth extension, [`debug()`](#debug-instrumentation), ships too — but it never appears in this table, because you never add it yourself.

### Form Association

The `formAssociated()` extension adapts a component to the [form-associated custom element](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements-face-example) convention. Pass it as the first element of the extensions array. The factory's context then widens to expose the `internals` object alongside the usual helpers:

```js#form-textbox.js
defineComponent<FormTextboxProps>(
  'form-textbox',
  ({ expose, first, host, internals, on, watch }) => {
    const textbox = first('input, textarea')

    expose({ value: textbox.value })

    // Typed validity flags via the internals escape hatch
    watch(
      () => ({ value: host.value, max: host.maxLength }),
      ({ value, max }) => {
        internals?.setValidity(
          { tooLong: value.length > max },
          value.length > max ? `Max ${max} characters` : '',
        )
      },
    )
  },
  [formAssociated()],
)
```

With `[formAssociated()]`, Le Truc manages for you:
- Form value sync
- Reset
- State restore
- A `<fieldset disabled>`-aware `disabled` property

The host gains a native-parity contract delegating to `internals`: `form`, `name`, `labels`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`, `reportValidity()`, `setCustomValidity()`. External consumers read them as on a native input. The convention requires a reactive `value` property. Expose it and sync it to the underlying native control as usual. `expose()` throws `InvalidPropertyNameError` for any reserved member name managed by the extension.

The `internals` object on the context (`null` only if `attachInternals()` failed) is the escape hatch for typed validity flags and custom `:state()` pseudo-classes. Follow this rule: use `internals?.setFormValue()` indirectly through the managed convention. Set `value`, and it syncs automatically. Call `internals?.setValidity()` directly when you need flags beyond a simple custom-error message.

#### Checkbox-Shaped Controls

A checkbox's primary state is `checked: boolean`. It submits nothing when unchecked, unlike `formAssociated()`'s always-on string `value`. The `formAssociatedCheckbox()` extension handles this shape. It shares the same host contract and `disabled` management as `formAssociated()`. Its value-sync, reset, and state-restore mechanics target a `checked` prop instead of `value`:

```js#form-checkbox.js
defineComponent<FormCheckboxProps>(
  'form-checkbox',
  ({ expose, first, on, watch }) => {
    const checkbox = first('input[type="checkbox"]')

    expose({ checked: asBoolean() })

    on(checkbox, 'change', () => ({ checked: checkbox.checked }))
    watch('checked', bindProperty(checkbox, 'checked'))
  },
  [formAssociatedCheckbox()],
)
```

`internals.setFormValue()` receives the host's own `value` attribute when checked (default `'on'`, matching native `<input type="checkbox">`) and `null` when unchecked. The convention requires a reactive `checked` property.

{% callout .caution title="Do not combine the two form extensions" %}
Both `formAssociated()` and `formAssociatedCheckbox()` declare the same `staticProps.formAssociated` key. Combining them on one component throws `ExtensionCollisionError` in dev mode. Radio groups and listboxes do not need `formAssociatedCheckbox()`. Their selection aggregates into one string `value` on the container, which fits `formAssociated()`.
{% /callout %}

#### Relaying Native Control Validity

A component that wraps a native control (`<input>`, `<select>`, `<textarea>`) — a spinbutton around `<input type="number">`, a masked field around `<input type="text">` — can relay the control's own `ValidityState` onto `host.validity` with `relayValidity(internals, control, anchor?)`, surfacing every constraint the browser already checks (`rangeOverflow`, `stepMismatch`, `badInput`, `valueMissing`, …) instead of collapsing them into a single `customError`. It fully replaces `host.validity`, including the control's own `customError` — the control's live state is the whole truth about itself. Not reactive — call it from an event handler on the wrapped control:

```js#form-enhanced-input.js
import { defineComponent, formAssociated, relayValidity } from '@zeix/le-truc'

export default defineComponent(
	'form-enhanced-input',
	({ first, internals, on }) => {
		const input = first('input', 'Add a native input')
		on(input, 'input', () => relayValidity(internals, input))
	},
	[formAssociated()],
)
```

`relayValidity()` isn't gated behind `formAssociated()` — it works with any component that has `internals` on its factory context. See `form-spinbutton.ts` for a complete example.

### Attribute-Driven Reactivity

Properties are the primary reactive interface. By design, a `Parser` passed to `expose()` reads its attribute once, at connect time. Attribute changes after connect do not re-run it. The `observedAttributes()` extension is the opt-in escape hatch. Use it when you need the parser to fire again on later attribute mutations. This matters chiefly for frameworks like React that set DOM attributes on custom elements rather than properties:

```js#basic-gauge.js
defineComponent<BasicGaugeProps>(
  'basic-gauge',
  ({ expose, first, host, watch }) => {
    expose({ value: asNumber() })

    watch('value', v => { /* update the gauge */ })
  },
  [observedAttributes(['value'])],
)
```

Le Truc adds named attributes to the class's `static observedAttributes`. On each mutation, the extension re-runs the same retained `Parser` against the attribute's new string value. It writes the result to the prop. Props whose initializer is not a branded `Parser` are left untouched. Use this sparingly. For most components, event handlers or direct property writes are the right way to update state after connect.

### Debug Instrumentation

`debug()` is not exported, and you never pass it to `defineComponent()`. Build your app with `DEV_MODE=true` (the default for local development), and every component gets a reactive `debug: boolean` property for free — including components you didn't write. This is the point: instrumenting one specific component instance shouldn't require editing its source.

Toggle `debug` from the browser's properties panel, or hold `Cmd`/`Ctrl` and click the component. While `debug` is `true`:
- The host carries a pulsing box-shadow indicator on every `on()`, `pass()`, or `watch()` firing
- Target elements that `on()`, `pass()`, or a `bind*`-backed `watch()` handler act on get a presence-only marking attribute (`data-le-truc-on`, `-pass`, or `-watch`)
- Each firing logs one `console.debug()` entry naming the component and, where known, the event or target

A `watch()` handler not produced by a `bind*` helper (`bindText`, `bindProperty`, and so on) can't be traced back to an element — Le Truc shows the host-level pulse only, rather than guess.

`debug` does nothing in production. The property doesn't exist without `DEV_MODE`: setting `debug = true` on a production build is a no-op, because the extension that provides it was never added to the component.

{% callout .caution title="debug is a reserved property name in DEV_MODE" %}
`expose({ debug: ... })` throws in a `DEV_MODE` build, on any component, whether or not it uses `debug()` itself — the name is reserved the moment `DEV_MODE` is on. The same component works fine in production, where the reservation doesn't exist. Avoid `debug` as a prop name.
{% /callout %}

{% /section %}
