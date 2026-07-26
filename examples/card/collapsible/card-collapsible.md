### Card Collapsible

A content-agnostic collapsible card wrapping a native `<details>`/`<summary>` element. Demonstrates delegating disclosure behavior (keyboard toggling, find-in-page support) entirely to native HTML semantics: the component's only job is keeping a reactive `open` property in sync with the descendant `<details>` element's own `open` state, via a `toggle` event listener and a `watch('open', bindProperty(details, 'open'))` handler. The summary text is truncated with `text-overflow: ellipsis` while collapsed and shown in full once expanded — driven purely by the `details[open]` CSS selector, no JavaScript involved.

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
