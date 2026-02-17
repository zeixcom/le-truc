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

Le Truc creates components using the `defineComponent()` function:

```js
defineComponent(
  'my-component',
  {},                    // Reactive properties
  ({ first, all }) => ({
    // Select descendant elements
  }),
  ui => ({
    // Component setup: return effects
  }),
)
```

Every Le Truc component must be registered with a valid custom element tag name (two or more words joined with `-`) as the first parameter.

### Using the Custom Element in HTML

Once registered, the component can be used like any native HTML element:

```html
<my-component>Content goes here</my-component>
```

### Anatomy of a Component

Let's examine a complete component example to understand how Le Truc works:

```js
defineComponent(
  'basic-hello',
  {
    name: asString(ui => ui.output.textContent),
  },
  ({ first }) => ({
    input: first('input', 'Needed to enter the name.'),
    output: first('output', 'Needed to display the name.'),
  }),
  ({ host, input }) => {
    const fallback = host.name
    return {
      input: on('input', () => {
        host.name = input.value || fallback
      }),
      output: setText('name'),
    }
  },
)
```

#### Reactive Properties

```js
{
  name: asString(ui => ui.output.textContent),
}
```

This creates a reactive property called `name`:

- `asString()` observes the attribute `name` and assigns its value as a string to the `name` property
- `ui => ...` is an instruction how to get the fallback value in the DOM if there is no name attribute
- Le Truc automatically reads "World" from the `<output>` element as the initial value
- When `name` changes, any effects that depend on it automatically update

#### Select Function

The select function is used to find descendant elements within the component's DOM:

```js
({ first }) => ({
  input: first('input', 'Needed to enter the name.'),
  output: first('output', 'Needed to display the name.'),
}),
```

The select function must return a record of the selected elements, commonly called `ui`. Both property initializers and the setup function have access to this object, so elements are queried once and shared everywhere.

This is a separate parameter from the setup function for a reason: Le Truc initializes components in three phases — **select elements → initialize properties → run effects**. Some property initializers need to read from the DOM (e.g. `read(ui => ui.input.value, asInteger())`), so the elements must be queried first. And some queried elements may be custom elements that haven't been upgraded yet, so Le Truc waits for their definitions before running effects.

In the above example, the helper function `first()` is used to find the first descendant matching a selector. Also available is `all()` which returns a `Memo<E[]>` — a lazily observed collection that dynamically updates when matching elements are added or removed from the DOM. Both helper functions take a selector string and an optional error message explaining why the element is required for proper functioning of the component:

```js
// Optional element — effects for this key are skipped if not found
input: first('input'),

// Required element — throws MissingElementError with your message if not found
input: first('input', 'Needed to enter the name.'),
```

#### Setup Function

The setup function must return a record with an array of effects for properties of the `ui` object that is passed in. The additional `host` key of the `ui` object holds the component element itself.

```js
({ host, input }) => {
  const fallback = host.name
  return {
    input: on('input', () => {
      host.name = input.value || fallback
    }),
    output: setText('name'),
  }
},
```

Effects define **component behaviors**:

- `input: on('input', ...)` adds an event listener to the `<input>` element
- `output: setText('name')` keeps its text in sync with the `name` property

Characteristics of effects:

- Effects run when the component is added to the page
- Effects rerun when their dependencies change
- Effects may return a cleanup function to be executed when the target element or the component is removed from the page

The bundled effects `on()` and `setText()` in this case are partially applied functions that connect to component properties and the target element and return the appropriate cleanup function.

{% /section %}

{% section %}
## Component Lifecycle

Le Truc manages the **Web Component lifecycle** from creation to removal. Here's what happens.

### Connected to the DOM

In the `connectedCallback()` reactive properties are initialized. You pass a second argument to the `defineComponent()` function to define initial values for **component states**.

```js
defineComponent(
  'my-component',
  {
    count: 0, // Initial value of "count" signal
    value: asInteger(5), // Parse "value" attribute as integer defaulting to 5
    isEven: ui => () => !(ui.host.count % 2), // Computed signal based on "count" signal
    name: requestContext('display-name', 'World'), // Consume "display-name" signal from closest context provider
  },
  () => ({
    // Component UI
  }),
  ui => ({
    // Component setup
  })
)
```

In this example you see all three ways to define a reactive property:

- A **static initial value** creates a `State` signal with the initial value
- An **attribute parser** creates a `State` signal may from the attribute or fallback value, updating the state whenever the attribute changes
- An **initializer** function that creates a `State` or a `Computed` signal depending on the return type of the function. If the function returns a value, it creates a `State` signal. If the function returns a function, it creates a `Computed` signal. Initializer functions have access to the component's `ui` object, allowing them to create signals based on the component's state or descendant elements.

### Disconnected from the DOM

In the `disconnectedCallback()` Le Truc runs all cleanup functions returned by effects during the setup phase in `connectedCallback()`. This will remove all event listeners and unsubscribe all signals the component is subscribed to, so you don't need to worry about memory leaks.

If you added **event listeners** outside the scope of your component or **subscribed manually to external APIs** in a custom effect, you need to return a cleanup function:

```js
defineComponent(
  'my-component',
  {},
  () => ({}),
  ({ host }) => ({
    host: () => {
      // Setup logic
      const observer = new IntersectionObserver(([entry]) => {
        // Do something
      })
      observer.observe(host)

      // Cleanup logic
      return () => observer.disconnect()
    },
  }),
)
```

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

Because of the **non-nullable nature of signals** in Le Truc, there is a special value that can be assigned to any signal type:

- **`RESET`**: Will **reset to the server-rendered version** that was there before Le Truc took control. This is what you want to do most of the times when a signal lacks a specific value.

To unset an attribute or style property in effects, return `null` from the reactive function. This signals to the effect system that the value should be removed.

### Initializing State from Attributes

The standard way to set initial state in Le Truc is via **server-rendered attributes** on the component that needs it. No props drilling as in other frameworks. Le Trucs provides some bundled attribute parsers to convert attribute values to the desired type. And you can also define your own custom parsers.

```js
defineComponent(
  'my-component',
  {
    count: asInteger(), // Bundled parser: Convert '42' -> 42
    date: (_, v) => new Date(v), // Custom parser: '2025-12-12' -> Date object
  },
  () => ({
    // Component UI
  }),
  () => ({
    // Component setup
  }),
)
```

{% callout class="caution" %}
**Careful**: Attributes **may not be present** on the element or **parsing to the desired type may fail**. To ensure **non-nullability** of signals, Le Truc falls back to neutral defaults if no fallback value is provided:

- `""` (empty string) for `string`
- `0` for `number`
- `{}` (empty object) for objects of any kind
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
defineComponent(
  'basic-counter',
  {
    // Initialize properties
  },
  ({ first }) => ({
    increment: first(
      'button',
      'Add a native button element to increment the count.',
    ),
    count: first('span', 'Add a span to display the count.'),
  }),
  ui => ({
    // Component setup
  }),
)
```

### all()

Selects all matching elements:

```js
defineComponent(
  'module-tabgroup',
  {
    // Initialize properties
  },
  ({ all }) => ({
    tabs: all(
      'button[role="tab"]',
      'At least 2 tabs as children of a <[role="tablist"]> element are needed. Each tab must reference a unique id of a <[role="tabpanel"]> element.',
    ),
    panels: all(
      '[role="tabpanel"]',
      'At least 2 tabpanels are needed. Each tabpanel must have a unique id.',
    ),
  }),
  ui => ({
    // Component setup
  }),
)
```

The `first()` function expects the matched element to be present at connection time. If not, it will silently ignore the call.

On the other hand, the `all()` function returns a `Memo<E[]>` — a memoized, reactive signal of all elements matching the selector. Call `.get()` to unwrap the current array of elements. Because it's memoized, unwrapping it multiple times is almost free. And because it's reactive, effects that read from it automatically re-run whenever elements are added, removed, or rearranged in the DOM.

Under the hood, a lazy `MutationObserver` watches for structural changes and invalidates the memo when needed. Le Truc then diffs the new element list against the previous one, applies effects to newly added elements, and runs cleanup functions on removed ones.

{% callout class="tip" %}
**Tip**: `all()` sets up a `MutationObserver` and re-runs effects on every structural change. Prefer `first()` when targeting a single element known to be present at connection time.
{% /callout %}

{% /section %}

{% section %}

## Adding Event Listeners

Event listeners respond to user interactions. They are the main cause for changes in component state. Le Truc provides two approaches for handling events, each suited to different situations.

### on() — Imperative Event Handling

The `on()` effect works like a familiar `addEventListener()` callback. It receives the DOM event and lets you imperatively update host properties:

```js
defineComponent(
  'my-component',
  {
    active: 0,
    value: ''
  },
  ({ all, first }) => ({
    buttons: all('button'),
    input: first('input')
  }),
  ({ host, input }) => ({
    buttons: on('click', ({ target }) => {
      // Set 'active' signal to value of data-index attribute of button
      const index = parseInt(target.dataset.index, 10);
      host.active = Number.isInteger(index) ? index : 0;
    }),
    input: on('change', () => {
      // Set 'value' signal to value of input element
      host.value = input.value;
    }),
  })
)
```

The handler can also **return an object** to update multiple host properties at once. When it does, the updates are automatically batched for efficiency:

```js
on('click', () => ({
  count: host.count + 1,
  lastClicked: Date.now(),
}))
```

Since `on()` is an effect, it's attached to a specific UI element and automatically cleaned up when the component disconnects.

### createEventsSensor() — Declarative Event-to-State Mapping

For more complex event handling, `createEventsSensor()` takes a different approach: instead of imperatively mutating state, it **derives a single reactive value** from one or more event types. This value becomes a read-only property on the component.

```js
defineComponent(
  'module-tabgroup',
  {
    // 'selected' is a read-only property derived entirely from events
    selected: createEventsSensor(
      read(ui => getSelected(ui.tabs.get(), isSelectedTab), ''),
      'tabs',
      {
        click: ({ target }) => getAriaControls(target),
        keyup: ({ event, ui, target, prev }) => {
          // Handle arrow key navigation
          if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
            return getNextTab(ui.tabs.get(), target, event.key)
          }
        },
      },
    ),
  },
  // ...
)
```

The sensor handler receives a rich context object with typed access to:

- **`event`** — the original DOM event
- **`target`** — the matched element (with proper type information, unlike `event.target`)
- **`ui`** — the full component UI object
- **`prev`** — the previous value of the sensor

The sensor is created as a **property initializer** (second parameter of `defineComponent`), not as an effect. This means the resulting property is read-only — no other code can write to it. The sensor is the sole source of truth for that value.

### When to Use Which?

{% callout class="tip" %}
**Choosing the right approach**

Use **`on()`** when you want to:
- React to a single event type on an element
- Imperatively update one or more host properties
- Keep the handler simple and familiar

Use **`createEventsSensor()`** when you want to:
- Derive a single value from multiple event types (click, keyboard, etc.)
- Ensure the property is read-only — only events can change it
- Access the previous value, typed target element, or component UI in the handler

**Rule of thumb**: If you're *doing things* in response to an event, use `on()`. If an event stream *is* the state, use `createEventsSensor()`.
{% /callout %}

{% /section %}

{% section %}

## Synchronizing State with Effects

Effects **automatically update the DOM** when signals change, avoiding manual DOM manipulation.

### Applying Effects

Apply one or multiple effects in the setup function (for component itself) or in element selector functions:

```js
return {
  // On the component itself
  host: setAttribute('open', 'open'), // Set 'open' attribute according to 'open' signal
  // On element for the 'count' property of the UI object
  count: [
    setText('count'), // Update text content according to 'count' signal
    toggleClass('even', 'isEven') // Toggle 'even' class according to 'isEven' signal
  ]
}
```

The order of effects is not important. Feel free to apply them in any order that suits your needs.

### Bundled Effects

Le Truc provides many built-in effects for common DOM operations. See the [Effects section](api.html#effects) in the API reference for detailed descriptions and usage examples.

### Simplifying Effect Notation

For effects that take two arguments, **the second argument can be omitted** if the signal key matches the targeted property name, attribute, class, or style property.

The following are equivalent:

```js
// setAttribute('open', 'open')
setAttribute('open')
```

Here, `setAttribute('open')` automatically uses the `open` signal.

### Using Local Signals for Private State

Local signals are useful for storing state that should not be exposed to the outside world. They can be used to manage internal state within a component:

```js
defineComponent(
  'my-component',
  {},
  ({ first }) => ({
    increment: first('button.increment'),
    count: first('.count'),
    double: first('.double')
  }),
  () => {
    const count = createState(0)
    const double = createMemo(() => count.get() * 2)
    return {
      increment: on('click', () => {
        count.update(v => ++v)
      }),
      count: setText(count),
      double: setText(double),
    }
  }
)
```

Outside components cannot access the `count` or `double` signals.

### Using Functions for Ad-hoc Derived State

Instead of a signal key or a local signal, you can **pass a function** that derives a value dynamically:

```js
defineComponent(
  'my-component',
  {
    count: 0,
  },
  ({ first }) => ({
    count: first('.count'),
    double: first('.double')
  }),
  ({ host }) => ({
    count: toggleClass('even', () => !(host.count % 2)),
    double: setText(() => String(host.count * 2))
  })
)
```

{% callout class="tip" %}
**When to use**

- **Use a signal key or a local signal** when the state is part of the component's public interface or internally reused.
- **Use a function** to **derive a value on the fly** when it is needed only in this one place.

Ad-hoc derived state is more efficient than the overhead of a memoized computed signal for simple functions like converting to a string or boolean, formatting a value or performing a calculation.
{% /callout %}

### Efficient & Fine-Grained Updates

Unlike some frameworks that **re-render entire components**, Le Truc updates only what changes:

- **No virtual DOM** – Le Truc modifies the DOM directly.
- **Signals propagate automatically** – no need to track dependencies manually.
- **Optimized with a scheduler** – multiple updates are batched efficiently.

{% /section %}
