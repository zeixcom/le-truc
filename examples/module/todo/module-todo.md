### Module Todo

A todo component that owns the data, manages the list DOM directly, and handles all interactions — adding, deleting, reordering (keyboard and drag), editing labels, and toggling completion. Exposes the active filter as custom states (`:state(filter-active)`, `:state(filter-completed)`) for CSS-based item visibility.

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
- `Memo<HTMLButtonElement[]>`
- **required**
- Drag handle and keyboard reorder buttons; disabled via `each()` + `pass()` when only one item remains
---
- `all('form-checkbox')`
- `Memo<(HTMLElement & FormCheckboxProps)[]>`
- **required**
- Per-item checkbox components; each receives its item's `completed` state signal directly via `pass()`
---
- all('form-inplace-edit')
- Memo&lt;HTMLElement[]&gt;
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
