### Module Pagination

A keyboard-navigable pagination control with previous/next buttons and a clamped numeric input. It hides itself automatically when there's nothing to paginate.

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
