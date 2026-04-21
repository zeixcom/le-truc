### Module Todo

A coordinator component that wires together an entire todo app from reusable child components without declaring any reactive properties of its own. Demonstrates using `createElementsMemo()` inside the setup function to derive live `active` and `completed` element lists, using `pass()` to push derived state (counts, disabled flags, badge text) into multiple child Le Truc components, using `setAttribute()` to sync filter state to the list, calling child component methods (`list.add`, `textbox.clear`) directly inside an `on('submit')` handler, and composing multiple effects per element (e.g. `clearCompleted` receives both `pass()` and `on('click')`).

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
