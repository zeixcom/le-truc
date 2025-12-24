### Basic Hello

A Hello World component with an input field to enter the name and a greeting message.

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
