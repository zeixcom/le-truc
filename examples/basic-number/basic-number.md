### Basic Number

A component that displays a formatted number according to `Intl.NumberFormat` and the `lang` context for decimals, units, and currencies.

#### Tag Name

`basic-number`

#### Reactive Properties

- `value`: `number` indicating the number to format.

#### Attributes

- `lang`: `string` language code to use as locale. If omitted, inherited from ancestor elements.
- `options`: `JSON` options for `Intl.NumberFormat` to use.

#### Descendant Elements

None. The formatted number is displayed directly in the host element.

#### Preview

{% demo %}
{{content}}
---
{% sources title="Source code" src="./sources/basic-number.html" /%}
{% /demo %}
