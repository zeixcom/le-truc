### Basic Counter

A counter component with a button to increment the count and a span to display the current count.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/basic-counter.html" /%}
{% /demo %}

#### Tag Name

`basic-counter`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `count`
* `number` (integer)
* `0`
* Current count
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
* Increments the count
---
* `first('span')`
* `HTMLSpanElement`
* **required**
* Displays the current count
{% /table %}
