### Form Checkbox

A checkbox component with a reactive checked state and label text, intended to wrap a native checkbox input.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-checkbox.html" /%}
{% /demo %}

#### Tag Name

`form-checkbox`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `checked`
* `boolean` (readonly)
* `false`
* Whether the native checkbox is checked
---
* `label`
* `string`
* Text content of `.label` or `label`
* Label text shown next to the checkbox
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `first('input[type="checkbox"]')`
* `HTMLInputElement`
* **required**
* Native checkbox element
---
* `first('.label')`
* `HTMLElement`
* optional
* Text target for `label` property
{% /table %}
