### Basic Hello

The Hello World example from the Quick Start guide. Shows the minimal Le Truc pattern: `asString()` with a reader fallback that reads the initial value from the `output` element, `on('input')` to update `host.name` as the user types, and `setText()` to keep the greeting in sync. Also demonstrates how the setup function can reference a queried UI element (`input`) directly alongside `host`.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="./sources/basic-hello.html" /%}
{% /demo %}

#### Tag Name

`basic-hello`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `name`
* `string`
* `''`
* Name of the person to greet
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `first('input')`
* `HTMLInputElement`
* **required**
* Text field to enter the name
---
* `first('output')`
* `HTMLOutputElement`
* **required**
* Display the name
{% /table %}
