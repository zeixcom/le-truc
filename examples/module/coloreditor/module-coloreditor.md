### Module Coloreditor

A full-featured color editor that composes `card-colorscale`, `form-textbox`, `form-colorgraph`, and nine `module-colorinfo` elements into a single reactive unit. Demonstrates `pass()` to wire sibling Le Truc components — including passing computed values like `() => \`${host.name} 500\`` — and `on(host, 'change', ...)` returning `{ name: value }` to update the name from the embedded textbox without manual event forwarding.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-coloreditor.html" /%}
{% /demo %}

#### Tag Name

`module-coloreditor`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `color`
* `Oklch`
* `asOklch()` — parsed from `color` attribute
* The base color for the editor and color scale
---
* `name`
* `string`
* `'Blue'`
* Display name of the color; editable via the embedded textbox
---
* `nearest`
* `string` (readonly)
* Computed from `color`
* Nearest named CSS color (by CIEDE2000 difference)
---
* `lightness`
* `number` (readonly)
* Derived from `color.l`
* Lightness component (0–1)
---
* `chroma`
* `number` (readonly)
* Derived from `color.c`
* Chroma component (0–0.4)
---
* `hue`
* `number` (readonly)
* Derived from `color.h`
* Hue angle in degrees (0–360)
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `first('form-textbox')`
* `form-textbox`
* optional
* Color name editor; receives `value` and `description` via `pass()`
---
* `first('form-colorgraph')`
* `form-colorgraph`
* optional
* Color picker graph; receives `color` via `pass()`
---
* `first('card-colorscale')`
* `card-colorscale`
* optional
* Color scale preview; receives `color` and `name` via `pass()`
---
* `first('module-colorinfo.base')`
* `module-colorinfo`
* optional
* Info panel for the base color (500 step); receives `color` and `name` via `pass()`
---
* `first('module-colorinfo.lighten80')` … `.lighten20`
* `module-colorinfo`
* optional
* Info panels for lightened steps (100–400); color and name computed reactively
---
* `first('module-colorinfo.darken20')` … `.darken80`
* `module-colorinfo`
* optional
* Info panels for darkened steps (600–900); color and name computed reactively
{% /table %}
