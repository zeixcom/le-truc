---
title: Four Arguments for Four Guarantees
description: We tried to reduce defineComponent to fewer parameters. Here is what those four arguments actually guarantee — and the factory form we are introducing for version 2.0.
emoji: 🔬
layout: blog
date: 2026-04-04
modified-date: 2026-04-09
author: Esther Brunner
tags: architecture, design
---

{% section %}
`defineComponent` takes four arguments. If you've written a few components, you've probably felt the weight of that. Here's a name, here's a props map, here's a select function, here's a setup function. That's a lot to hold in your head.

We spent time trying to reduce it. This is what those four parameters guarantee that you'd otherwise have to handle yourself — and why getting the signature right took longer than expected.

## What the four parameters do

A quick orientation, using `form-checkbox` as a running example:

```ts#form-checkbox.ts
defineComponent(
  'form-checkbox',     // 1. the custom element name
  {                    // 2. reactive properties and how to parse them
    checked: read(ui => ui.checkbox.checked, false),
    label: asString(({ host, label }) =>
      label?.textContent ?? host.querySelector('label')?.textContent ?? ''),
  },
  ({ first }) => ({    // 3. query DOM elements, return a ui object
    checkbox: first('input[type="checkbox"]', 'Add a native checkbox.'),
    label: first('.label'),
  }),
  ({ checkbox }) => ({ // 4. receive the ui object, return effects
    host: toggleAttribute('checked'),
    checkbox: [
      on('change', () => ({ checked: checkbox.checked })),
      setProperty('checked'),
    ],
    label: setText('label'),
  }),
)
```

Each argument runs at a different time. That's the key.

## The first constraint: observedAttributes must be static

The Web Components specification requires `observedAttributes` to be a static class property — declared once when `customElements.define()` is called, before any instance of the element exists. The browser reads it at registration time and uses it to decide which attribute changes should trigger `attributeChangedCallback`. There's no way to make it dynamic.

Le Truc derives `observedAttributes` automatically from the props map. Any property whose initializer is a `Parser` — a function branded with `asParser()`, such as `asString()` or `asBoolean()` — gets added to the list. Notice that `label` uses `asString()` (a Parser), while `checked` uses `read()` (a Reader). Le Truc adds only `'label'` to `observedAttributes`. `checked` is initialized from the DOM checkbox's state at connect time and controlled by user interaction after that — there's no attribute to watch.

In vanilla JS, this distinction is easy to get wrong in either direction: add `checked` to `observedAttributes` when you shouldn't, or forget to add `label` when you should. Le Truc derives the list from what you already declared, so the two can't diverge.

That derivation has to happen at class-definition time, not when a component connects. If the props map were inside a per-instance callback, the class wouldn't know which attributes to observe until the first element connected — which is too late.

This is why `props` must be a statically-evaluated argument, separate from everything else.

## The second constraint: select runs before setup

When a component connects to the DOM, things happen in a specific order:

```
connectedCallback
  1. select() → builds the ui object by querying the live DOM
  2. props initializers run → parsers and readers receive ui
  3. resolveDependencies() → waits up to 200ms for child custom elements to register
  4. setup() → runs inside that callback; effects become active
```

Step 3 is a hard boundary. If a component queries a child custom element — say a combobox wrapping a listbox — those effects depend on the child element having its own reactive properties set up. If effects run before the child element class is registered, you're operating on a plain `HTMLElement` that doesn't yet have the signal-backed interface you're relying on. `resolveDependencies` makes sure that doesn't happen, logging a timeout warning if the child class never registers rather than silently hanging.

`select` and `setup` therefore can't be the same function. By the time `setup` runs, the DOM query phase is long over and dependency resolution has already completed.

## What you're signing up for without it

Here's roughly what writing `form-checkbox` without Le Truc looks like:

```js
class FormCheckbox extends HTMLElement {
  static observedAttributes = ['label']  // easy to get wrong: might add 'checked', or miss 'label'
  #checkbox  // querySelector returns Element | null, not HTMLInputElement
  #label
  #abortController

  connectedCallback() {
    this.#checkbox = this.querySelector('input[type="checkbox"]')
    this.#label = this.querySelector('.label')
    this.#abortController = new AbortController()

    this.#checkbox?.addEventListener('change', () => {
      const checked = /** @type {HTMLInputElement} */ (this.#checkbox).checked
      this.toggleAttribute('checked', checked)
      this.#update()
    }, { signal: this.#abortController.signal })

    this.#update()
  }

  disconnectedCallback() {
    this.#abortController?.abort()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    this.#update()
  }

  #update() {
    const checkbox = /** @type {HTMLInputElement | null} */ (this.#checkbox)
    if (checkbox) checkbox.checked = this.hasAttribute('checked')
    if (this.#label) this.#label.textContent = this.getAttribute('label') ?? ''
  }
}
```

That's not terrible for a simple component. But several things can go wrong silently:

**`observedAttributes` gets out of sync.** Add a new attribute-driven property and forget to add it to the static list, and `attributeChangedCallback` never fires. No error, no warning — the component just doesn't respond. Le Truc derives the list from the props map, so the two can't diverge.

**`querySelector` returns `Element`, not `HTMLInputElement`.** The browser DOM API doesn't infer types from selector strings. To access `.checked`, you need to null-check the element and type-assert it. Miss the assertion and TypeScript will catch it; miss the null check and you get a runtime error. Le Truc's `first('input[type="checkbox"]')` returns `HTMLInputElement` at compile time — the selector string drives the type inference, and a required second argument throws at runtime if the element is missing.

**Child custom elements may not be registered yet.** If your component queries a child custom element in `connectedCallback`, it might not yet have its custom properties set up. Calling `.checked = true` on it may set a plain property rather than a signal-backed one. You'd need to call `customElements.whenDefined()` yourself and coordinate the timing. Le Truc does this for you, with a 200ms timeout so the component doesn't hang.

**`#update()` re-syncs everything.** When the `label` attribute changes, `attributeChangedCallback` fires and `#update()` runs — which also reasserts the `checked` state onto the checkbox, even though nothing about `checked` changed. For a simple component the overhead is minor. For one with many properties, each triggering a full re-sync, it adds up. Le Truc effects track exactly which signals they read and re-run only when those specific signals change.

**Properties aren't reactive.** When the user checks the checkbox, the `change` handler calls `this.toggleAttribute('checked', checked)` and that's the end of it. The attribute changes, but `this.checked` as a plain JS property notifies nobody. If a parent component is watching this element's `checked` state — to enable a submit button, say — it won't hear about it. To get outward propagation you'd need reactive property accessors: getters and setters with a notification mechanism, which is exactly what Lit, FAST, and similar libraries add on top of the platform. In Le Truc, `host.checked` is signal-backed. Setting it from the `change` handler — or from anywhere outside the component — notifies every effect that depends on it, whether that's the `toggleAttribute('checked')` inside `form-checkbox` or a `pass()` binding in a parent component that has no idea where its value comes from.

**Cleanup is your problem.** The `AbortController` pattern above handles the `change` listener. But if the component also set up a `MutationObserver`, a `ResizeObserver`, or a `requestAnimationFrame` loop, each needs its own teardown. Miss one and you leak. Le Truc wraps all effects in a single scope that's torn down automatically when the component disconnects — regardless of what kind of effect it is.

## Four parameters, four guarantees

The four arguments to `defineComponent` each eliminate a failure mode:

1. **`props`** — `observedAttributes` is always in sync with your parser functions. You can't forget to add an attribute, and you can't accidentally observe one that doesn't need watching.
2. **`select`** — `first()` and `all()` run at connect time against the live DOM and infer precise element types from selector strings. No manual null checks or type assertions.
3. **`resolveDependencies`** (implicit, between `select` and `setup`) — effects never run on elements whose class hasn't been registered yet.
4. **`setup`** — effects are declarative, track their own dependencies, and are scoped to the component's lifetime. Cleanup is automatic on disconnect.

The four-parameter shape is the API making explicit which things need to happen when. It looks like more than it needs to be until you've debugged a custom element where one of these guarantees was missing.

## The factory form for version 2.0

{% callout .tip title="Updated April 7, 2026" %}
This section was updated after the post was first published. The design below reflects the current proposal, including the decision to make version 2.0 a breaking change. You can read the full discussion and see the earlier version in the [GitHub issue](https://github.com/zeixcom/le-truc/issues/34).
{% /callout %}

For version 2.0, we're replacing the four-parameter form with a two-parameter factory. A single function receives context helpers, declares props with `expose()`, and returns a flat array of effects.

```ts#form-checkbox.ts
defineComponent<FormCheckboxProps>(
  'form-checkbox',
  ({ expose, first, host, on, watch }) => {
    const checkbox = first('input[type="checkbox"]', 'Add a native checkbox.')
    const label = first('.label')

    expose({
      checked: checkbox.checked,
      label: asString(label?.textContent ?? first('label')?.textContent ?? ''),
    })

    return [
      on(checkbox, 'change', () => ({ checked: checkbox.checked })),
      watch('checked', checked => {
        checkbox.checked = checked
        host.toggleAttribute('checked', checked)
      }),
      label && watch('label', bindText(label)),
    ]
  },
)
```

`checkbox` and `label` are declared once and referenced directly — in `expose()`, in event handlers, in `watch()` callbacks. There's also no separate `ComponentUI` type to declare. The factory closure captures queried elements, and TypeScript infers their types from the selector strings.

**The pivot.** Version 1.x thought about effects from the element's perspective: for this element, run this effect, update this property to this reactive value. The factory form flips it: when this reactive value changes, run this function. The `watch()` callback is plain procedural code — `checkbox.checked = checked`, `host.toggleAttribute('checked', checked)`. Standard DOM manipulation, fewer imports. Anything else inside the factory is regular JavaScript.

**The tradeoff.** No more `observedAttributes`. Parsers in `expose()` still run once at connect time, so server-rendered HTML can configure initial state via attributes. But `attributeChangedCallback` never fires. After connection, external state goes through the property interface. Attributes carry state from server to client; reactive properties drive client state. That split is sound.

**A breaking change.** Supporting the factory form alongside the old effects API would mean two implementations of the same concept in one library. We're not doing that. Le Truc stays small, with one mental model for effects. Version 2.0 drops the four-parameter form entirely. A clear breaking change is more honest than two parallel implementations.

[Follow the discussion on GitHub →](https://github.com/zeixcom/le-truc/issues/34)
{% /section %}
