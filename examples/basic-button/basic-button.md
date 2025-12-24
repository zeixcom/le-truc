### Basic Button

A button component with a label, a disabled state, and an optional badge, intended to be controlled by a parent component.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/basic-button.html" /%}
{% /demo %}

#### Tag Name

`basic-button`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `badge`
* `string`
* `''`
* Badge text
---
* `disabled`
* `boolean`
* `false`
* Whether the button is disabled
---
* `label`
* `string`
* Text content of `span.label` or `button`
* Accessible name of button
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `first('button')`
* `HTMLButtonElement`
* **required**
* Native `button` element
---
* `first('span.badge')`
* `HTMLSpanElement`
* optional
* Setting `badge` property has no effect if the element is missing
---
* `first('span.label')`
* `HTMLSpanElement`
* optional
* Setting `label` property has no effect if the element is missing
{% /table %}
