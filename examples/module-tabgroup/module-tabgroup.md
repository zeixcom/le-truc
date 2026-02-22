### Module Tabgroup

A keyboard-accessible tab group that derives the selected tab from event delegation using `createEventsSensor()`. Demonstrates using `read()` to initialise a sensor's value by inspecting `aria-selected` across a `Memo<HTMLButtonElement[]>` target, handling multiple event types (`click`, `keyup`) in one sensor with arrow-key and Home/End navigation, applying `setProperty()` on `Memo` targets to keep `ariaSelected` and `tabIndex` in sync with the selected state, and using `show()` on a second `Memo` target to reveal only the matching panel.

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
