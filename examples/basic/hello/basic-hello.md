### Basic Hello

The Hello World example from the Quick Start guide. Shows the minimal Le Truc factory pattern: initialising `subject` by reading the `output` element's text content directly in `expose()`, `on('input')` returning `{ subject }` to update the host as the user types, and `watch('subject', bindText(output))` to keep the greeting in sync.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="./sources/basic-hello.html" /%}
{% /demo %}

#### Tag Name

`basic-hello`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `subject`
- `string`
- `''`
- Name of the subject to greet
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('input')`
- `HTMLInputElement`
- **required**
- Text field to enter the subject
---
- `first('output')`
- `HTMLOutputElement`
- **required**
- Display the subject
{% /table %}
