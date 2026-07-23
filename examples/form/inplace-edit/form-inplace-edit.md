### Form Inplace Edit

A self-contained inline label editor. Wraps a `<span>` (label display) and an edit button; on double-click or edit-button click it switches the span to a `<form-textbox>`, letting the user type a new value. Accepting the edit (✓ button or Enter) returns `{ editing: false, value }` from the `on()` handler to update the host; cancelling (ESC or blur) restores the display span. The `value` prop is reactive — wire it via `pass()` from the coordinating component to keep the display in sync with external data changes.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-inplace-edit.html" /%}
{% /demo %}

#### Tag Name

`form-inplace-edit`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `editing`
- `boolean`
- Attribute `editing`
- Whether edit mode is currently activated
---
- `value`
- `string`
- Text content of `.text`
- Current label value; reactive — set via `pass()` to keep display in sync with external data
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('.text')`
- `HTMLElement`
- **required**
- Label display element; hidden during editing
---
- `first('button')`
- `HTMLButtonElement`
- optional
- Toggle button: ✎ (view mode) / ✓ (edit mode)
{% /table %}
