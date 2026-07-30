### Card Collapsible

A content-agnostic collapsible card wrapping a native `<details>`/`<summary>` element.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/card-collapsible.html" /%}
{% /demo %}

#### Tag Name

`card-collapsible`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `open`
- `boolean`
- from descendant `<details open>`
- Whether the card is expanded
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('details')`
- `HTMLDetailsElement`
- **required**
- Native disclosure element; put the header in `<summary>`, the body as sibling content
{% /table %}
