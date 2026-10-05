### Module Todo

A complete todo list application — add, delete, reorder by keyboard or drag, inline-edit labels, and toggle completion. It's the most complete reference example of a real Le Truc application, combining most of the library's patterns in one component: a reactive list whose items are Mount Scopes ([ADR 0046](../../adr/0046-reactive-list-items-as-mount-scopes.md)), per-item `truc:pass` `{ get, set }` into a raw `form-checkbox` and the composed `FormInplaceEdit`, key-derived `id`/`for`, a reactive `disabled` from the list length, and removal through the item key. Drag-and-drop, keyboard reordering, and the live region live in one shared client-only helper (`examples/_common/reorder.ts`) called from both compiled surfaces' setup.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-todo.html" /%}
{% /demo %}

#### Tag Name

`module-todo`

#### Reactive Properties

None. This component orchestrates behavior by passing state and events between descendants, and sets custom states (matched in CSS via `:state()`) based on the active filter.

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('form')`
- `HTMLFormElement`
- **required**
- Submission entry point for adding todos
---
- `first('form-textbox')`
- `HTMLElement & FormTextboxProps`
- **required**
- Input component for new todo text; `clear()` is called after each add
---
- `first('basic-button.submit')`
- `HTMLElement & BasicButtonProps`
- **required**
- Submit button; disabled when textbox is empty via `truc:pass`
---
- `first('[data-container]')`
- `HTMLElement`
- **required**
- Container element for todo item children; items are inserted, reordered, and removed through reconciliation against the list keys
---
- `first('[role="status"]')`
- `HTMLElement`
- **required**
- Live region for screen reader reorder announcements, written by the shared reorder helper
---
- `first('basic-pluralize')`
- `HTMLElement & BasicPluralizeProps`
- **required**
- Remaining active-item counter; `count` arrives via `truc:pass`
---
- `first('form-radiogroup')`
- `HTMLElement & FormRadiogroupProps`
- **required**
- Filter selector (`all`, `active`, `completed`)
---
- `first('basic-button.clear-completed')`
- `HTMLElement & BasicButtonProps`
- **required**
- Clears completed items; `disabled` and `badge` arrive via `truc:pass`
{% /table %}

Inside each list item, the reorder handle (`button.reorder`) carries the drag and keyboard interaction of the shared helper and is disabled reactively when only one item remains; the per-item checkbox and inline editor receive their store fields through mediated `truc:pass` `{ get, set }` descriptors; the remove button's own listener removes through the item key (`items.remove(k)`).
