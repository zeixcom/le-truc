### Basic Counter

The canonical introductory example for Le Truc. Demonstrates `read()` combined with `asInteger()` to initialise a reactive property from existing DOM content rather than an attribute, `on('click')` to update `host.count` imperatively, and `setText()` to keep the display in sync. The setup function receives `host` via the UI object, showing the standard pattern for reading and mutating reactive properties inside effects.

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
