### Form Radiogroup

A roving-tabindex radio group that works both controlled and uncontrolled. It demonstrates full keyboard navigation and native-like form participation without relying on native radio inputs.

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

{% partial file="form-associated.md" /%}

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
- `all('label')`
- `Signal<HTMLLabelElement[]>`
- **required**
- One label per option, each carrying the option's value in `data-value` (the compiled item addressing) and wrapping its radio input; toggles the `selected` class
---
- `label input[type="radio"]`
- `HTMLInputElement`
- **required**
- Native radio inputs (one per option, presentational only — no `name`); the compiled client writes their `checked`, `tabindex`, and `disabled` properties
{% /table %}
