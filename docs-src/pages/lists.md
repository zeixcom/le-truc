---
title: 'Dynamic Lists'
emoji: '📋'
description: 'Keyed lists, reconcile, templates'
---

{% hero %}
# 📋 Dynamic Lists

**Grow and shrink keyed lists at runtime with `reconcile()`.** A reactive list holds the data. A `<template>` provides the markup. The DOM stays in sync — items enter, leave, and reorder, and no line of your code touches a DOM node directly.
{% /hero %}

{% section %}
## The Container, Template, and List

The coordination patterns in [Data Flow](data-flow.html) assume a fixed set of children. When a list grows and shrinks at runtime, you need three things instead:

- A reactive **list of keyed items** to hold the data
- A **`<template>`** in the HTML to provide the markup for each item
- **`reconcile()`** to keep the DOM in sync with the list's keys

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

{% /section %}

{% section %}
## Reconcile the DOM

`reconcile(container, template, source, bindItem)` syncs the source's keys to the container's children in one declarative call. It runs once at connect and again whenever keys are added, removed, or reordered:

```js
reconcile(container, template, list, (element, item, key, first) => {
  first('slot')?.replaceWith(document.createTextNode(item.get()))
}),
```

For every key in source order, the container holds one element stamped with `data-key`. Entering keys clone the template's single root element and mount `bindItem(element, item, key, first)` in its own scope. Leaving keys dispose that scope and remove their element. Surviving elements move via `insertBefore()`, always reused, never recreated. Per-item value changes flow through the `item` signal and never trigger structural work.

That reuse is the point. Recreating a row drops its state — focus, transition progress, an open menu. Keyed reconciliation preserves it, because the element instance survives every reorder.

See it for yourself. Check a checkbox, then shuffle or reverse the list: the checked state survives, and each row's `created #n` stamp stays with its element. Only the order changes. New keys get the next stamp number; removed keys take their rows with them.

{% demo %}
```html
<docs-reconcile>
  <div class="controls">
    <button type="button" data-add>Add town</button>
    <button type="button" data-remove>Remove last</button>
    <button type="button" data-shuffle>Shuffle</button>
    <button type="button" data-reverse>Reverse</button>
  </div>
  <ul data-container>
    <li data-key="Adelboden"><label><input type="checkbox"> <span class="key"></span></label> <small></small></li>
    <li data-key="Basel"><label><input type="checkbox"> <span class="key"></span></label> <small></small></li>
    <li data-key="Chur"><label><input type="checkbox"> <span class="key"></span></label> <small></small></li>
    <li data-key="Davos"><label><input type="checkbox"> <span class="key"></span></label> <small></small></li>
  </ul>
  <template>
    <li><label><input type="checkbox"> <span class="key"></span></label> <small></small></li>
  </template>
</docs-reconcile>
```
{% /demo %}

`bindItem`'s 4th parameter, `first`, looks up a descendant of `element` the same way the factory's own `first()` does: type-safe, and it throws when you pass a `required` message and nothing matches. Use it instead of `element.querySelector()` for type inference and actionable errors. It has one difference from the factory's `first()`: it never waits for an undefined custom element inside the item to be defined. An item added later can never block the host component's own effects, so there is nothing to wait for.

`bindItem` does all content work. There is no default fill convention. A returned cleanup runs when the key leaves the list or the component disconnects. It also runs for **adopted** elements: children already in the container at connect time (server-rendered). Le Truc matches them to source keys by their `data-key` attribute and keeps them. It removes keyed children not in the source and all unkeyed children. `bindItem` should be idempotent against server-rendered content. In the example above, an adopted item has no `<slot>` left to replace. The fill is naturally a no-op.

Two escape hatches keep `reconcile()` composable:
- Children carrying `data-unreconciled` are exempt from reconciliation entirely. Le Truc never removes or repositions them, which suits drag-and-drop markers or server-streamed content arriving mid-interaction.
- Keyed elements are positioned relative to the keyed subset, not by absolute index, so unmanaged elements do not drift keyed positions.

The sync is strictly one-way, data → DOM. To change the list's structure, mutate the list in an event handler and let `reconcile()` write the DOM.

`bindItem` has **collector parity with `each()`'s callback**. You can call `watch()`, `on()`, `pass()`, and `each()` inside it directly. The collected descriptors activate against that per-item scope, not the driving structural effect. An item-level `watch(item, …)` never makes structural work depend on item signals. For static items, a one-time fill (as above) is enough. For items whose displayed content depends on signals that change after creation, call `watch()` inside `bindItem` instead.

{% /section %}

{% section %}
## Add and Remove Items

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

`list.add(value)` returns the new key. `list.remove(key)` takes one. `textbox.clear()` is a method property on the `form-textbox` child component. `pass(submit, { disabled: ... })` drives the submit button's `disabled` state reactively from the textbox length. This is the same `pass()` as in [Data Flow](data-flow.html). The button does not need to know anything about the textbox.

{% /section %}

{% section %}
## Full List Example

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
