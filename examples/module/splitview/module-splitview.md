### Module Splitview

A two-panel resizable container with a drag handle between the panels, supporting both horizontal and vertical orientations.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-splitview.html" /%}
{% /demo %}

#### Tag Name

`module-splitview`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `split`
- `number`
- `0.5`
- Proportional position of the divider (0.1–0.9)
{% /table %}

#### Attributes

{% table %}
- Name
- Description
---
- `split`
- Initial divider position as a decimal fraction (e.g. `0.3` for 30/70); default `0.5`
---
- `orientation`
- Layout axis. Use `vertical` for top/bottom split; defaults to horizontal
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('button.divider')`
- `HTMLButtonElement`
- **required**
- The resize handle; carries `role="separator"` and `aria-valuenow/min/max`
---
- `module-scrollarea` (×2)
- `HTMLElement`
- **required**
- The two resizable content areas; sized by the CSS grid via `--module-splitview-ratio`. Use a `module-scrollarea` for each panel so overflowing content stays keyboard-accessible.
{% /table %}
