### Module Catalog

A catalog component that aggregates quantities from descendant spinbuttons and passes a total badge/disabled state to a cart button.

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
