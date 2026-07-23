### Form Checkbox

A wrapper for a native checkbox that initialises `checked` and `label` by reading DOM state directly in `expose()` (`checkbox.checked`, `.label`/`label` text content), uses `on('change')` returning `{ checked }` to sync host state with the native input, and reflects `checked` back as a host attribute via `toggleAttribute()` inside `watch('checked')` for CSS styling.

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
- Whether the native checkbox is checked
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
