---
title: 'Data Flow'
emoji: '🔄'
description: 'Passing state, events, context'
---

{% hero %}
# 🔄 Data Flow

**Learn how Le Truc components can work together seamlessly.** Start with simple parent-child relationships, then explore advanced patterns like custom events and shared state. Build modular, loosely coupled components that communicate efficiently.
{% /hero %}

{% section %}
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

The **parent component (`ModuleCatalog`) knows about its children**, meaning it can **read state from and pass state to** them.

First, we need to observe the quantities of all `FormSpinbutton` components. For this, we use the `all()` function which returns a `Memo<E[]>` — a lazily observed collection of all children matching the `form-spinbutton` selector:

```js#module-catalog.js
defineComponent(
  'module-catalog',
  {},
  ({ all, first }) => ({
    button: first('basic-button', 'Add a button to go go the Shopping Cart'),
    spinbuttons: all(
      'form-spinbutton',
      'Add spinbutton components to calculate sum from.',
    ),
  }),
  ui => {
    // Component setup
  },
)
```

In contrast to a static `querySelectorAll()` call, the `Memo<E[]>` returned by `all()` is reactive and updates whenever new elements are added or removed from the DOM.

Then, we need to convert the total of all product quantities to a string and pass it on to the `BasicButton` component. In Le Truc we use the `pass()` function to share state with descendant components:

```js#module-catalog.js
defineComponent(
  'module-catalog',
  {},
  ({ all, first }) => ({
    button: first('basic-button', 'Add a button to go go the Shopping Cart'),
    spinbuttons: all(
      'form-spinbutton',
      'Add spinbutton components to calculate sum from.',
    ),
  }),
  ({ spinbuttons }) => {
    const total = createMemo(() =>
      spinbuttons.get().reduce((sum, item) => sum + item.value, 0),
    )
    return {
      button: pass({
        disabled: () => !total.get(),
        badge: () => (total.get() > 0 ? String(total.get()) : ''),
      }),
    }
  },
)
```

Allright, that's it!

- Whenever one of the `value` signals of a `<form-spinbutton>` updates, the total in the badge of `<basic-button>` automatically updates.
- No need for event listeners or manual updates!

### Child Component: BasicButton

The `BasicButton` component **displays a badge when needed** – it does not know about any other component nor track state itself. It just exposes a reactive properties `badge` of type `string` and `disabled` of type `boolean` and has effects to react to state changes that updates the DOM subtree.

```js#basic-button.js
defineComponent(
  'basic-button',
  {
    disabled: asBoolean(),
    badge: asString(ui => ui.badge?.textContent ?? ''),
  },
  ({ first }) => ({
    button: first('button', 'Add a native button as descendant.'),
    badge: first('span.badge'),
  }),
  () => ({
    button: setProperty('disabled'),
    badge: setText('badge'),
  }),
)
```

- Whenever the `disabled` property is updated by a parent component, the button is disabled or enabled.
- Whenever the `badge` property is updated by a parent component, the badge text updates.
- If `badge` is an empty string, the badge indicator is hidden (via CSS).

### Child Component: FormSpinbutton

The `FormSpinbutton` component reacts to user interactions and exposes a reactive property `value` of type `number`. It updates its own internal DOM subtree, but doesn't know about any other component nor where the value is used.

```js#form-spinbutton.js
defineComponent(
  'form-spinbutton',
  {
    value: createEventsSensor(
      read(ui => ui.input.value, asInteger()),
      'controls',
      {
        change: ({ ui, target, prev }) => {
          if (!(target instanceof HTMLInputElement)) return prev

          const resetTo = (next: number) => {
            target.value = String(next)
            target.checkValidity()
            return next
          }

          const next = Number(target.value)
          if (!Number.isInteger(next)) return resetTo(prev)
          const clamped = Math.min(ui.host.max, Math.max(0, next))
          if (next !== clamped) return resetTo(clamped)
          return clamped
        },
        click: ({ target, prev }) =>
          prev +
          (target.classList.contains('decrement')
            ? -1
            : target.classList.contains('increment')
              ? 1
              : 0),
        keydown: ({ ui, event, prev }) => {
          const { key } = event
          if (['ArrowUp', 'ArrowDown', '-', '+'].includes(key)) {
            event.stopPropagation()
            event.preventDefault()
            const next = prev + (key === 'ArrowDown' || key === '-' ? -1 : 1)
            return Math.min(ui.host.max, Math.max(0, next))
          }
        },
      },
    ),
    max: read(ui => ui.input.max, asInteger(10)),
  },
  ({ all, first }) => ({
    controls: all(
      'button, input:not([disabled])',
    ),
    increment: first(
      'button.increment',
      'Add a native button to increment the value',
    ),
    decrement: first(
      'button.decrement',
      'Add a native button to decrement the value',
    ),
    input: first('input.value', 'Add a native input to display the value'),
    zero: first('.zero'),
    other: first('.other'),
  }),
  ({ host, increment, zero }) => {
    const nonZero = createMemo(() => host.value !== 0)
    const incrementLabel = increment.ariaLabel || 'Increment'
    const ariaLabel = createMemo(() =>
      nonZero.get() || !zero ? incrementLabel : zero.textContent,
    )

    return {
      input: [
        show(nonZero),
        setProperty('value'),
        setProperty('max', () => String(host.max)),
      ],
      decrement: show(nonZero),
      increment: [
        setProperty('disabled', () => host.value >= host.max),
        setProperty('ariaLabel', ariaLabel),
      ],
      zero: show(() => !nonZero.get()),
      other: show(nonZero),
    }
  },
)
```

- Whenever the user clicks a button or presses a handled key, the value property is updated.
- The component sets hidden and disabled states of buttons and updates the text of the `input` element.

### Full Example

Here's how everything comes together:

- Each `FormSpinbutton` tracks its own value.
- The `ModuleCatalog` sums all quantities and passes the total to `BasicButton`.
- The `BasicButton` displays the total if it's greater than zero.

**No custom events are needed – state flows naturally!**

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
{% /demo %}

{% /section %}

{% section %}

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

The **provider component** creates the shared state and makes it available to descendants:

```ts#context-media.ts
export type ContextMediaProps = {
  readonly 'media-motion': 'no-preference' | 'reduce'
  readonly 'media-theme': 'light' | 'dark'
}

declare global {
  interface HTMLElementTagNameMap {
    'context-media': Component<ContextMediaProps>
  }
}

export default defineComponent<ContextMediaProps>(
  'context-media',
  {
    [MEDIA_MOTION]: () => {
      const mql = matchMedia('(prefers-reduced-motion: reduce)')
      const motion = createState(mql.matches ? 'reduce' : 'no-preference')
      mql.addEventListener('change', e => {
        motion.set(e.matches ? 'reduce' : 'no-preference')
      })
      return motion
    },
    [MEDIA_THEME]: () => {
      const mql = matchMedia('(prefers-color-scheme: dark)')
      const theme = createState(mql.matches ? 'dark' : 'light')
      mql.addEventListener('change', e => {
        theme.set(e.matches ? 'dark' : 'light')
      })
      return theme
    },
  },
  undefined, // Component has no own descendant elements
  () => ({
    host: provideContexts([MEDIA_MOTION, MEDIA_THEME]),
  }),
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

**Key Benefits:**

- **Centralized State**: All global state is managed in one place
- **Type Safety**: Full TypeScript support with autocomplete
- **Reactive Updates**: All consumers automatically update when context changes
- **No Prop Drilling**: Deep components access context directly

{% /section %}

{% section %}

## Consuming Context

**Consumer components** use `requestContext()` to access shared state from ancestor providers. The context is automatically reactive - when the provider updates the context, all consumers update immediately.

### Consumer Component

Here's a simple card that displays the current motion and theme preferences:

```js#card-mediaqueries.js
export default defineComponent(
  'card-mediaqueries',
  {
    motion: requestContext(MEDIA_MOTION, 'unknown'),
    theme: requestContext(MEDIA_THEME, 'unknown'),
  },
  ({ first }) => ({
    motion: first('.motion'),
    theme: first('.theme'),
  }),
  () => ({
    motion: setText('motion'),
    theme: setText('theme'),
  }),
)
```

### Full Example

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
