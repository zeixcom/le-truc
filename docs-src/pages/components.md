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
defineComponent('my-component', {}, {}, () => [
  // Component setup
])
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

The select function must return a record of the selected elements, commonly called `ui` to which initializer functions for reactive properties and the setup function for effects have access to. In the above example, the helper function `first()` is used to find the first descendant matching a selector. Also available is `all()` to find all descendants matching a selector, dynamically updating the list of elements when the DOM changes. Both helper functions take a selector string and an optional error message to display if no element is found.

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
    name: fromContext('display-name', 'World'), // Consume "display-name" signal from closest context provider
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
defineComponent('my-component', {}, {}, ({ host }) => {
  // Setup logic
  host: () => {
    const observer = new IntersectionObserver(([entry]) => {
      // Do something
    })
    observer.observe(host)

    // Cleanup logic
    return () => observer.disconnect()
  },
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

Because of the **non-nullable nature of signals** in Le Truc, we need two special values that can be assigned to any signal type:

- **`RESET`**: Will **reset to the server-rendered version** that was there before Le Truc took control. This is what you want to do most of the times when a signal lacks a specific value.
- **`UNSET`**: Will **delete the signal**, **unsubscribe its watchers** and also **delete related attributes or style properties** in effects. Use this with special care!

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
  })
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

On the other hand, the `all()` function creates a dynamic array of elements that will be updated whenever the matching elements are added or removed from the component's DOM branch. Le Truc will apply the given setup functions to added elements and run the cleanup functions on removed elements.

{% callout class="tip" %}
**Tip**: The `all()` function is more flexible but also more resource-intensive than `first()`. Prefer `first()` when targeting a single element known to be present at connection time.
{% /callout %}

{% /section %}

{% section %}
## Adding Event Listeners

Event listeners allow to respond to user interactions. They are the the main cause for changes in the component's state. Le Truc provides the `on()` function to add event listeners to elements and remove them when the component is disconnected.

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
    })
    input: on('change', () => {
      // Set 'value' signal to value of input element
      host.value = target.value;
    })
  })
)
```

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
    const double = createComputed(() => count.get() * 2)
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
