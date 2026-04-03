### Module Pagination

A keyboard-navigable page selector with clamped numeric input. Demonstrates `read()` with `asInteger()` to initialise both `value` and `max` from the input element's DOM properties, multiple effects per UI element (e.g. `input` gets both `on('change')` and `setProperty()`), `show()` on `host` to hide the entire control when there is only one page, and `setAttribute()` to keep `value` and `max` in sync as attributes for use by external CSS or components.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-pagination.html" /%}
{% /demo %}

#### Tag Name

`module-pagination`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `value`
* `number` (integer)
* `1`
* Current page value, clamped to range `1..max`
---
* `max`
* `number` (integer)
* `1`
* Maximum page value
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
* Numeric input for direct page entry
---
* `first('button.prev')`
* `HTMLButtonElement`
* **required**
* Previous-page control
---
* `first('button.next')`
* `HTMLButtonElement`
* **required**
* Next-page control
---
* `first('.value')`
* `HTMLElement`
* optional
* Text output for current page
---
* `first('.max')`
* `HTMLElement`
* optional
* Text output for max page
{% /table %}
