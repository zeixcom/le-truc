### Form Inplace Edit

A self-contained inline label editor — click to edit, and the label seamlessly becomes a text field. It shows how a component can swap its own internal presentation in response to user interaction.

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

{% partial file="form-associated.md" /%}

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
