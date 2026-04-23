### Module List

A dynamic list that clones items from a `<template>` element. Demonstrates the MethodProducer pattern: both `add` and `delete` are initializer functions typed as `ComponentUI → void` that install imperative methods directly on `host` as side effects during `connectedCallback`, rather than creating signals. The setup function uses `on('submit')` on the optional form and `pass()` to drive the add button's `disabled` state. Shows how to mix method-style and signal-style properties in the same component.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-list.html" /%}
{% /demo %}

#### Tag Name

`module-list`

#### Methods

{% table %}
* Name
* Type
* Description
---
* `add`
* `(process?: (item: HTMLElement) => void) => void`
* Method to append a new item, optionally post-processed before insert
---
* `delete`
* `(key: string) => void`
* Method to remove an item by key
{% /table %}

#### Attributes

{% table %}
* Name
* Description
---
* `max`
* Maximum number of items allowed when using the optional add form (`1000` default)
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `first('[data-container]')`
* `HTMLElement`
* **required**
* Container where cloned items are inserted
---
* `first('template')`
* `HTMLTemplateElement`
* **required**
* Template used as source for added items; each item's template should include a `.drag-handle` button for reordering
---
* `first('[role="status"]')`
* `HTMLElement`
* **required**
* Live region for screen reader announcements during keyboard reorder
---
* `first('form')`
* `HTMLFormElement`
* optional
* Optional form for submit-to-add behavior
---
* `first('form-textbox')`
* `Component<FormTextboxProps>`
* optional
* Optional textbox used by form submission flow
---
* `first('basic-button.add')`
* `Component<BasicButtonProps>`
* optional
* Optional add button receiving disabled state via `pass()`
{% /table %}

#### Reordering

Items can be reordered by dragging or by keyboard:

- **Drag**: grab the drag handle (⠿) of any item and drag it up or down; a dashed insertion marker shows where the item will land on release.
- **Keyboard**: click (or press Space/Enter on) a drag handle to select the item (`aria-pressed="true"`); use Up/Down arrow keys to move it one position at a time; press Escape or click the handle again to deselect.
