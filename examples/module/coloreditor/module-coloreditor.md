### Module Coloreditor

A full-featured color editor composing a color scale, a text input, a color graph, and several color-info panels into one reactive unit. It's a showcase of composing multiple independent components around shared state.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-coloreditor.html" /%}
{% /demo %}

#### Tag Name

`module-coloreditor`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `value`
- `Oklch`
- `asOklch()` — parsed from `value` attribute
- The base color for the editor and color scale
---
- `label`
- `string`
- `'Blue'`
- Display name of the color; editable via the embedded textbox
---
- `nearest`
- `string` (readonly)
- Computed from `value`
- Nearest named CSS color (by CIEDE2000 difference)
---
- `lightness`
- `number` (readonly)
- Derived from `value.l`
- Lightness component (0–1)
---
- `chroma`
- `number` (readonly)
- Derived from `value.c`
- Chroma component (0–0.4)
---
- `hue`
- `number` (readonly)
- Derived from `value.h`
- Hue angle in degrees (0–360)
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('form-textbox')`
- `form-textbox`
- optional
- Color name editor; receives `value` and `description` via `pass()`
---
- `first('form-colorgraph')`
- `form-colorgraph`
- optional
- Color picker graph; receives `value` via `pass()`
---
- `first('card-colorscale')`
- `card-colorscale`
- optional
- Color scale preview; receives `value` and `label` via `pass()`
---
- `first('module-colorinfo.base')`
- `module-colorinfo`
- optional
- Info panel for the base color (500 step); receives `value` and `label` via `pass()`
---
- `first('module-colorinfo.lighten80')` … `.lighten20`
- `module-colorinfo`
- optional
- Info panels for lightened steps (100–400); value and label computed reactively
---
- `first('module-colorinfo.darken20')` … `.darken80`
- `module-colorinfo`
- optional
- Info panels for darkened steps (600–900); value and label computed reactively
{% /table %}
