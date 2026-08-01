### Card Collapsible

A content-agnostic collapsible card built on the native `<details>`/`<summary>` element. It's a reminder that some interactive patterns don't need custom JavaScript at all — the browser already provides them.

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
