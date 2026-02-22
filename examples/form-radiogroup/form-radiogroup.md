### Form Radiogroup

A roving-tabindex radio group with a read-only `value` sensor. Demonstrates `createEventsSensor()` with `all()` as the target — listening for `change` events across a live `Memo<HTMLInputElement[]>` collection — and `read()` to initialise the sensor from the currently checked radio. Also shows `setProperty()` and `toggleClass()` applied to `Memo` targets, which automatically re-run for each element in the collection whenever it changes.

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
* `string` (readonly)
* `''`
* Value of the currently checked radio input
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
