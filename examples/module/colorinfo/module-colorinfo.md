### Module Colorinfo

An expandable color swatch showing the OKLCH, hex, RGB, and HSL representations of a color. It's designed to be driven by a parent component, such as `module-coloreditor`.

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
- `label`
- `string`
- Text content of `.label strong`
- Display name of the color
---
- `value`
- `Oklch`
- `asOklch()` — parsed from `value` attribute
- The color to display
---
- `css`
- `string` (readonly)
- Derived from `value`
- CSS `oklch(…)` string
---
- `hex`
- `string` (readonly)
- Derived from `value`
- Hex color string (e.g. `#7a6ab2`)
---
- `rgb`
- `string` (readonly)
- Derived from `value`
- CSS `rgb(…)` string
---
- `hsl`
- `string` (readonly)
- Derived from `value`
- CSS `hsl(…)` string
---
- `lightness`
- `number` (readonly)
- Derived from `value.l`
- Lightness component (0–1)
---
- `chroma`
- `number` (readonly)
- Derived from `value.c`
- Chroma component
---
- `hue`
- `number` (readonly)
- Derived from `value.h`
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
- Displays the color name; bound to `label`
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
