### Basic Gauge

A visual gauge meter that renders a value against configurable, colored threshold ranges. It shows how a single attribute can drive both a displayed value and its derived visual styling.

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
- Current gauge value; read from the `value` attribute (falling back to `<meter value="…">`) at connect time, and re-parsed on later `value` attribute mutations via `observedAttributes()`
{% /table %}

#### Attributes

{% table %}
- Name
- Description
---
- `thresholds`
- Color-coded threshold ranges as a JSON array; read once at connect time. See below for format.
{% /table %}

`thresholds` is a `BasicGaugeThreshold[]`: an array of objects sorted from highest to lowest `min`. Each entry has `min` (number), `label` (string), and `color` (CSS color string). The first entry whose `min` is ≤ `host.value` determines the active label and color. Example: `[{"min":80,"label":"Good job!","color":"var(--color-green-70)"},{"min":50,"label":"Decent","color":"var(--color-orange-70)"},{"min":0,"label":"Try again!","color":"var(--color-pink-70)"}]`

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
