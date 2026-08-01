### Basic Counter

Le Truc's canonical introductory example: a button that increments a counter and a display that stays in sync. It demonstrates the core reactive loop — read the initial value from the DOM, update it on user interaction, and bind it back to the display.

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
