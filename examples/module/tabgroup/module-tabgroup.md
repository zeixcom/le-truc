### Module Tabgroup

An accessible tab group with full keyboard navigation. It demonstrates managing selection state internally while keeping it read-only for outside consumers.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-tabgroup.html" /%}
{% /demo %}

#### Tag Name

`module-tabgroup`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `selected`
- `string` (readonly)
- `''`
- Id of the selected tab panel (`aria-controls` of active tab)
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `all('button[role="tab"]')`
- `Memo<HTMLButtonElement[]>`
- **required**
- Tab buttons with unique `aria-controls` references
---
- `all('[role="tabpanel"]')`
- `Memo<HTMLElement[]>`
- **required**
- Tab panels with unique ids controlled by selected tab
{% /table %}
