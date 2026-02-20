### Form Textbox

A textbox component for `input` or `textarea` elements, with reactive value/length, validation messaging, description text, and optional clear action.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-textbox.html" /%}
{% /demo %}

#### Tag Name

`form-textbox`

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
* Current textbox value
---
* `length`
* `number` (readonly)
* `0`
* Length of current textbox value
---
* `error`
* `string`
* `''`
* Validation error text shown in `.error`
---
* `description`
* `string`
* Text content of `.description`
* Description/help text (or remaining characters when `data-remaining` is set)
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
* `first('input, textarea')`
* `HTMLInputElement | HTMLTextAreaElement`
* **required**
* Native text field bound to `value`
---
* `first('button.clear')`
* `HTMLButtonElement`
* optional
* Clear action button; shown when `length > 0`
---
* `first('.error')`
* `HTMLElement`
* optional
* Validation message target linked by `aria-errormessage`
---
* `first('.description')`
* `HTMLElement`
* optional
* Description target linked by `aria-describedby`
{% /table %}
