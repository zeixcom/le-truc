### Form Spinbutton

A quantity spinbutton with increment/decrement buttons, clamped values, and keyboard support. It works both controlled and uncontrolled, and participates in forms just like a native input. A fractional `step` attribute switches the whole component to floating-point mode (`value`/`min`/`max` parsed and rounded as decimals instead of integers), negative ranges are supported.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-spinbutton.html" /%}
{% /demo %}

#### Tag Name

`form-spinbutton`

#### Attributes

{% table %}
- Name
- Type
- Default
- Description
---
- `step`
- `number`
- `1` (or `input.step`, if set)
- Increment size. A fractional value (e.g. `0.5`) switches `value`/`min`/`max` to floating-point parsing; `0` or negative values fall back to `1`
---
- `big-step`
- `number`
- `step * 10`
- Increment size used when Shift is held, or `stepDown(true)`/`stepUp(true)` is called
{% /table %}

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `value`
- `number`
- Parsed from the host's `value` attribute, falling back to `input.value`, clamped to `min..max` (falls back to `min` if invalid/missing)
- Current value; settable for controlled use
---
- `min`
- `number`
- Parsed from the host's `min` attribute, falling back to `input.min` (`Number.MIN_SAFE_INTEGER`/`Number.MIN_VALUE` if neither is set)
- Minimum allowed value; may be negative
---
- `max`
- `number`
- Parsed from the host's `max` attribute, falling back to `input.max` (`Number.MAX_SAFE_INTEGER`/`Number.MAX_VALUE` if neither is set)
- Maximum allowed value
---
- `stepDown(big?)`
- `(big?: boolean) => void`
- —
- Decrements `value` by `step` (or `big-step` if `big` is `true`), clamped to `min`
---
- `stepUp(big?)`
- `(big?: boolean) => void`
- —
- Increments `value` by `step` (or `big-step` if `big` is `true`), clamped to `max`
{% /table %}

{% partial file="form-associated.md" /%}

#### Keyboard Support

Arrow Up/Down step the value by one `step` (Shift for `big-step`) regardless of which control has focus. `+`/`-` do the same, but only when a button has focus — when the input itself is focused, `+`/`-` are left to the browser's native text entry so a negative value can be typed directly (e.g. `-5`) when `min` is below `0`.

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
- `first('input')`
- `HTMLInputElement`
- **required**
- Numeric value source and sync target; no `name` attribute needed (the host carries it)
---
- `first('fieldset')`
- `HTMLFieldSetElement`
- **required**
- Wraps the increment/decrement/input controls so `host.disabled` cascades to them natively
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
