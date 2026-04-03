### Form Radiogroup

A roving-tabindex radio group that works both **controlled** and **uncontrolled**. Demonstrates `read()` to initialise `value` from the currently checked radio, and `on('change', ...)` applied to the `radios` Memo so that user interaction propagates back to `host.value`. A `createEffect` on each radio element drives `checked`, `tabIndex`, and the `selected` label class from `host.value`, which means assigning `host.value = 'option'` programmatically is enough to move the selection — no event needed.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-radiogroup.html" /%}
{% /demo %}

#### Tag Name

`form-radiogroup`

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
* Value of the currently checked radio input; settable for controlled use
{% /table %}

#### Classes

Use `class` attribute to get a different style for the radio group.

{% table %}
* Class
* Description
---
* none
* Default browser style
---
* `radio-group`
* For a styled radio group
---
* `split-button`
* For a split button display
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `all('input[type="radio"]')`
* `Memo<HTMLInputElement[]>`
* **required**
* Native radio inputs (at least two)
---
* `all('label')`
* `Memo<HTMLLabelElement[]>`
* **required**
* Labels wrapping radio inputs; toggles `selected` class
{% /table %}