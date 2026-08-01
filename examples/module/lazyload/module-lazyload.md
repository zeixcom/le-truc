### Module Lazyload

Fetches and injects a remote HTML fragment into the page on demand. It demonstrates async data loading with distinct loading, error, and content states.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-lazyload.html" /%}
{% /demo %}

#### Tag Name

`module-lazyload`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `src`
- `string`
- `''`
- URL to fetch HTML content from
{% /table %}

#### Attributes

{% table %}
- Name
- Description
---
- `allow-scripts`
- If present, scripts in fetched HTML are allowed when rendering `.content`
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('card-callout')`
- `HTMLElement`
- **required**
- Callout wrapper for loading/error states
---
- `first('.loading')`
- `HTMLElement`
- **required**
- Loading state element
---
- `first('.error')`
- `HTMLElement`
- **required**
- Error message element
---
- `first('.content')`
- `HTMLElement`
- **required**
- Content container for fetched HTML
{% /table %}
