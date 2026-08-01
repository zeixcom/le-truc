### Basic Number

A locale-aware number display that formats decimals, units, and currencies using `Intl.NumberFormat`. It shows how a reactive value can be rendered directly on the host element, without any descendant elements.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="./sources/basic-number.html" /%}
{% /demo %}

#### Tag Name

`basic-number`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `value`
- `number` (float)
- `0`
- Number to format
{% /table %}

#### Attributes

{% table %}
- Name
- Description
---
- `lang`
- Language code to use as locale; if omitted, inherited from ancestor elements
---
- `options`
- Options for `Intl.NumberFormat` as JSON
{% /table %}

#### Descendant Elements

None. The formatted number is displayed directly in the host element.
