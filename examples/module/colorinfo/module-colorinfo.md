### Module Colorinfo

An expandable color swatch with OKLCH, hex, RGB, and HSL details. Demonstrates multiple readonly computed properties derived from a single `color` reactive, `bindStyle()` for CSS custom properties (`--color-swatch`, `--color-fallback`), `pass()` on `basic-number` elements to push individual channel values, and `bindText()` for the name and hex label.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-colorinfo.html" /%}
{% /demo %}

#### Tag Name

`module-colorinfo`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `name`
- `string`
- Text content of `.label strong`
- Display name of the color
---
- `color`
- `Oklch`
- `asOklch()` — parsed from `color` attribute
- The color to display
---
- `css`
- `string` (readonly)
- Derived from `color`
- CSS `oklch(…)` string
---
- `hex`
- `string` (readonly)
- Derived from `color`
- Hex color string (e.g. `#7a6ab2`)
---
- `rgb`
- `string` (readonly)
- Derived from `color`
- CSS `rgb(…)` string
---
- `hsl`
- `string` (readonly)
- Derived from `color`
- CSS `hsl(…)` string
---
- `lightness`
- `number` (readonly)
- Derived from `color.l`
- Lightness component (0–1)
---
- `chroma`
- `number` (readonly)
- Derived from `color.c`
- Chroma component
---
- `hue`
- `number` (readonly)
- Derived from `color.h`
- Hue angle in degrees
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('.label strong')`
- `HTMLElement`
- **required**
- Displays the color name; bound to `name`
---
- `first('.hex')`
- `HTMLElement`
- optional
- Displays the hex value; bound to `hex`
---
- `first('.rgb')`
- `HTMLElement`
- optional
- Displays the RGB value; bound to `rgb`
---
- `first('.hsl')`
- `HTMLElement`
- optional
- Displays the HSL value; bound to `hsl`
---
- `all('basic-number.lightness')`
- `basic-number[]`
- optional
- Numeric lightness display(s); receive `value` via `pass()`
---
- `all('basic-number.chroma')`
- `basic-number[]`
- optional
- Numeric chroma display(s); receive `value` via `pass()`
---
- `all('basic-number.hue')`
- `basic-number[]`
- optional
- Numeric hue display(s); receive `value` via `pass()`
{% /table %}
