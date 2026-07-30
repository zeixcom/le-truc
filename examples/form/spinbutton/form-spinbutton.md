### Form Spinbutton

A quantity spinbutton with increment/decrement buttons, clamped values, and keyboard support that works both controlled and uncontrolled.

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
- Current clamped value in range `0..max`; settable for controlled use
---
- `max`
- `number` (integer)
- `10`
- Maximum allowed value (read from `input.max`)
{% /table %}

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
- Decrements `value` until `0`
---
- `first('input.value')`
- `HTMLInputElement`
- **required**
- Numeric value source and sync target; no `name` attribute needed (the host carries it)
---
- `all('button, input:not([disabled])')`
- `Memo<(HTMLButtonElement | HTMLInputElement)[]>`
- **required**
- Interactive controls tracked for event-based updates
---
- `first('.zero')`
- `HTMLElement`
- optional
- Shown when `value === 0`
---
- `first('.other')`
- `HTMLElement`
- optional
- Shown when `value !== 0`
{% /table %}
