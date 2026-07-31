### Form Combobox

An advanced form component that coordinates a text input with a popup `form-listbox`.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-combobox.html" /%}
{% /demo %}

#### Tag Name

`form-combobox`

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
- Current input value
---
- `length`
- `number` (readonly)
- `0`
- Length of current input value
---
- `description`
- `string`
- Text content of `.description`
- Assistive/help text shown in `.description`
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
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('input')`
- `HTMLInputElement`
- **required**
- Textbox for combobox input; no `name` attribute needed (the host carries it)
---
- `first('form-listbox')`
- `HTMLElement & FormListboxProps`
- **required**
- Popup listbox used for option filtering/selection
---
- `first('button.clear')`
- `HTMLButtonElement`
- optional
- Clear action button; hidden when value is empty
---
- `first('form-combobox > .error')`
- `HTMLElement`
- optional
- Validation message target linked by `aria-errormessage`
---
- `first('.description')`
- `HTMLElement`
- optional
- Description target linked by `aria-describedby`
{% /table %}
