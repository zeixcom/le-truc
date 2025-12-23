### Basic Pluralize

A simple component that displays a pluralized text according to `Intl.PluralRules` and the `lang` context for different plural forms.

#### Tag Name

`basic-pluralize`

#### Reactive Properties

- `count`: Positive integer `number` indicating the count as basis for pluralization.

#### Attributes

- `lang`: `string` language code to use as locale. If omitted, inherited from ancestor elements.
- `ordinal`: `boolean` indicating whether to use ordinal plural rules.

#### Descendant Elements

Arbitrary `HTMLElement`s with the following classes, that will be hidden or shown according to the plural rules that apply:

- `.count`: will hold the count value.
- `.none`: shown if count is 0.
- `.some`: shown if count is greater than 0.
- `.zero`: shown if count is 0 if locale has plural rules for zero.
- `.one`: shown if count is 1.
- `.two`: shown if count is 2 if locale has plural rules for two.
- `.few`: shown if count is few according to plural rules.
- `.many`: shown if count is many according to plural rules.
- `.other`: shown if count is other.

Depending on locales, a different set of classes may be used. For example, `new Intl.PluralRules('en').resolvedOptions().pluralCategories` only includes `one` and `other`.

#### Preview

{% demo %}
{{content}}
---
{% sources title="Source code" src="./sources/basic-pluralize.html" /%}
{% /demo %}
