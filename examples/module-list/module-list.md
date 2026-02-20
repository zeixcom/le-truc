### Module List

A list-management component that clones items from a template, supports add/delete methods, and optionally integrates with form controls.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-list.html" /%}
{% /demo %}

#### Tag Name

`module-list`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `add`
* `(process?: (item: HTMLElement) => void) => void`
* Adds one item from `template` to `[data-container]`
* Method to append a new item, optionally post-processed before insert
---
* `delete`
* `(key: string) => void`
* Removes matching `[data-key]` item if found
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
