### Card Colorscale

A color scale card that displays a 9-step tonal palette derived from a single base color, provided as any valid CSS color string.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/card-colorscale.html" /%}
{% /demo %}

#### Tag Name

`card-colorscale`

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
- Base color; drives all CSS custom properties and the hex label
{% /table %}

#### Classes

{% table %}
- Class
- Description
---
- `tiny`
- Smallest swatch size
---
- `small`
- Small swatch size
---
- `medium`
- Medium swatch size
---
- `large`
- Largest swatch size
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
- `first('.label small')`
- `HTMLElement`
- **required**
- Displays the hex color value; updated on `value` change
---
- `li.lighten80` … `li.lighten20`
- `HTMLLIElement`
- optional
- Lightened tonal steps; background set via `--color-lighten*`
---
- `li.base`
- `HTMLLIElement`
- optional
- Base color step; background set via `--color-base`
---
- `li.darken20` … `li.darken80`
- `HTMLLIElement`
- optional
- Darkened tonal steps; background set via `--color-darken*`
{% /table %}
