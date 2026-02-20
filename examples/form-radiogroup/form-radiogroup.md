### Form Radiogroup

A radiogroup component that keeps the selected radio value in sync and provides keyboard focus management.

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
