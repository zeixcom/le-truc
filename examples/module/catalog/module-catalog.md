### Module Catalog

A coordinator component that aggregates the values of several `form-spinbutton` elements into a running total, shown on a shopping-cart badge. It shows how a component can orchestrate others' state without exposing any of its own.

Clicking the cart button also re-checks real availability for items in the cart (a mocked backend round trip) and may lower a spinbutton's `max` — Product 2 comes back with reduced stock, Product 3 comes back sold out. This demonstrates validity composition: the spinbutton's own `rangeOverflow` (recomputed from the new `max`) and the catalog's externally-set `customError` (explaining *why*) coexist on the same `internals` without either clobbering the other.

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
