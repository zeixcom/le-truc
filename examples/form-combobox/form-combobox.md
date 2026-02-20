### Form Combobox

A combobox component that coordinates a text input and a listbox, with validation feedback and an optional clear action.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-combobox.html" /%}
{% /demo %}

#### Tag Name

`form-combobox`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `value`
* `string`
* `''`
* Current input value
---
* `length`
* `number` (readonly)
* `0`
* Length of current input value
---
* `error`
* `string`
* `''`
* Validation error text shown in `.error`
---
* `description`
* `string`
* Text content of `.description`
* Assistive/help text shown in `.description`
---
* `clear`
* `() => void` (readonly)
* Clears value, error, and validity state
* Method to clear the textbox and emit input/change events
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `first('input')`
* `HTMLInputElement`
* **required**
* Textbox for combobox input
---
* `first('form-listbox')`
* `Component<FormListboxProps>`
* **required**
* Popup listbox used for option filtering/selection
---
* `first('button.clear')`
* `HTMLButtonElement`
* optional
* Clear action button; hidden when value is empty
---
* `first('form-combobox > .error')`
* `HTMLElement`
* optional
* Validation message target linked by `aria-errormessage`
---
* `first('.description')`
* `HTMLElement`
* optional
* Description target linked by `aria-describedby`
{% /table %}
