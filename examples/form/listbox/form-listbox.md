### Form Listbox

A full-featured listbox with client-side filtering and optional remote option loading. Demonstrates `createElementsMemo()` used directly as a property initializer to create a reactive live collection of visible options, `createTask()` for async JSON fetching with abort support, `schedule()` to render fetched HTML via `innerHTML`, and `each(options, ...)` with per-option `watch()` calls to update visibility and selected state without triggering a full list re-render. The `options` reactive property is a `Memo<HTMLButtonElement[]>` that tracks only currently visible (non-hidden) options, making it safe to use in parent components like `form-combobox`. Form participation is via ElementInternals (`formAssociated: true`) with the managed form-control convention — form value sync, reset, and state restore are library-managed, so no ElementInternals code and no hidden `<input>` needed.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-listbox.html" /%}
{% /demo %}

#### Tag Name

`form-listbox`

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
- Selected option value (`button[role="option"][aria-selected="true"]`)
---
- `options`
- `HTMLButtonElement[]`
- Visible `button[role="option"]` elements
- Live collection of selectable options
---
- `filter`
- `string`
- `''`
- Filter text used to hide/show options
---
- `src`
- `string`
- `''`
- URL for loading options JSON (flat or grouped)
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('[role="listbox"]')`
- `HTMLElement`
- **required**
- Container for option buttons
---
- `first('input.filter')`
- `HTMLInputElement`
- optional
- Text input for client-side filtering
---
- `first('button.clear')`
- `HTMLButtonElement`
- optional
- Clears current filter text
---
- `first('card-callout')`
- `HTMLElement`
- optional
- Callout container for loading/error states when `src` is used
---
- `first('.loading')`
- `HTMLElement`
- optional
- Loading state element
---
- `first('.error')`
- `HTMLElement`
- optional
- Error message element
---
- `all('button[role="option"]')`
- `Memo<HTMLButtonElement[]>`
- optional
- Option buttons (inline and/or rendered from `src`)
{% /table %}
