### Basic Gauge

A visual level indicator that reads its initial value from a `<meter>` element's `.value` in `expose()`, then drives a conic-gradient dial by setting a CSS custom property on the host inside a `watch('value')` handler. Demonstrates `asJSON()` to parse a `thresholds` attribute (read once at connect), a reactive thunk that finds the active threshold and updates a label plus `--basic-gauge-color`, and `pass()` to forward the value to a child `<basic-number>` component, which handles locale-aware number formatting via its `options` attribute. The `<meter>` element is kept in sync inside the same `watch`.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/basic-gauge.html" /%}
{% /demo %}

#### Tag Name

`basic-gauge`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `value`
- `number` (float)
- `0`
- Current gauge value; initialised from `<meter value="…">` at connect time
---
- `thresholds`
- `BasicGaugeThreshold[]`
- `[]`
- Threshold ranges used to derive the active label and color; see below for format
{% /table %}

`BasicGaugeThreshold[]` is an array of objects sorted from highest to lowest `min`. Each entry has `min` (number), `label` (string), and `color` (CSS color string). The first entry whose `min` is ≤ `host.value` determines the active label and color. Example: `[{"min":80,"label":"Good job!","color":"var(--color-green-70)"},{"min":50,"label":"Decent","color":"var(--color-orange-70)"},{"min":0,"label":"Try again!","color":"var(--color-pink-70)"}]`

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('meter')`
- `HTMLMeterElement`
- **required**
- Native meter element; its `value` seeds `host.value` at initialisation and stays in sync inside `watch('value')`
---
- `first('basic-number')`
- `HTMLElementTagNameMap['basic-number']`
- **required**
- `<basic-number>` child component that displays the formatted percentage; receives `host.value / 100` via `pass()` — configure display via the `options` attribute on `<basic-number>`
---
- `first('.label')`
- `HTMLElement`
- **required**
- Displays the active threshold label
{% /table %}
