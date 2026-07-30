### Module Catalog

A wrapper component that aggregates `value` properties of all descendant `form-spinbutton` elements passes the total to the badge of the shopping cart button.

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
