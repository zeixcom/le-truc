### Module Todo

A todo app coordinator that wires form input, list management, filtering, counts, and clear-completed actions across child components.

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
* Selector
* Type
* Required
* Description
---
* `first('form')`
* `HTMLFormElement`
* **required**
* Submission entry point for adding todos
---
* `first('form-textbox')`
* `Component<FormTextboxProps>`
* **required**
* Input component for new todo text
---
* `first('basic-button.submit')`
* `Component<BasicButtonProps>`
* **required**
* Submit button; disabled when textbox is empty
---
* `first('module-list')`
* `Component<ModuleListProps>`
* **required**
* Todo list container and add/delete functionality
---
* `first('basic-pluralize')`
* `Component<BasicPluralizeProps>`
* **required**
* Remaining active-item counter
---
* `first('form-radiogroup')`
* `Component<FormRadiogroupProps>`
* **required**
* Filter selector (`all`, `active`, `completed`)
---
* `first('basic-button.clear-completed')`
* `Component<BasicButtonProps>`
* **required**
* Clears completed items; badge shows completed count
{% /table %}
