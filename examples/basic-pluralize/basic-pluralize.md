### Basic Pluralize

A simple component that displays a pluralized text according to `Intl.PluralRules` and the `lang` context for different plural forms.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="./sources/basic-pluralize.html" /%}
{% /demo %}

#### Tag Name

`basic-pluralize`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `count`
* `number` (positive integer)
* `0`
* Current count
{% /table %}

#### Attributes

| Name      | Description                                                                              |
| ---       | ---                                                                                      |
| `lang`    | Language code to use as locale; if omitted, inherited from ancestor elements             |
| `ordinal` | Boolean attribute indicating whether to use ordinal type. If omitted, uses cardinal type |

#### Descendant Elements

Arbitrary `HTMLElement`s with the following classes, all optional:

| Selector           | Description                                    |
| ---                | ---                                            |
| `first('.count')`  | Displays the count value                       |
| `first('.none')`   | Shown if count is 0                            |
| `first('.some')`   | Shown if count is greater than 0               |
| `first('.zero')`   | Shown if count matches `zero` plural category  |
| `first('.one')`    | Shown if count matches `one` plural category   |
| `first('.two')`    | Shown if count matches `two` plural category   |
| `first('.few')`    | Shown if count matches `few` plural category   |
| `first('.many')`   | Shown if count matches `many` plural category  |
| `first('.other')`  | Shown if count matches `other` plural category |

The component has effects for classes `count`, `none` and `some` regardless of plural categories. All other classes toggle visibility only if they are part of the plural categories for the given locale. For example, `new Intl.PluralRules('en').resolvedOptions().pluralCategories` only includes `one` and `other`, or for ordinal type: `one`, `two`, `few`, and `other`.
