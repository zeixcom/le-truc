### Module Catalog

A coordinator component that aggregates the values of several `form-spinbutton` elements into a running total, shown on a shopping-cart badge. It shows how a component can orchestrate others' state without exposing any of its own.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-catalog.html" /%}
{% /demo %}

#### Tag Name

`module-catalog`

#### Reactive Properties

None. This component coordinates child component properties through effects.

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('basic-button')`
- `HTMLElement & BasicButtonProps`
- **required**
- Shopping cart button receiving `disabled` and `badge` via `pass()`
---
- `all('form-spinbutton')`
- `Memo<(HTMLElement & FormSpinbuttonProps)[]>`
- **required**
- Spinbuttons whose `value` properties are summed to compute cart total
{% /table %}
