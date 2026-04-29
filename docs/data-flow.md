---
title: "Data Flow"
description: "Passing state, events, context"
emoji: "🔄"
---

# 🔄 Data Flow

**Learn how Le Truc components coordinate state.** Pass reactive signals from parent to child with `pass()`, expose callable methods with `defineMethod()`, and share values across the component tree with context.

## Component Coordination

Let's consider a **product catalog** where users can add items to a shopping cart. We have **three independent components** that work together:

- `ModuleCatalog` **(Parent)**:
  - **Tracks all `SpinButton` components** in its subtree and calculates the total count of items in the shopping cart.
  - **Passes that total** to a `BasicButton`.
- `BasicButton` **(Child)**:
  - Displays a **badge** in the top-right corner when the `badge` property is set.
  - **Does not track any state** – it simply renders whatever value is passed to it.
- `FormSpinbutton` **(Child)**:
  - Displays an **Add to Cart** button initially.
  - When an item is added, it transforms into a **stepper** (increment/decrement buttons).

Although `BasicButton` and `FormSpinbutton` are completely independent, they need to work together. So `ModuleCatalog` **coordinates the data flow between them**.

### Parent Component: ModuleCatalog

The **parent component (`ModuleCatalog`) knows about its children**, meaning it can **read state from and pass state to** them. It uses `all()` to observe all `FormSpinbutton` quantities reactively, then `pass()` to drive the `BasicButton`'s `badge` and `disabled` state:

```js#module-catalog.js
defineComponent('module-catalog', ({ all, first, pass }) => {
  const button = first('basic-button', 'Add a button to go to the Shopping Cart')
  const spinbuttons = all(
    'form-spinbutton',
    'Add spinbutton components to calculate sum from.',
  )
  const total = createMemo(() =>
    spinbuttons.get().reduce((sum, item) => sum + item.value, 0),
  )

  return [
    pass(button, {
      disabled: () => !total.get(),
      badge: () => (total.get() > 0 ? String(total.get()) : ''),
    }),
  ]
})
```

Whenever any `<form-spinbutton>` value changes, `total` updates and the badge reflects the new count — no event listeners or manual wiring needed.

> **pass() works with Le Truc components only:** `pass()` replaces the backing signal of the child's reactive property directly — this only works for Le Truc components whose properties are Slot-backed. For non-Le Truc custom elements (Lit, Stencil, FAST, etc.) or plain HTML elements, use `watch(source, bindProperty(el, key))` instead. `bindProperty` assigns to the element's public JS setter and works correctly regardless of the child's internal framework.

### Child Component: BasicButton

The `BasicButton` component **displays a badge when needed** – it does not know about any other component nor track state itself. It exposes reactive properties `disabled`, `label`, and `badge` and has effects to keep the DOM subtree in sync with those properties.

```js#basic-button.js
defineComponent('basic-button', ({ expose, first, watch }) => {
  const button = first('button', 'Add a native button as descendant.')
  const label = first('span.label')
  const badge = first('span.badge')

  expose({
    disabled: button.disabled,
    label: label?.textContent ?? button.textContent ?? '',
    badge: badge?.textContent ?? '',
  })

  return [
    watch('disabled', bindProperty(button, 'disabled')),
    label && watch('label', bindText(label)),
    badge && watch('badge', bindText(badge)),
  ]
})
```

- Whenever the `disabled` property is updated by a parent component, the button is disabled or enabled.
- Whenever the `badge` property is updated by a parent component, the badge text updates.
- If `badge` is an empty string, the badge indicator is hidden (via CSS).

### Child Component: FormSpinbutton

The `FormSpinbutton` component reacts to user interactions and exposes a reactive property `value` of type `number`. It updates its own internal DOM subtree, but doesn't know about any other component nor where the value is used.

```js#form-spinbutton.js
defineComponent('form-spinbutton', ({ all, expose, first, host, on, watch }) => {
  const controls = all('button, input:not([disabled])')
  const increment = first('button.increment', 'Add a native button to increment the value')
  const decrement = first('button.decrement', 'Add a native button to decrement the value')
  const input = first('input.value', 'Add a native input to display the value')
  const zero = first('.zero')
  const other = first('.other')

  const nonZero = createMemo(() => host.value !== 0)
  const incrementLabel = increment.ariaLabel || 'Increment'

  expose({
    value: Number.parseInt(input.value) || 0,
    max: Number.parseInt(input.max) || 10,
  })

  return [
    on(controls, 'change', (_e, target) => {
      if (!(target instanceof HTMLInputElement)) return
      const next = Number(target.value)
      if (!Number.isInteger(next)) {
        target.value = String(host.value)
        target.checkValidity()
        return
      }
      const clamped = Math.min(host.max, Math.max(0, next))
      if (next !== clamped) {
        target.value = String(clamped)
        target.checkValidity()
      }
      host.value = clamped
    }),
    on(controls, 'click', (_e, el) => {
      if (el.classList.contains('decrement')) {
        host.value = Math.max(0, host.value - 1)
      } else if (el.classList.contains('increment')) {
        host.value = Math.min(host.max, host.value + 1)
      }
    }),
    on(controls, 'keydown', (e) => {
      const { key } = e
      if (['ArrowUp', 'ArrowDown', '-', '+'].includes(key)) {
        e.stopPropagation()
        e.preventDefault()
        const delta = key === 'ArrowDown' || key === '-' ? -1 : 1
        host.value = Math.min(host.max, Math.max(0, host.value + delta))
      }
    }),
    watch(nonZero, nz => {
      input.hidden = !nz
      decrement.hidden = !nz
    }),
    zero && watch(nonZero, nz => {
      zero.hidden = nz
      increment.ariaLabel = nz ? incrementLabel : zero.textContent
    }),
    other && watch(nonZero, bindVisible(other)),
    watch(() => String(host.value), bindProperty(input, 'value')),
    watch(() => String(host.max), bindProperty(input, 'max')),
    watch(() => host.value >= host.max, bindProperty(increment, 'disabled')),
  ]
})
```

- Whenever the user clicks a button or presses a handled key, the value property is updated.
- The component sets hidden and disabled states of buttons and updates the text of the `input` element.

### Full Example

Here's how everything comes together:

- Each `FormSpinbutton` tracks its own value.
- The `ModuleCatalog` sums all quantities and passes the total to `BasicButton`.
- The `BasicButton` displays the total if it's greater than zero.

**No custom events are needed – state flows naturally!**

```html
<module-catalog>
  <header>
    <p>Shop</p>
    <basic-button disabled>
      <button type="button" disabled>
        <span class="label">🛒 Shopping Cart</span>
        <span class="badge"></span>
      </button>
    </basic-button>
  </header>
  <ul>
    <li>
      <p>Product 1</p>
      <form-spinbutton>
        <button type="button" class="decrement" aria-label="Decrement" hidden>
          −
        </button>
        <input
          type="number"
          class="value"
          name="amount-product1"
          value="0"
          min="0"
          max="10"
          readonly
          disabled
          hidden
        />
        <button type="button" class="increment" aria-label="Increment">
          <span class="zero">Add to Cart</span>
          <span class="other" hidden>+</span>
        </button>
      </form-spinbutton>
    </li>
    <li>
      <p>Product 2</p>
      <form-spinbutton>
        <button type="button" class="decrement" aria-label="Decrement" hidden>
          −
        </button>
        <input
          type="number"
          class="value"
          name="amount-product2"
          value="0"
          min="0"
          max="5"
          readonly
          disabled
          hidden
        />
        <button type="button" class="increment" aria-label="Increment">
          <span class="zero">Add to Cart</span>
          <span class="other" hidden>+</span>
        </button>
      </form-spinbutton>
    </li>
    <li>
      <p>Product 3</p>
      <form-spinbutton>
        <button type="button" class="decrement" aria-label="Decrement" hidden>
          −
        </button>
        <input
          type="number"
          class="value"
          name="amount-product3"
          value="0"
          min="0"
          max="20"
          readonly
          disabled
          hidden
        />
        <button type="button" class="increment" aria-label="Increment">
          <span class="zero">Add to Cart</span>
          <span class="other" hidden>+</span>
        </button>
      </form-spinbutton>
    </li>
  </ul>
</module-catalog>
```

{% sources title="ModuleCatalog source code" src="./sources/module-catalog.html" /%}
{% sources title="BasicButton source code" src="./sources/basic-button.html" /%}
{% sources title="FormSpinbutton source code" src="./sources/form-spinbutton.html" /%}

## Managing Dynamic Lists

The component coordination patterns above work with a fixed set of children. When your list grows and shrinks at runtime, you need a different approach: a **container** element where items live, a **`<template>`** for the item markup, and imperative **methods** on the host to add and remove items.

### Exposing Methods

Not every component property is a reactive signal. When a property represents a **command** — something you call rather than something you observe — use `defineMethod()`. Pass it directly to `expose()` with the callable function as the argument:

```js
defineComponent('module-list', ({ expose, first }) => {
  const container = first('[data-container]', 'Add a container element for items.')
  const template = first('template', 'Add a template element for items.')

  let addKey = 0
  expose({
    add: defineMethod((process) => {
      const item = template.content.cloneNode(true).firstElementChild
      if (item instanceof HTMLElement) {
        item.dataset.key = String(addKey++) // stable identity for removal
        if (process) process(item)          // optional post-processing before insert
        container.append(item)
      }
    }),
    delete: defineMethod((key) => {
      container.querySelector(`[data-key="${key}"]`)?.remove()
    }),
  })
  // ...
})
```

The function passed to `defineMethod()` IS the callable method — `host.add` and `host.delete` will be that function. The `container`, `template`, and `addKey` references come from the factory closure. After connect, callers can use `host.add()` and `host.delete(key)` imperatively.

> **Always use defineMethod(), never a plain function:** Le Truc identifies method producers by a brand symbol attached by `defineMethod()`. An unbranded function passed to `expose()` is treated as a thunk instead. The same rule applies to custom parsers: always use `asParser()`.

### HTML Structure

The component needs a container and a template:

```html
<module-list>
  <ul data-container></ul>
  <template>
    <li>
      <span><slot></slot></span>
      <basic-button class="delete">
        <button type="button">Remove</button>
      </basic-button>
    </li>
  </template>
</module-list>
```

Items already present in the container on first render are preserved. The `<template>` element is inert — its content is only cloned when `host.add()` is called.

### Handling Deletion by Event Delegation

Rather than attaching a listener to each delete button, use event delegation on the host: one `on(host, 'click', ...)` handler checks whether the click reached a delete button, then removes the closest keyed ancestor:

```js
on(host, 'click', e => {
  const target = e.target
  if (target instanceof HTMLElement && target.closest('basic-button.delete')) {
    e.stopPropagation()
    target.closest('[data-key]')?.remove()
  }
})
```

This scales to any number of items and works for items added after setup — no re-binding needed.

### Coordinating Child Components

`module-list` also coordinates with a `form-textbox` and an add `basic-button`. When the form is submitted, it reads the textbox value, adds the item, then clears the input. The add button is disabled when the textbox is empty or the item limit is reached:

```js
({ expose, first, host, on, pass }) => {
  const container = first('[data-container]', 'Add a container element for items.')
  const template = first('template', 'Add a template element for items.')
  const form = first('form')
  const textbox = first('form-textbox')
  const add = first('basic-button.add')

  const max = asInteger(1000)(host.getAttribute('max'))

  // ... expose({ add: defineMethod(...), delete: defineMethod(...) })

  return [
    form && on(form, 'submit', e => {
      e.preventDefault()
      const content = textbox?.value
      if (content) {
        host.add(item => {
          item.querySelector('slot')?.replaceWith(content) // fill template slot
        })
        textbox.clear() // call method on child component
      }
    }),
    add && pass(add, {
      disabled: () =>
        (textbox && !textbox.length) || container.children.length >= max,
    }),
    on(host, 'click', e => { /* delegation for delete */ }),
  ]
}
```

`textbox.clear()` is itself a method property on `form-textbox` — the same `defineMethod()` pattern in a child component. `pass()` drives the button's `disabled` state reactively from two conditions without the button knowing anything about either.

### Full Example

```html
<module-list>
  <ul data-container></ul>
  <template>
    <li>
      <span><slot></slot></span>
      <basic-button class="delete">
        <button type="button" class="tertiary destructive small">Remove</button>
      </basic-button>
    </li>
  </template>
  <form>
    <form-textbox clearable>
      <label for="new-item-input">New item</label>
      <div class="input">
        <input
          type="text"
          id="new-item-input"
          name="new-item"
          autocomplete="off"
        />
        <button type="button" class="clear" aria-label="Clear input" hidden>✕</button>
      </div>
    </form-textbox>
    <basic-button class="add">
      <button type="submit" class="constructive">Add</button>
    </basic-button>
  </form>
</module-list>
```

{% sources title="ModuleList source code" src="./sources/module-list.html" /%}
{% sources title="FormTextbox source code" src="./sources/form-textbox.html" /%}
{% sources title="BasicButton source code" src="./sources/basic-button.html" /%}

## Providing Context

Context allows **parent components to share state** with any descendant components in the DOM tree, **without prop drilling**. This is perfect for application-wide settings like user preferences, theme data, or authentication state.

### Creating Context Keys

First, define typed context keys for the values you want to share:

```ts#context-media.ts
// Define context keys with types
export const MEDIA_MOTION = 'media-motion' as Context<
  'media-motion',
  () => 'no-preference' | 'reduce'
>
export const MEDIA_THEME = 'media-theme' as Context<
  'media-theme',
  () => 'light' | 'dark'
>
```

### Provider Component

The **provider component** creates the shared state inside `expose()` and calls `provideContexts()` in the returned effect array. The example below is a simplified excerpt showing two of the four media contexts — see the full source for the complete implementation:

```ts#context-media.ts
export type ContextMediaProps = {
  readonly 'media-motion': 'no-preference' | 'reduce'
  readonly 'media-theme': 'light' | 'dark'
}

declare global {
  interface HTMLElementTagNameMap {
    'context-media': HTMLElement & ContextMediaProps
  }
}

export default defineComponent<ContextMediaProps>(
  'context-media',
  ({ expose, provideContexts }) => {
    expose({
      [MEDIA_MOTION]: createSensor(
        set => {
          const mql = matchMedia('(prefers-reduced-motion: reduce)')
          const listener = (e) => set(e.matches ? 'reduce' : 'no-preference')
          mql.addEventListener('change', listener)
          return () => mql.removeEventListener('change', listener)
        },
        { value: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference' },
      ),
      [MEDIA_THEME]: createSensor(
        set => {
          const mql = matchMedia('(prefers-color-scheme: dark)')
          const listener = (e) => set(e.matches ? 'dark' : 'light')
          mql.addEventListener('change', listener)
          return () => mql.removeEventListener('change', listener)
        },
        { value: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' },
      ),
    })

    return [provideContexts([MEDIA_MOTION, MEDIA_THEME])]
  },
)
```

### Usage in HTML

The provider component wraps your entire application or a section that needs shared state:

```html#index.html
<context-media>
  <!-- Arbitrarily nested HTML with one or many context consumers -->
  <main>
    <card-mediaqueries>
      <dl>
        <dt>Motion Preference:</dt>
         <dd class="motion"></dd>
        <dt>Theme Preference:</dt>
        <dd class="theme"></dd>
      </dl>
    </card-mediaqueries>
  </main>
</context-media>
```

## Consuming Context

**Consumer components** use `requestContext()` inside `expose()` to access shared state from ancestor providers. The returned `Memo<T>` is reactive — when the provider's signal updates, all consumers update automatically.

### Consumer Component

Here's a simple card that displays the current motion and theme preferences:

```js#card-mediaqueries.js
export default defineComponent(
  'card-mediaqueries',
  ({ expose, first, requestContext, watch }) => {
    const motionEl = first('.motion')
    const themeEl = first('.theme')
    const viewportEl = first('.viewport')
    const orientationEl = first('.orientation')

    expose({
      motion: requestContext(MEDIA_MOTION, 'unknown'),
      theme: requestContext(MEDIA_THEME, 'unknown'),
      viewport: requestContext(MEDIA_VIEWPORT, 'unknown'),
      orientation: requestContext(MEDIA_ORIENTATION, 'unknown'),
    })

    return [
      motionEl && watch('motion', bindText(motionEl)),
      themeEl && watch('theme', bindText(themeEl)),
      viewportEl && watch('viewport', bindText(viewportEl)),
      orientationEl && watch('orientation', bindText(orientationEl)),
    ]
  },
)
```

### Full Example

```html
<context-media>
  <card-mediaqueries>
    <dl>
      <dt>Motion Preference:</dt>
      <dd class="motion"></dd>
      <dt>Theme Preference:</dt>
      <dd class="theme"></dd>
      <dt>Device Viewport:</dt>
      <dd class="viewport"></dd>
      <dt>Device Orientation:</dt>
      <dd class="orientation"></dd>
    </dl>
  </card-mediaqueries>
</context-media>
```

{% sources title="ContextMedia source code" src="./sources/context-media.html" /%}
{% sources title="CardMediaqueries source code" src="./sources/card-mediaqueries.html" /%}
