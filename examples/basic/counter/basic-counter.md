### Basic Counter

The canonical introductory example for Le Truc. Demonstrates initialising the reactive `count` property by reading `span` text content directly in `expose()`, `on('click')` returning `{ count }` to update the host, and `watch('count', bindText(span))` to keep the display in sync — the standard factory-form pattern for a property derived from existing DOM content.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/basic-counter.html" /%}
{% /demo %}

#### Tag Name

`basic-counter`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `count`
- `number` (integer)
- `0`
- Current count
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('button')`
- `HTMLButtonElement`
- **required**
- Increments the count
---
- `first('span')`
- `HTMLSpanElement`
- **required**
- Displays the current count
{% /table %}
