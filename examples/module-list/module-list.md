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
* Template used as source for added items
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
