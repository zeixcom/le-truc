### Module Tabgroup

A tabgroup component with click/keyboard tab selection and automatic panel visibility management.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-tabgroup.html" /%}
{% /demo %}

#### Tag Name

`module-tabgroup`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `selected`
* `string` (readonly)
* `''`
* Id of the selected tab panel (`aria-controls` of active tab)
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `all('button[role="tab"]')`
* `Memo<HTMLButtonElement[]>`
* **required**
* Tab buttons with unique `aria-controls` references
---
* `all('[role="tabpanel"]')`
* `Memo<HTMLElement[]>`
* **required**
* Tab panels with unique ids controlled by selected tab
{% /table %}
