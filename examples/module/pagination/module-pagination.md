### Module Pagination

A keyboard-navigable page selector with clamped numeric input. Demonstrates `asClampedInteger()` to initialise both `value` and `max` from the input element's DOM properties in `expose()`, multiple `watch()` effects per source (e.g. `value` drives an attribute, the input field, and the prev-button disabled state), setting `host.hidden` directly inside `watch('max')` to hide the entire control when there is only one page, and `host.setAttribute()` to keep `value` and `max` in sync as attributes for use by external CSS or components.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-pagination.html" /%}
{% /demo %}

#### Tag Name

`module-pagination`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `value`
- `number` (integer)
- `1`
- Current page value, clamped to range `1..max`
---
- `max`
- `number` (integer)
- `1`
- Maximum page value
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('input')`
- `HTMLInputElement`
- **required**
- Numeric input for direct page entry
---
- `first('button.prev')`
- `HTMLButtonElement`
- **required**
- Previous-page control
---
- `first('button.next')`
- `HTMLButtonElement`
- **required**
- Next-page control
---
- `first('.value')`
- `HTMLElement`
- optional
- Text output for current page
---
- `first('.max')`
- `HTMLElement`
- optional
- Text output for max page
{% /table %}
