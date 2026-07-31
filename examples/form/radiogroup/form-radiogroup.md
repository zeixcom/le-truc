### Form Radiogroup

A roving-tabindex radio group that works both controlled and uncontrolled.

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
