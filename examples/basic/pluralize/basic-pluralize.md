### Basic Pluralize

A locale-aware pluralization component. Its noun is one ICU MessageFormat pattern per locale — `{count, plural, one {task} other {tasks}}` in English — so the plural morphology lives inside the translation, and each locale spells exactly the arms its `Intl.PluralRules` set needs (Welsh and Arabic six, Chinese one). The server renders the matching form; the client re-evaluates the pattern when `count` changes.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="./sources/basic-pluralize.html" /%}
{% /demo %}

#### Tag Name

`basic-pluralize`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `count`
- `number` (positive integer)
- `0`
- Current count
{% /table %}

#### Attributes

{% table %}
- Name
- Description
---
- `lang`
- Language code to use as locale; if omitted, inherited from ancestor elements
---
- `ordinal`
- Boolean attribute indicating whether to use ordinal type. If omitted, uses cardinal type
{% /table %}

#### Descendant Elements

Arbitrary `HTMLElement`s with the following classes, all optional:

{% table %}
- Selector
- Description
---
- `first('.count')`
- Displays the count value
---
- `first('.none')`
- Shown if count is 0
---
- `first('.some')`
- Shown if count is greater than 0
---
- `first('.tasks')`
- Carries the noun: the `tasks` pattern evaluated for `count` (cardinal, or ordinal with the `ordinal` attribute) in the effective locale
{% /table %}

The `.tasks` text is component-owned: it comes from the component's own catalog (`i18n/<locale>.json`, key `basic-pluralize.tasks`), not from the page's light DOM. An instance rendered on the client alone, without the server's `i18n` attribute, speaks the source locale (English).
