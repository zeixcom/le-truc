### Basic Pluralize

A locale-aware pluralisation component driven by `Intl.PluralRules`. Demonstrates writing a custom parser (`asPositiveInteger`) that wraps `asInteger()` with additional validation, `show()` for conditional visibility, and `setText()` for the count display. The setup function builds the effects object dynamically — only attaching `show()` effects for the plural categories that the given locale actually uses — showing that effects are plain JavaScript values that can be composed programmatically.

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

{% table %}
* Name
* Description
---
* `lang`
* Language code to use as locale; if omitted, inherited from ancestor elements
---
* `ordinal`
* Boolean attribute indicating whether to use ordinal type. If omitted, uses cardinal type
{% /table %}

#### Descendant Elements

Arbitrary `HTMLElement`s with the following classes, all optional:

{% table %}
* Selector
* Description
---
* `first('.count')`
* Displays the count value
---
* `first('.none')`
* Shown if count is 0
---
* `first('.some')`
* Shown if count is greater than 0
---
* `first('.zero')`
* Shown if count matches `zero` plural category
---
* `first('.one')`
* Shown if count matches `one` plural category
---
* `first('.two')`
* Shown if count matches `two` plural category
---
* `first('.few')`
* Shown if count matches `few` plural category
---
* `first('.many')`
* Shown if count matches `many` plural category
---
* `first('.other')`
* Shown if count matches `other` plural category
{% /table %}

The component has effects for classes `count`, `none` and `some` regardless of plural categories. All other classes toggle visibility only if they are part of the plural categories for the given locale. For example, `new Intl.PluralRules('en').resolvedOptions().pluralCategories` only includes `one` and `other`, or for ordinal type: `one`, `two`, `few`, and `other`.
