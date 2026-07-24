### Form Combobox

An advanced form component that coordinates a text input with a popup `form-listbox`. Demonstrates multiple Le Truc concepts together: `createState()` with `on()` for the read-only `length` property, `createMemo()` for private derived state (`isExpanded`), `pass()` to push the filter value into the child listbox reactively, `batch()` for simultaneous prop updates, multiple `watch()` effects per descendant element, and `setAttribute()` for dynamic ARIA attributes (`aria-describedby`, `aria-expanded`). Listens to the listbox's host `change` event (native-parity commit event) for selection. The `clear` method property shows the MethodProducer pattern for exposing imperative actions as reactive properties. Form participation is via ElementInternals (`formAssociated()`) with the managed form-control convention; validity relays the inner input's `validationMessage` via `host.setCustomValidity()`.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-combobox.html" /%}
{% /demo %}

#### Tag Name

`form-combobox`

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
- Current input value
---
- `length`
- `number` (readonly)
- `0`
- Length of current input value
---
- `description`
- `string`
- Text content of `.description`
- Assistive/help text shown in `.description`
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
- `first('input')`
- `HTMLInputElement`
- **required**
- Textbox for combobox input; no `name` attribute needed (the host carries it)
---
- `first('form-listbox')`
- `HTMLElement & FormListboxProps`
- **required**
- Popup listbox used for option filtering/selection
---
- `first('button.clear')`
- `HTMLButtonElement`
- optional
- Clear action button; hidden when value is empty
---
- `first('form-combobox > .error')`
- `HTMLElement`
- optional
- Validation message target linked by `aria-errormessage`
---
- `first('.description')`
- `HTMLElement`
- optional
- Description target linked by `aria-describedby`
{% /table %}
