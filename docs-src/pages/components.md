---
title: 'Components'
emoji: '🏗️'
description: 'Anatomy, lifecycle, signals, effects'
---

<section-hero>

# 🏗️ Components

<div>
  <p class="lead"><strong>Create lightweight, self-contained Web Components with built-in reactivity</strong>. Le Truc lets you define custom elements that manage state efficiently, update the DOM automatically, and enhance server-rendered pages without an SPA framework.</p>
  {{ toc }}
</div>
</section-hero>

<section>

## Defining a Component

Le Truc builds on **Web Components**, extending `HTMLElement` to provide **built-in state management and reactive updates**.

Le Truc creates components using the `component()` function:

```js
component('my-component', {}, () => [
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
component(
  'hello-world',
  {
    name: asString(el => el.querySelector('span')?.textContent?.trim() ?? ''),
  },
  (el, { first }) => {
    const fallback = el.name
    return [
      first(
        'input',
        on('input', ({ target }) => ({ name: target.value || fallback })),
      ),
      first('span', setText('name')),
    ]
  },
)
```

#### Reactive Properties

```js
{
  // Create "name" property from attribute "name" as a string, falling back to server-rendered content
  name: asString(el => el.querySelector('span')?.textContent?.trim() ?? ''),
}
```

This creates a reactive property called `name`:

- `asString()` observes the attribute `name` and assigns its value as a string to the `name` property
- `el => ...` is an instruction how to get the fallback value in the DOM if there is no name attribute
- Le Truc automatically reads "World" from the `<span>` element as the initial value
- When `name` changes, any effects that depend on it automatically update

#### Setup Function

The setup function takes two arguments:

1. The component element. In this example we name it `el`.
2. Helper functions for accessing descendant elements. In this example we use `first` to find the first descendant matching a selector and apply effects to it.

The setup function returns an array of effects:

```js
(el, { first }) => {
  // set the fallback value we want to use instead of an empty string
  const fallback = el.name

  return [
    // Handle user input to change the "name" property
    first(
      'input',
      on('input', ({ target }) => ({ name: target.value || fallback })),
    ),

    // Update content when the "name" property changes
    first('span', setText('name')),
  ]
},
```

Effects define **component behaviors**:

- `first('input', on('input', ...))` finds the first `<input>` and adds an event listener
- `first('span', setText('name'))` finds the first `<span>` and keeps its text in sync with the `name` property

Characteristics of Effects:

- Effects run when the component is added to the page
- Effects rerun when their dependencies change
- Effects may return a cleanup function to be executed when the target element or the component is removed from the page

</section>

<section>

## Component Lifecycle

Le Truc manages the **Web Component lifecycle** from creation to removal. Here's what happens.

### Component Creation

In the `constructor()` reactive properties are initialized. You pass a second argument to the `component()` function to defines initial values for **component states**.

```js
component(
  'my-component',
  {
    count: 0, // Initial value of "count" signal
    value: asInteger(5), // Parse "value" attribute as integer defaulting to 5
    isEven: el => () => !(el.count % 2), // Computed signal based on "count" signal
    name: fromContext('display-name', 'World'), // Consume "display-name" signal from closest context provider
  },
  () => [
    // Component setup
  ],
)
```

In this example you see all three ways to define a reactive property:

- A **static initial value** for a `State` signal (e.g., `count: 0`)
- An **attribute parser** that may provide a fallback value (e.g., `value: asInteger(5)`)
- A **signal producer** function that derives an initial value or a callback function from other properties of the element (e.g., `isEven: el => () => !(el.count % 2)`) or bundled signal producers (e.g. `fromContext(context, fallback)`)

<card-callout class="caution">

**Caution**: Property initialization runs **before the element is attached to the DOM**. You can't access not yet defined properties or descendant elements here.

</card-callout>

### Mounted in the DOM

Runs when the component is added to the page (`connectedCallback()`). This is where you:

- **Access sub-elements**
- **Set up event listeners**
- **Apply effects**
- **Emit custom events**
- **Provide context**

The setup function has two arguments:

1. `el`: The component element instance.
2. `{ all, first }`: An object containing two functions, `all` and `first`, which can be used to select elements within the component. See [Accessing Sub-elements](#accessing-sub-elements).

Le Truc expects you to return an array of partially applied functions to be executed during the setup phase. The order doesn't matter, as each function targets a specific element or event. So feel free to organize your code in a way that makes sense to you.

Each of these functions will return a cleanup function that will be executed during the `disconnectedCallback()` lifecycle method.

```js
component(
  'my-component',
  {
    count: 0,
  },
  (el, { first }) => [
    emit('update-count', el.count), // Emit custom event
    provide('count'), // Provide context
    first(
      '.increment',
      on('click', () => {
        el.count++
      }), // Add click event listener
    ),
    first(
      '.count',
      setText('count'), // Apply effect to update text
    ),
  ],
)
```

### Removed from the DOM

Runs when the component is removed (`disconnectedCallback()`). Le Truc will run all cleanup functions returned by event listeners and effects during the setup phase (`connectedCallback()`). This will unsubscribe all signals the component is subscribed to, so you don't need to worry about memory leaks.

If you added **event listeners** outside the scope of your component or **subscribed manually to external APIs**, you need to return a cleanup function:

```js
component('my-component', {}, el => [
  // Setup logic
  () => {
    const observer = new IntersectionObserver(([entry]) => {
      // Do something
    })
    observer.observe(el)

    // Cleanup logic
    return () => observer.disconnect()
  },
])
```

### Observed Attributes

Le Truc automatically observes and converts attributes with an associated **parser function** in the init block and updates them whenever the attribute changes (`attributeChangedCallback()`).

</section>

<section>

## Managing State with Signals

Le Truc manages state using **signals**, which are atomic reactive states that trigger updates when they change. We use regular properties to access or update them:

```js
console.log('count' in el) // Check if the signal exists
console.log(el.count) // Read the signal value
el.count = 42 // Update the signal value
```

### Characteristics and Special Values

Signals in Le Truc are of a **static type** and **non-nullable**. This allows to **simplify the logic** as you will never have to check the type or perform null-checks.

- If you use **TypeScript** (recommended), **you will be warned** that `null` or `undefined` cannot be assigned to a signal or if you try to assign a value of a wrong type.
- If you use vanilla **JavaScript** without a build step, setting a signal to `null` or `undefined` **will log an error to the console and abort**. However, strict type checking is not enforced at runtime.

Because of the **non-nullable nature of signals** in Le Truc, we need two special values that can be assigned to any signal type:

- **`RESET`**: Will **reset to the server-rendered version** that was there before Le Truc took control. This is what you want to do most of the times when a signal lacks a specific value.
- **`UNSET`**: Will **delete the signal**, **unsubscribe its watchers** and also **delete related attributes or style properties** in effects. Use this with special care!

### Initializing State from Attributes

The standard way to set initial state in Le Truc is via **server-rendered attributes** on the component that needs it. No props drilling as in other frameworks. Le Trucs provides some bundled attribute parsers to convert attribute values to the desired type. And you can also define your own custom parsers.

```js
component(
  'my-component',
  {
    count: asInteger(), // Bundled parser: Convert '42' -> 42
    date: (_, v) => new Date(v), // Custom parser: '2025-02-14' -> Date object
  },
  () => [
    // Component setup
  ],
)
```

<card-callout class="caution">

**Careful**: Attributes **may not be present** on the element or **parsing to the desired type may fail**. To ensure **non-nullability** of signals, Le Truc falls back to neutral defaults:

- `""` (empty string) for `string`
- `0` for `number`
- `{}` (empty object) for objects of any kind

</card-callout>

### Bundled Attribute Parsers

Le Truc provides several built-in parsers for common attribute types. See the [Parsers section](api.html#parsers) in the API reference for detailed descriptions and usage examples.

</section>

<section>

## Selecting Elements

Use the provided selector utilities to find elements within your component:

### first()

Selects the first matching element and applies effects:

```js
component(
  'basic-counter',
  {
    count: asInteger(),
  },
  (el, { first }) => [
    first('.count', setText('count')),
    first(
      'button',
      on('click', () => {
        el.count++
      }),
    ),
  ],
)
```

### all()

Selects all matching elements and applies effects to each:

```js
component(
  'module-tabgroup',
  {
    selected: '',
  },
  (el, { all }) => [
    // Apply click handler to all buttons
    all(
      '[role="tab"]',
      on('click', e => {
        el.selected = e.currentTarget?.getAttribute('aria-controls') ?? ''
      }),
      setProperty(
        'ariaSelected',
        target => target?.getAttribute('aria-controls') === el.selected,
      ),
      setProperty('tabIndex', target =>
        target?.getAttribute('aria-controls') === el.selected ? 0 : -1,
      ),
    ),

    // Apply hidden property to all tabs
    all(
      '[role="tabpanel"]',
      show(target => el.selected === target.id),
    ),
  ],
)
```

The `first()` function expects the matched element to be present at connection time. If not, it will silently ignore the call.

On the other hand, the `all()` function creates a dynamic array of elements that will be updated whenever the matching elements are added or removed from the component's DOM branch. Le Truc will apply the given setup functions to added elements and run the cleanup functions on removed elements.

<card-callout class="tip">

**Tip**: The `all()` function is more flexible but also more resource-intensive than `first()`. Prefer `first()` when targeting a single element known to be present at connection time.

</card-callout>

</section>

<section>

## Adding Event Listeners

Event listeners allow to respond to user interactions. They are the cause of changes in the component's state.

```js
component("my-component", {
	active: 0,
	value: ''
}, (el, { all, first }) => [
	all("button",
		on("click", e => {
			// Set "active" signal to value of data-index attribute of button
			const index = parseInt(e.target.dataset['index'], 10);
			el.active = Number.isInteger(index) ? index : 0;
		})
	),
	first("input",
		on("change", e => {
			// Set "value" signal to value of input element
			el.value = e.target.value;
		})
	)
]
```

</section>

<section>

## Synchronizing State with Effects

Effects **automatically update the DOM** when signals change, avoiding manual DOM manipulation.

### Applying Effects

Apply one or multiple effects in the setup function (for component itself) or in element selector functions:

```js
;(_, { first }) => [
  // On the component itself
  setAttribute('open', 'isOpen'), // Set "open" attribute according to "isOpen" signal

  // On first element matching ".count"
  first(
    '.count',
    setText('count'), // Update text content according to "count" signal
    toggleClass('even', 'isEven'), // Toggle "even" class according to "isEven" signal
  ),
]
```

Again, the order of effects is not important. Feel free to apply them in any order that suits your needs.

### Bundled Effects

Le Truc provides many built-in effects for common DOM operations. See the [Effects section](api.html#effects) in the API reference for detailed descriptions and usage examples.

### Simplifying Effect Notation

For effects that take two arguments, **the second argument can be omitted** if the signal key matches the targeted property name, attribute, class, or style property.

When signal key matches property name:

```js
first('.count', toggleClass('even'))
```

Here, `toggleClass("even")` automatically uses the `"even"` signal.

### Using Local Signals for Protected State

Local signals are useful for storing state that should not be exposed to the outside world. They can be used to manage internal state within a component:

```js
component('my-component', {}, (_, { first }) => {
  const count = state(0)
  const double = count.map(v => v * 2)
  return [
    first(
      '.increment',
      on('click', () => {
        count.update(v => ++v)
      }),
    ),
    first('.count', setText(count)),
    first('.double', setText(double)),
  ]
})
```

Outside components cannot access the `count` or `double` signals.

### Using Functions for Ad-hoc Derived State

Instead of a signal key or a local signal, you can **pass a function** that derives a value dynamically:

```js
component("my-component", {
	count: 0
}, (el, { first }) => {
	const double = computed(() => el.count * 2);
	return [
		first(".count", toggleClass("even", () => !(el.count % 2)))),
		first(".double", setText(() => String(double.get())))
	];
});
```

<card-callout class="tip">

**When to use**

- **Use a signal key or a local signal** when the state is part of the component's public interface or internally reused.
- **Use a function** to **derive a value on the fly** when it is needed only in this one place.

Ad-hoc derived state is more efficient than the overhead of a memoized computed signal for simple functions like converting to a string or boolean, formatting a value or performing a calculation.

</card-callout>

### Efficient & Fine-Grained Updates

Unlike some frameworks that **re-render entire components**, Le Truc updates only what changes:

- **No virtual DOM** – Le Truc modifies the DOM directly.
- **Signals propagate automatically** – no need to track dependencies manually.
- **Optimized with a scheduler** – multiple updates are batched efficiently.

</section>

<section>

## Next Steps

Now that you understand the basics, explore:

- [Styling](styling.html) – Learn techniques to apply styles to components.
- [Data Flow](data-flow.html) – Learn about passing state between components.

</section>
