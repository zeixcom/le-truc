### Form Checkbox

A wrapper for a native checkbox that initialises `checked` via `asBoolean()`, reading `<form-checkbox>`'s own `checked` attribute (not the inner native input's), and `label` from `.label`/`label` text content, uses `on('change')` returning `{ checked }` to sync host state with the native input. Styling hooks off the checked state use `:has(input:checked)` on the host, not a `[checked]` attribute selector or a `:state()` custom state — native `:checked` only applies to the descendant `<input>` directly, and reading it via `:has()` needs no JS reflection at all, while keeping the `checked` *attribute* free to mean only the reset default (native `defaultChecked` semantics). Form participation is via ElementInternals (`formAssociatedCheckbox()`) — submits nothing when unchecked, matching native `<input type="checkbox">`; set `name` and `value` on the host too (the inner input's own `name`/`value`, if any, are inert) — `value` overrides what's submitted instead of the native default `"on"`. Reset and disabled inheritance (propagated to the native checkbox) are library-managed. The `.toggle` variant adds `role="switch"` to the native checkbox — explicitly permitted on `<input type="checkbox">` per ARIA, with `aria-checked` state derived automatically from the input's own `checked` property.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-checkbox.html" /%}
{% /demo %}

#### Tag Name

`form-checkbox`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `checked`
- `boolean`
- `false`
- Whether the checkbox is checked; read from `<form-checkbox>`'s own `checked` attribute at connect time, restored to that default on `<form>.reset()`
---
- `label`
- `string`
- Text content of `.label` or `label`
- Label text shown next to the checkbox
{% /table %}

#### Classes

Use `class` attribute to get a different style for the checkbox.

{% table %}
- Class
- Description
---
- none
- Default browser style
---
- `checkbox`
- For a styled checkbox
---
- `todo`
- For an action item that can be active or completed
---
- `toggle`
- For a toggle on/off switch setting
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('input[type="checkbox"]')`
- `HTMLInputElement`
- **required**
- Native checkbox element
---
- `first('.label')`
- `HTMLElement`
- optional
- Text target for `label` property
{% /table %}
