### Basic Number

A component that displays a formatted number according to `Intl.NumberFormat` and the `lang` context for decimals, units, and currencies.

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
