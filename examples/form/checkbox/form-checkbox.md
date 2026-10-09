### Form Checkbox

A styled, form-associated wrapper around a native checkbox, with todo-item and toggle-switch variants. It shows how to layer custom styling and full form participation on top of native checkbox behavior.

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
- Text content of `.label`
- Visible label text of the checkbox. Optional: a composed parent passes rich static content as `children` instead, which `.label` renders in place of this text. Writing `label` at runtime replaces that rich content with text
{% /table %}

A composed parent passes the visible label as children (`<FormCheckbox>Done</FormCheckbox>`); the children must be non-interactive — the compiler refuses interactive content at the compose site. Page-authored markup labels the checkbox directly, with a `<label>` wrapping or pointing at the native input.

{% partial file="form-associated.md" /%}

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
