### Basic Hello

The Hello World example from the Quick Start guide. Shows the minimal Le Truc factory pattern: initialising `name` by reading the `output` element's text content directly in `expose()`, `on('input')` returning `{ name }` to update the host as the user types, and `watch('name', bindText(output))` to keep the greeting in sync.

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
- `name`
- `string`
- `''`
- Name of the person to greet
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
- Text field to enter the name
---
- `first('output')`
- `HTMLOutputElement`
- **required**
- Display the name
{% /table %}
