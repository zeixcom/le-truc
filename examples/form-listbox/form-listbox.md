### Form Listbox

A form-aware listbox component with keyboard focus management, optional filtering, and support for inline or remote options.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-listbox.html" /%}
{% /demo %}

#### Tag Name

`form-listbox`

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
* Selected option value (`button[role="option"][aria-selected="true"]`)
---
* `options`
* `HTMLButtonElement[]`
* Visible `button[role="option"]` elements
* Live collection of selectable options
---
* `filter`
* `string`
* `''`
* Filter text used to hide/show options
---
* `src`
* `string`
* `''`
* URL for loading options JSON (flat or grouped)
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `first('input[type="hidden"]')`
* `HTMLInputElement`
* **required**
* Hidden form input synchronized with selected `value`
---
* `first('[role="listbox"]')`
* `HTMLElement`
* **required**
* Container for option buttons
---
* `first('input.filter')`
* `HTMLInputElement`
* optional
* Text input for client-side filtering
---
* `first('button.clear')`
* `HTMLButtonElement`
* optional
* Clears current filter text
---
* `first('card-callout')`
* `HTMLElement`
* optional
* Callout container for loading/error states when `src` is used
---
* `first('.loading')`
* `HTMLElement`
* optional
* Loading state element
---
* `first('.error')`
* `HTMLElement`
* optional
* Error message element
---
* `all('button[role="option"]')`
* `Memo<HTMLButtonElement[]>`
* optional
* Option buttons (inline and/or rendered from `src`)
{% /table %}
