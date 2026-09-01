---
title: 'Data Flow'
emoji: '🔄'
description: 'Coordinate components, pass state'
---

{% hero %}
# Data Flow

**Split your UI into components, then coordinate across boundaries.** `pass()` drives a named child from a parent. Dynamic lists, context, and async state round out this chapter.
{% /hero %}

{% section %}
## Choose a Coordination Mechanism

The coordination patterns in this chapter all assume you have already split your UI into components. That decision comes first. It is a separate question from how the resulting pieces talk to each other.

### Split first, then coordinate

A component should encapsulate a design decision that is likely to change on its own. If two concerns will always change together, keep them in one component — splitting them only creates coupling you then have to bridge. Split when a part could be reused independently or could evolve on a different schedule than the rest.

Inside one component, shared state is just a local signal: a `State` or `Memo` created in the factory closure and read by that component's own effects. You need no coordination mechanism, because there is no boundary to cross.

### Coordinate across boundaries

Once a boundary exists, choose the mechanism by the shape of the relationship across it:

| Mechanism | Spans | Coupling | Use when |
|-----------|-------|----------|----------|
| [`pass()`](#component-coordination) | parent → a specific child | parent names the child | A parent drives a named property on a direct child it already knows about — e.g. summing spinbutton values into a badge on its button |
| [`provideContexts()` / `requestContext()`](context.html) | ancestor → any descendant | none (decoupled) | Many consumers need the same value and you do not want to know which ones — theme, locale, auth state. Provider and consumer never reference each other by tag name |
| [`Task` + `match()`](async.html) | component ↔ server / external API | none (async boundary) | The source of truth is outside the page — a `fetch`, dynamic import, or any async stream. The component coordinates with an external system, not another component |

The first two move state *between* Le Truc components. A `Task` coordinates with the world outside the component tree: the server, a network endpoint, an async API. The boundary is different. The question is the same: how does this component get a value it does not own?

Dynamic lists are the fourth tool: [`reconcile()`](lists.html) keeps the DOM in sync with a keyed list while it grows, shrinks, and reorders.

{% /section %}

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
