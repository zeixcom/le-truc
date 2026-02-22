### Basic Number

A locale-aware number display component that uses `Intl.NumberFormat` for decimals, units, and currencies. Demonstrates applying an effect directly to `host` using `setText()` — no descendant elements needed — and shows how standard HTML attributes (`lang`, `options`) can be read once in the setup function to configure non-reactive formatting behaviour. `asNumber()` initialises the reactive `value` property from the attribute.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="./sources/basic-number.html" /%}
{% /demo %}

#### Tag Name

`basic-number`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `value`
* `number` (float)
* `0`
* Number to format
{% /table %}

#### Attributes

{% table %}
* Name
* Description
---
* `lang`
* Language code to use as locale; if omitted, inherited from ancestor elements
---
* `options`
* Options for `Intl.NumberFormat` as JSON
{% /table %}

#### Descendant Elements

None. The formatted number is displayed directly in the host element.
