### Basic Hello

The Hello World example from the Quick Start guide.

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
