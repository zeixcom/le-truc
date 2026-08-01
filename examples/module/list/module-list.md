### Module List

A dynamic list component that owns its data and keeps the DOM in sync via keyed reconciliation. It's the reference example for adding, removing, and reordering items without losing element identity.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-list.html" /%}
{% /demo %}

#### Tag Name

`module-list`

#### Reactive Properties

None. This component orchestrates behavior by passing state and events between descendants.

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('form')`
- `HTMLFormElement`
- **required**
- Submission entry point for adding items
---
- `first('form-textbox')`
- `HTMLElement & FormTextboxProps`
- **required**
- Input component for new item text; `clear()` is called after each add
---
- `first('basic-button.submit')`
- `HTMLElement & BasicButtonProps`
- **required**
- Submit button; disabled when the textbox is empty via `pass()`
---
- `first('[data-container]')`
- `HTMLElement`
- **required**
- Container element for list items; reconciled against the list keys
---
- `first('template')`
- `HTMLTemplateElement`
- **required**
- Template cloned for each item; root element receives `data-key`
{% /table %}
