### Module Catalog

A coordinator component with no reactive properties of its own. Demonstrates the `pass()` effect as the primary composition tool: `createMemo()` derives a `total` from the reactive `value` properties of all descendant `form-spinbutton` elements (read via an `all()` Memo), then `pass()` pushes `disabled` and `badge` values into `basic-button` reactively. Shows how Le Truc components can act as pure orchestrators without exposing any public state.

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
* Selector
* Type
* Required
* Description
---
* `first('basic-button')`
* `Component<BasicButtonProps>`
* **required**
* Shopping cart button receiving `disabled` and `badge` via `pass()`
---
* `all('form-spinbutton')`
* `Memo<Component<FormSpinbuttonProps>[]>`
* **required**
* Spinbuttons whose `value` properties are summed to compute cart total
{% /table %}
