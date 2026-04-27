### Module Todo

A self-contained todo component that owns the data, manages the list DOM directly, and handles all interactions — adding, deleting, reordering (keyboard and drag), editing labels, and toggling completion — without a separate list component boundary. Demonstrates using `createList()` to manage keyed data, inlining DOM reconciliation and reorder logic into the factory, using `pass()` to push derived state (counts, disabled flags, badge text) into child Le Truc components, calling child component methods (`list.add`, `textbox.clear`) directly inside an `on('submit')` handler, and composing multiple effects per element (e.g. `clearCompleted` receives both `pass()` and `on('click')`).

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
- `Component<FormTextboxProps>`
- **required**
- Input component for new todo text
---
- `first('basic-button.submit')`
- `Component<BasicButtonProps>`
- **required**
- Submit button; disabled when textbox is empty
---
- `first('[data-container]')`
- `HTMLElement`
- **required**
- Container where cloned list items are inserted
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
- `first('basic-pluralize')`
- `Component<BasicPluralizeProps>`
- **required**
- Remaining active-item counter
---
- `first('form-radiogroup')`
- `Component<FormRadiogroupProps>`
- **required**
- Filter selector (`all`, `active`, `completed`)
---
- `first('basic-button.clear-completed')`
- `Component<BasicButtonProps>`
- **required**
- Clears completed items; badge shows completed count
{% /table %}
