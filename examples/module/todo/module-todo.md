### Module Todo

A todo component that owns the data, manages the list DOM directly, and handles all interactions — adding, deleting, reordering (keyboard and drag), editing labels, and toggling completion. Demonstrates using `createList()` to manage keyed data, inlining DOM reconciliation and reorder logic into the factory, using `pass()` to push derived state (counts, disabled flags, badge text) into child Le Truc components, calling child component methods (`list.add`, `textbox.clear`) directly inside an `on('submit')` handler, and composing multiple effects per element (e.g. `clearCompleted` receives both `pass()` and `on('click')`).

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-todo.html" /%}
{% /demo %}

#### Tag Name

`module-todo`

#### Reactive Properties

None. This component orchestrates behavior by passing state and events between descendants.

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
