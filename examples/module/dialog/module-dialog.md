### Module Dialog

A native `<dialog>` wrapper with scroll lock and focus restoration. Demonstrates initialising a reactive property with a static value (`open: false`) instead of a parser, and using a raw effect function on `host` that wraps `createEffect()` directly — showing how to manage complex imperative side effects (calling `showModal()`/`close()`, toggling body scroll classes, restoring focus) in a fully reactive way with proper cleanup.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-dialog.html" /%}
{% /demo %}

#### Tag Name

`module-dialog`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `open`
* `boolean`
* `false`
* Whether the dialog is open
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `first('button[aria-haspopup="dialog"]')`
* `HTMLButtonElement`
* **required**
* Button that opens the dialog
---
* `first('dialog')`
* `HTMLDialogElement`
* **required**
* Native dialog element controlled by `open`
---
* `first('dialog button.close')`
* `HTMLButtonElement`
* **required**
* Close button inside the dialog
{% /table %}
