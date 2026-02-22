### Module Codeblock

A progressively enhanced code block that can collapse, expand, and copy its content. Demonstrates `asBoolean()` for a boolean attribute-backed property, `toggleAttribute()` to reflect `collapsed` back to the host element for CSS styling, and `on('click')` with simple imperative property updates. The `copy` effect is a custom reusable function (`copyToClipboard`) that returns an `Effect` — showing how to extract and share effect logic across components.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-codeblock.html" /%}
{% /demo %}

#### Tag Name

`module-codeblock`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `collapsed`
* `boolean`
* `false`
* Whether the code block is collapsed (`collapsed` attribute on host)
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `first('code')`
* `HTMLElement`
* **required**
* Source container used for copy-to-clipboard
---
* `first('button.overlay')`
* `HTMLButtonElement`
* optional
* Expands the block by setting `collapsed = false`
---
* `first('basic-button.copy')`
* `Component<BasicButtonProps>`
* optional
* Copy trigger; reads `copy-success` and `copy-error` messages
{% /table %}
