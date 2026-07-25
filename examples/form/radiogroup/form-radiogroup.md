### Form Radiogroup

A roving-tabindex radio group that works both **controlled** and **uncontrolled**. Demonstrates initialising `value` from the currently checked radio in `expose()`, and `on('change', ...)` applied to the `radios` Memo so that user interaction propagates back to `host.value`. An `each(radios, ...)` block drives `checked`, `tabIndex`, the `selected` label class, and the managed `disabled` property (via `bindProperty(radio, 'disabled')`) from `host.value`/`host.disabled` via `watch()`, which means assigning `host.value = 'option'` programmatically is enough to move the selection — no event needed. Form participation is via ElementInternals (`formAssociated()`) with the managed form-control convention — set `name` on the host, not the individual radios, which are presentational only (their exclusivity is driven entirely by the `each()` watch, not native `name` grouping). Form reset and `<fieldset disabled>` inheritance are library-managed.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-radiogroup.html" /%}
{% /demo %}

#### Tag Name

`form-radiogroup`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `value`
- `string`
- `''`
- Value of the currently checked radio input; settable for controlled use
{% /table %}

#### Classes

Use `class` attribute to get a different style for the radio group.

{% table %}
- Class
- Description
---
- none
- Default browser style
---
- `radio-group`
- For a styled radio group
---
- `split-button`
- For a split button display
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `all('input[type="radio"]')`
- `Memo<HTMLInputElement[]>`
- **required**
- Native radio inputs (at least two)
---
- `all('label')`
- `Memo<HTMLLabelElement[]>`
- **required**
- Labels wrapping radio inputs; toggles `selected` class
{% /table %}
