### Form Textbox

A general-purpose wrapper for `input` and `textarea` elements, with built-in validation display and an optional clear button. It demonstrates relaying native validity state through the component so it behaves like a native form control.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-textbox.html" /%}
{% /demo %}

#### Tag Name

`form-textbox`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `value`
- `string`
- `''`
- Current textbox value
---
- `length`
- `number` (readonly)
- `0`
- Length of current textbox value
---
- `description`
- `string`
- Text content of `.description`
- Description/help text (or remaining characters when `data-remaining` is set)
{% /table %}

{% partial file="form-associated.md" /%}

#### Methods

{% table %}
- Name
- Type
- Description
---
- `clear`
- `() => void`
- Method to clear the textbox and emit input/change events
---
- `focusControl`
- `() => void`
- Moves focus to the owned `input`/`textarea` and selects its content
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('input, textarea')`
- `HTMLInputElement | HTMLTextAreaElement`
- **required**
- Native text field bound to `value`; no `name` attribute needed (the host carries it)
---
- `first('button.clear')`
- `HTMLButtonElement`
- optional
- Clear action button; shown when `length > 0`
---
- `first('.error')`
- `HTMLElement`
- optional
- Validation message target linked by `aria-errormessage`
---
- `first('.description')`
- `HTMLElement`
- optional
- Description target linked by `aria-describedby`
{% /table %}
