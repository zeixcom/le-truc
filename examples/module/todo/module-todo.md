### Module Todo

A complete todo list application — add, delete, reorder by keyboard or drag, inline-edit labels, and toggle completion. It's the most complete reference example of a real Le Truc application, combining most of the library's patterns in one component.

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
- Input component for new todo text
---
- `first('basic-button.submit')`
- `HTMLElement & BasicButtonProps`
- **required**
- Submit button; disabled when textbox is empty
---
- `first('[data-container]')`
- `HTMLElement`
- **required**
- Container element for todo item children; items are inserted, reordered, and removed here
---
- `first('template')`
- `HTMLTemplateElement`
- **required**
- Template cloned for each todo item; root element receives `data-key`
---
- `first('[role="status"]')`
- `HTMLElement`
- **required**
- Live region for screen reader reorder announcements
---
- `all('button.reorder')`
- `Cell<HTMLButtonElement[]>`
- **required**
- Drag handle and keyboard reorder buttons; disabled via `each()` + `pass()` when only one item remains
---
- `all('form-checkbox')`
- `Cell<(HTMLElement & FormCheckboxProps)[]>`
- **required**
- Per-item checkbox components; each receives its item's `completed` state signal directly via `pass()`
---
- all('form-inplace-edit')
- `Cell<HTMLElement[]>`
- **required**
- Per-item inline editors; each receives its item's `label` state signal directly via `pass()`
---
- `first('basic-pluralize')`
- `HTMLElement & BasicPluralizeProps`
- **required**
- Remaining active-item counter
---
- `first('form-radiogroup')`
- `HTMLElement & FormRadiogroupProps`
- **required**
- Filter selector (`all`, `active`, `completed`)
---
- `first('basic-button.clear-completed')`
- `HTMLElement & BasicButtonProps`
- **required**
- Clears completed items; badge shows completed count
{% /table %}
