### Module List

A dynamic list component that owns its data with a reactive `createList()` and keeps the DOM in sync by diffing the list's stable keys. Demonstrates the canonical pattern for managing collections that grow and shrink at runtime: a `watch()` reconciler that inserts, removes, and repositions cloned template nodes; `on(form, 'submit')` calling `list.add()` then a child method (`textbox.clear()`); event delegation on the host for removal via `list.remove(key)`; and `pass()` driving the submit button's `disabled` state from the textbox length.

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
