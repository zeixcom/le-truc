### Module Tabgroup

A keyboard-accessible tab group. Demonstrates `createState()` with `on()` for the read-only `selected` property, separate `on()` handlers on a `Memo<HTMLButtonElement[]>` target for `click` and `keyup` with arrow-key and Home/End navigation, and a single `watch()` effect that keeps `ariaSelected`, `tabIndex`, and panel visibility in sync with the selected state.

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
