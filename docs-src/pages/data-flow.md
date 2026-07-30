---
title: 'Data Flow'
emoji: '🔄'
description: 'Pass state, events, context'
---

{% hero %}
# 🔄 Data Flow

**Learn how Le Truc components coordinate state.** Pass reactive signals from parent to child with `pass()`. Manage dynamic lists with `reconcile()`. Share values across the component tree with context.
{% /hero %}

{% section %}
## Component Coordination

Consider a **product catalog** where users can add items to a shopping cart. Three independent components work together:

- `ModuleCatalog` **(Parent)**:
  - **Tracks all `SpinButton` components** in its subtree.
  - **Calculates the total count** of items in the shopping cart.
  - **Passes that total** to a `BasicButton`.
- `BasicButton` **(Child)**:
  - Displays a **badge** in the top-right corner when the `badge` property is set.
  - **Does not track any state.** It simply renders whatever value is passed to it.
- `FormSpinbutton` **(Child)**:
  - Displays an **Add to Cart** button initially.
  - When an item is added, it transforms into a **stepper** (increment/decrement buttons).

Although `BasicButton` and `FormSpinbutton` are completely independent, they need to work together. `ModuleCatalog` **coordinates the data flow between them**.

### Parent Component: ModuleCatalog

The **parent component (`ModuleCatalog`) knows about its children**. It can **read state from and pass state to** them. It uses `all()` to observe all `FormSpinbutton` quantities reactively. Then it uses `pass()` to drive the `BasicButton`'s `badge` and `disabled` state:

```js#module-catalog.js
defineComponent('module-catalog', ({ all, first, pass }) => {
  const button = first('basic-button', 'Add a button to go to the shopping cart')
  const spinbuttons = all(
    'form-spinbutton',
    'Add spinbutton components to calculate sum from.',
  )
  const total = createMemo(() =>
    spinbuttons.get().reduce((sum, item) => sum + item.value, 0),
  )

  pass(button, {
    disabled: () => !total.get(),
    badge: () => (total.get() > 0 ? String(total.get()) : ''),
  })
})
```

Whenever any `<form-spinbutton>` value changes, `total` updates and the badge reflects the new count. This needs no event listeners or manual wiring.

{% callout .caution title="pass() requires a Le Truc child" %}
`pass()` swaps the child's backing signal directly, so it only works for Le Truc components whose properties are Slot-backed. For any other custom element (Lit, Stencil, plain HTML), drive the child's property reactively with `watch(source, bindProperty(el, key))` instead.
{% /callout %}

### Child Component: BasicButton

The `BasicButton` component **displays a badge when needed**. It does not know about any other component, and it does not track state itself. It exposes reactive properties `disabled`, `label`, and `badge`. Its effects keep the DOM subtree in sync with those properties.

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

  watch('disabled', bindProperty(button, 'disabled'))
  if (label) watch('label', bindText(label))
  if (badge) watch('badge', bindText(badge))
})
```

- When a parent component updates `disabled`, the button becomes disabled or enabled.
- When a parent component updates `badge`, the badge text updates.
- If `badge` is an empty string, CSS hides the badge indicator.

### Child Component: FormSpinbutton

The `FormSpinbutton` component reacts to user interactions. It exposes a reactive property `value` of type `number`. It updates its own internal DOM subtree. It does not know about any other component or where the value is used.

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
  })
  on(controls, 'click', (_e, el) => {
    if (el.classList.contains('decrement')) {
      host.value = Math.max(0, host.value - 1)
    } else if (el.classList.contains('increment')) {
      host.value = Math.min(host.max, host.value + 1)
    }
  })
  on(controls, 'keydown', (e) => {
    const { key } = e
    if (['ArrowUp', 'ArrowDown', '-', '+'].includes(key)) {
      e.stopPropagation()
      e.preventDefault()
      const delta = key === 'ArrowDown' || key === '-' ? -1 : 1
      host.value = Math.min(host.max, Math.max(0, host.value + delta))
    }
  })
  watch(nonZero, nz => {
    input.hidden = !nz
    decrement.hidden = !nz
  })
  if (zero) watch(nonZero, nz => {
    zero.hidden = nz
    increment.ariaLabel = nz ? incrementLabel : zero.textContent
  })
  if (other) watch(nonZero, bindVisible(other))
  watch(() => String(host.value), bindProperty(input, 'value'))
  watch(() => String(host.max), bindProperty(input, 'max'))
  watch(() => host.value >= host.max, bindProperty(increment, 'disabled'))
})
```

- Whenever the user clicks a button or presses a handled key, the component updates the `value` property.
- The component sets hidden and disabled states of buttons.
- It updates the text of the `input` element.

### Full Catalog Example

Here is how everything comes together:

- Each `FormSpinbutton` tracks its own value.
- The `ModuleCatalog` sums all quantities and passes the total to `BasicButton`.
- The `BasicButton` displays the total if it is greater than zero.

**No custom events are needed. State flows naturally.**

{% demo %}
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
        >
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
        >
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
        >
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
{% /demo %}

{% /section %}

{% section %}

## Manage Dynamic Lists

The coordination patterns above assume a fixed set of children. When a list grows and shrinks at runtime, you need a different approach:

- A reactive **list of keyed items** holds the data
- **`reconcile()`** keeps the DOM in sync
- A **`<template>`** provides the markup for each item

### The Container, Template, and List

The component owns a `createList()`, a reactive ordered collection. Each item is a signal, identified by a stable string key. The HTML provides a container and an inert template:

```js#module-list.js
defineComponent('module-list', ({ first, host, on, pass }) => {
  const form = first('form', 'Add a form element to enter a new list item.')
  const textbox = first('form-textbox', 'Add <form-textbox> to enter a new item.')
  const submit = first('basic-button.submit', 'Add <basic-button.submit> to add items.')
  const container = first('[data-container]', 'Add a container element for items.')
  const template = first('template', 'Add a template element for items.')

  // Keyed reactive list of plain string items. The 'item' prefix feeds the
  // auto-incrementing key generator (item0, item1, ...); stable keys let
  // removal target the right item even as the list reorders.
  const list = createList([], { keyConfig: 'item' })

  reconcile(container, template, list, (element, item) => { /* fill content */ })
  on(form, 'submit', e => { /* add item */ })
  on(host, 'click', e => { /* remove item by delegation */ })
  pass(submit, { disabled: () => !textbox.length })
})
```

The `keyConfig` option controls key generation. A string prefix produces auto-incrementing keys (`'item'` → `item0`, `item1`, …). A function `(item) => string` derives the key from item content. Use this when the same item can reappear and must keep its identity. Without `keyConfig`, Le Truc falls back to position-based auto-increment.

### Reconcile the DOM

`reconcile(container, template, source, bindItem)` syncs the source's keys to the container's children in one declarative call. It runs once at connect and again whenever keys are added, removed, or reordered:

```js
reconcile(container, template, list, (element, item) => {
  element
    .querySelector('slot')
    ?.replaceWith(document.createTextNode(item.get()))
}),
```

For every key in source order, the container holds one element stamped with `data-key`. Entering keys clone the template's single root element and mount `bindItem(element, item, key)` in its own scope. Leaving keys dispose that scope and remove their element. Surviving elements move via `insertBefore()`, always reused, never recreated. Per-item value changes flow through the `item` signal and never trigger structural work.

`bindItem` does all content work. There is no default fill convention. A returned cleanup runs when the key leaves the list or the component disconnects. It also runs for **adopted** elements: children already in the container at connect time (server-rendered). Le Truc matches them to source keys by their `data-key` attribute and keeps them. It removes keyed children not in the source and all unkeyed children. `bindItem` should be idempotent against server-rendered content. In the example above, an adopted item has no `<slot>` left to replace. The fill is naturally a no-op.

Two escape hatches keep `reconcile()` composable:
- Children carrying `data-unreconciled` are exempt from reconciliation entirely. Le Truc never removes or repositions them, which suits drag-and-drop markers or server-streamed content arriving mid-interaction.
- Keyed elements are positioned relative to the keyed subset, not by absolute index, so unmanaged elements do not drift keyed positions.

The sync is strictly one-way, data → DOM. To change the list's structure, mutate the list in an event handler and let `reconcile()` write the DOM.

`bindItem` has **collector parity with `each()`'s callback**. You can call `watch()`, `on()`, `pass()`, and `each()` inside it directly. The collected descriptors activate against that per-item scope, not the driving structural effect. An item-level `watch(item, …)` never makes structural work depend on item signals. For static items, a one-time fill (as above) is enough. For items whose displayed content depends on signals that change after creation, call `watch()` inside `bindItem` instead.

### Add and Remove Items

Mutations go through the list. Never touch the DOM directly. The reconciler reacts to changes in the keys and updates the container for you.

```js
on(form, 'submit', e => {
  e.preventDefault()
  const value = textbox.value.trim()
  if (!value) return
  list.add(value)
  textbox.clear() // call a method on the child component
}),

// Event delegation: one handler removes any item whose Remove button was
// clicked, scaling to any number of items without per-item listeners.
on(host, 'click', e => {
  const target = e.target as HTMLElement
  if (!target.closest('basic-button.remove')) return
  const item = target.closest('[data-key]')
  if (!(item instanceof HTMLElement)) return
  e.stopPropagation()
  const key = item.dataset.key
  if (key) list.remove(key)
}),
```

`list.add(value)` returns the new key. `list.remove(key)` takes one. `textbox.clear()` is a method property on the `form-textbox` child component. `pass(submit, { disabled: ... })` drives the submit button's `disabled` state reactively from the textbox length. This is the same `pass()` thread as the rest of this page. The button does not need to know anything about the textbox.

### Full List Example

{% demo %}
```html
<module-list>
  <form action="#">
    <form-textbox clearable>
      <label for="new-item-input">New item</label>
      <div class="input">
        <input
          type="text"
          id="new-item-input"
          name="new-item"
          autocomplete="off"
        >
        <button type="button" class="clear" aria-label="Clear input" hidden>✕</button>
      </div>
    </form-textbox>
    <basic-button class="submit">
      <button type="submit" class="constructive" disabled>
        <span class="label">Add</span>
      </button>
    </basic-button>
  </form>
  <ul data-container></ul>
  <template>
    <li>
      <span><slot></slot></span>
      <basic-button class="remove">
        <button type="button" class="tertiary destructive small">Remove</button>
      </basic-button>
    </li>
  </template>
</module-list>
```

{% sources title="ModuleList source code" src="./sources/module-list.html" /%}
{% sources title="FormTextbox source code" src="./sources/form-textbox.html" /%}
{% sources title="BasicButton source code" src="./sources/basic-button.html" /%}
{% /demo %}

{% /section %}

{% section %}

## Provide Context

Context allows **parent components to share state** with any descendant components in the DOM tree, **without prop drilling**. Use it for application-wide settings like user preferences, theme data, or authentication state.

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

The **provider component** creates the shared state inside `expose()`. It calls `provideContexts()` in the returned effect array. The example below is a simplified excerpt. It shows two of the four media contexts. See the full source for the complete implementation:

```ts#context-media.ts
import { createContext, createSensor, defineComponent } from '@zeix/le-truc'

export type ContextMediaProps = {
  readonly motion: 'no-preference' | 'reduce'
  readonly theme: 'light' | 'dark'
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
      motion: createSensor(
        set => {
          const mql = matchMedia('(prefers-reduced-motion: reduce)')
          const listener = (e) => set(e.matches ? 'reduce' : 'no-preference')
          mql.addEventListener('change', listener)
          return () => mql.removeEventListener('change', listener)
        },
        { value: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference' },
      ),
      theme: createSensor(
        set => {
          const mql = matchMedia('(prefers-color-scheme: dark)')
          const listener = (e) => set(e.matches ? 'dark' : 'light')
          mql.addEventListener('change', listener)
          return () => mql.removeEventListener('change', listener)
        },
        { value: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' },
      ),
    })

    provideContexts(['motion', 'theme'])
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

{% /section %}

{% section %}

## Consume Context

**Consumer components** use `requestContext()` to access shared state from ancestor providers. The returned `Signal<T>` is reactive. When the provider's signal updates, all consumers update automatically. It serves the `fallback` until a provider answers. Even a provider that connects late (bundle ordering, code-splitting) is picked up. The consumer switches from `fallback` to the provided value automatically, without any extra code.

### Consumer Component

Here is a simple card that displays the current motion and theme preferences:

```js#card-mediaqueries.js
import { bindText, defineComponent } from '@zeix/le-truc'
import { MEDIA_MOTION, MEDIA_THEME } from '../../context/media/context-media'

export default defineComponent(
  'card-mediaqueries',
  ({ first, requestContext, watch }) => {
    const motionEl = first('.motion')
    const themeEl = first('.theme')

    const motion = requestContext(MEDIA_MOTION, 'unknown')
    const theme = requestContext(MEDIA_THEME, 'unknown')

    if (motionEl) watch(motion, bindText(motionEl))
    if (themeEl) watch(theme, bindText(themeEl))
  },
)
```

### Full Context Example

{% demo %}
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
{% /demo %}

{% /section %}

{% section %}
## Async State with Tasks

When a component needs to load data (fetch a fragment, import a module, run any async work), model it as a [`Task`](./api.html#functions/createTask). A `Task` is an async derivation. It auto-cancels in-flight work when its dependencies change. It exposes four states through `match()`: `ok`, `nil`, `stale`, and `err`.

Routing precedence is `nil` > `err` > `stale` > `ok`:

- **`nil`** fires on the first run, before any value has resolved
- **`err`** fires when the task rejects
- **`stale`** fires when the task has a retained value *and* is recomputing after a dependency change — use it to keep the old content visible while refreshing
- **`ok`** fires with the resolved value

The `module-lazyload` component shows the full pattern. It `fetch`es an HTML fragment and injects it into a content element. It drives separate loading, error, and content views from a single `Task`:

```js#module-lazyload.js
defineComponent('module-lazyload', ({ expose, first, host, watch }) => {
  const callout = first('card-callout', 'Needed to display loading state and error messages.')
  const loading = first('.loading', 'Needed to display loading state.')
  const errorEl = first('.error', 'Needed to display error messages.')
  const contentEl = first('.content', 'Needed to display content.')

  const content = createTask(async (_prev, abort) => {
    const url = host.src
    if (!url) throw new Error('No URL provided')
    const response = await fetch(url, { signal: abort })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
  })

  expose({ src: asString() })

  watch(content, {
    ok: html => {
      loading.hidden = true
      contentEl.hidden = false
      contentEl.innerHTML = html
    },
    nil: () => {
      loading.hidden = false
      contentEl.hidden = true
    },
    stale: () => {
      contentEl.style.setProperty('opacity', 'var(--opacity-dimmed)')
      return () => contentEl.style.removeProperty('opacity') // reset on next dispatch
    },
    err: error => {
      loading.hidden = true
      errorEl.hidden = false
      errorEl.textContent = error.message
      contentEl.hidden = true
      return () => { errorEl.hidden = true; errorEl.textContent = '' }
    },
  })
})
```

The HTML provides all three regions up front. The `watch` handler toggles their visibility as the `Task` moves through its states:

```html
<module-lazyload src="./fragments/details.html">
  <card-callout>
    <p class="loading" role="status">Loading…</p>
    <p class="error" role="alert" aria-live="assertive" hidden></p>
  </card-callout>
  <div class="content" hidden></div>
</module-lazyload>
```

{% callout .tip title="Return a cleanup from stale and err handlers" %}
`stale` and `err` receive no arguments. They may return a cleanup function that runs synchronously before the next dispatch. Use it to reset DOM state you changed, such as removing a dimming class or clearing the error text. This way the next `ok` or `stale` run starts clean.
{% /callout %}

{% callout .caution title="The Task owns the async work" %}
Do not `fetch` inside a plain `watch` callback. A `Task` receives an `AbortSignal`. It auto-cancels when its dependencies change, so switching `src` aborts the in-flight request. Its pending and error states become first-class reactive values that compose through `match()`.
{% /callout %}

{% /section %}

{% section %}
## Choose a Coordination Mechanism

The coordination patterns above all assume you have already split your UI into components. That decision comes first. It is a separate question from how the resulting pieces talk to each other.

### Split first, then coordinate

A component should encapsulate a design decision that is likely to change on its own. If two concerns will always change together, keep them in one component — splitting them only creates coupling you then have to bridge. Split when a part could be reused independently or could evolve on a different schedule than the rest.

Inside one component, shared state is just a local signal: a `State` or `Memo` created in the factory closure and read by that component's own effects. You need no coordination mechanism, because there is no boundary to cross.

### Coordinate across boundaries

Once a boundary exists, choose the mechanism by the shape of the relationship across it:

| Mechanism | Spans | Coupling | Use when |
|-----------|-------|----------|----------|
| `pass()` | parent → a specific child | parent names the child | A parent drives a named property on a direct child it already knows about — e.g. summing spinbutton values into a badge on its button |
| `provideContexts()` / `requestContext()` | ancestor → any descendant | none (decoupled) | Many consumers need the same value and you do not want to know which ones — theme, locale, auth state. Provider and consumer never reference each other by tag name |
| `Task` + `match()` | component ↔ server / external API | none (async boundary) | The source of truth is outside the page — a `fetch`, dynamic import, or any async stream. The component coordinates with an external system, not another component |

The first two move state *between* Le Truc components. A `Task` coordinates with the world outside the component tree: the server, a network endpoint, an async API. The boundary is different. The question is the same: how does this component get a value it does not own?

{% /section %}
