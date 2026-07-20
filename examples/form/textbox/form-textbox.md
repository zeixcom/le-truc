### Form Textbox

A general-purpose text field wrapper for `input` or `textarea` elements. Demonstrates `createState()` with `on()` for the read-only `length` property, `createMemo()` for a computed `description` that shows remaining character count when `data-remaining` is set on the description element, the MethodProducer pattern for `clear`, and `setAttribute()` for dynamic ARIA linkage (`aria-describedby`). Designed to be composable — `form-combobox` and `module-todo` both embed it and drive it via `pass()`. Form participation is via ElementInternals (`formAssociated: true`) with the managed form-control convention — value sync and reset are library-managed. Validity relays the inner input's `validationMessage` via `host.setCustomValidity()`, giving external consumers native `validationMessage` / `validity` / `:invalid` / `:user-invalid` parity. No hidden input needed.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-textbox.html" /%}
{% /demo %}

#### Tag Name

`form-textbox`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `value`
- `string`
- `''`
- Current textbox value
---
- `length`
- `number` (readonly)
- `0`
- Length of current textbox value
---
- `description`
- `string`
- Text content of `.description`
- Description/help text (or remaining characters when `data-remaining` is set)
{% /table %}

#### Methods

{% table %}
- Name
- Type
- Description
---
- `clear`
- `() => void`
- Method to clear the textbox and emit input/change events
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('input, textarea')`
- `HTMLInputElement | HTMLTextAreaElement`
- **required**
- Native text field bound to `value`; no `name` attribute needed (the host carries it)
---
- `first('button.clear')`
- `HTMLButtonElement`
- optional
- Clear action button; shown when `length > 0`
---
- `first('.error')`
- `HTMLElement`
- optional
- Validation message target linked by `aria-errormessage`
---
- `first('.description')`
- `HTMLElement`
- optional
- Description target linked by `aria-describedby`
{% /table %}
