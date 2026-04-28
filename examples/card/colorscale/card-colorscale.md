### Card Colorscale

A color scale card that displays a 9-step tonal palette derived from a single base OKLCH color. Demonstrates a custom `asOklch()` parser to initialise `color` from a CSS oklch string at connect time, `watch('color', ...)` to update all CSS custom properties (`--color-base`, `--color-lighten*`, `--color-darken*`, `--color-text`, `--color-text-soft`) and the hex label in a single effect, and `bindText()` for the `name` property.

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
- `name`
- `string`
- Text content of `.label strong`
- Display name of the color
---
- `color`
- `Oklch`
- `asOklch()` — parsed from `color` attribute
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
- Displays the color name; bound to `name`
---
- `first('.label small')`
- `HTMLElement`
- **required**
- Displays the hex color value; updated on `color` change
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
