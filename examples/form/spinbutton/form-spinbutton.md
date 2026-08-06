### Form Spinbutton

A quantity spinbutton with increment/decrement buttons, clamped values, and keyboard support. It works both controlled and uncontrolled, and participates in forms just like a native input.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-spinbutton.html" /%}
{% /demo %}

#### Tag Name

`form-spinbutton`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `value`
- `number` (integer)
- Parsed from `input.value` (`0` if invalid/missing)
- Current clamped value in range `min..max`; settable for controlled use
---
- `min`
- `number` (integer)
- `0`
- Minimum allowed value (read from `input.min`)
---
- `max`
- `number` (integer)
- `10`
- Maximum allowed value (read from `input.max`)
---
- `stepDown(step?)`
- `(step?: number) => void`
- —
- Decrements `value` by `step` (default `1`), clamped to `min`
---
- `stepUp(step?)`
- `(step?: number) => void`
- —
- Increments `value` by `step` (default `1`), clamped to `max`
{% /table %}

{% partial file="form-associated.md" /%}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('button.increment')`
- `HTMLButtonElement`
- **required**
- Increments `value` and becomes disabled at `max`
---
- `first('button.decrement')`
- `HTMLButtonElement`
- **required**
- Decrements `value`; disabled at `min`
---
- `first('input.value')`
- `HTMLInputElement`
- **required**
- Numeric value source and sync target; no `name` attribute needed (the host carries it)
---
- `first('fieldset')`
- `HTMLFieldSetElement`
- **required**
- Wraps the increment/decrement/input controls so `host.disabled` cascades to them natively
---
- `all('button, input:not([disabled])')`
- `Memo<(HTMLButtonElement | HTMLInputElement)[]>`
- **required**
- Interactive controls tracked for event-based updates
---
- `first('.zero')`
- `HTMLElement`
- optional
- Opts into zero-state UI: shown when `value === 0`, hides `input`/`decrement` and swaps the increment label; omit for a plain generic spinbutton
---
- `first('.other')`
- `HTMLElement`
- optional
- Shown when `value !== 0`; only wired up if `.zero` is also present
---
- `first('.error')`
- `HTMLElement`
- optional
- Shows `host.validationMessage` — the range constraint or an externally-set `customError`
{% /table %}
