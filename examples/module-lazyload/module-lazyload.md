### Module Lazyload

A lazy-loading component that fetches HTML from `src`, renders it into `.content`, and shows loading/error states.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-lazyload.html" /%}
{% /demo %}

#### Tag Name

`module-lazyload`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `src`
* `string`
* `''`
* URL to fetch HTML content from
{% /table %}

#### Attributes

{% table %}
* Name
* Description
---
* `allow-scripts`
* If present, scripts in fetched HTML are allowed when rendering `.content`
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `first('card-callout')`
* `HTMLElement`
* **required**
* Callout wrapper for loading/error states
---
* `first('.loading')`
* `HTMLElement`
* **required**
* Loading state element
---
* `first('.error')`
* `HTMLElement`
* **required**
* Error message element
---
* `first('.content')`
* `HTMLElement`
* **required**
* Content container for fetched HTML
{% /table %}
