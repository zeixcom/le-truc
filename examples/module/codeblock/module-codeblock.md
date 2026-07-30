### Module Codeblock

A progressively enhanced code block that can expand and copy its content.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-codeblock.html" /%}
{% /demo %}

#### Tag Name

`module-codeblock`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `collapsed`
- `boolean`
- `false`
- Whether the code block is collapsed (`collapsed` attribute on host)
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('code')`
- `HTMLElement`
- **required**
- Source container used for copy-to-clipboard
---
- `first('button.overlay')`
- `HTMLButtonElement`
- optional
- Expands the block by setting `collapsed = false`
---
- `first('basic-button.copy')`
- `HTMLElement & BasicButtonProps`
- optional
- Copy trigger; reads `copy-success` and `copy-error` messages
{% /table %}
