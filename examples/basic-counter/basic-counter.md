### Basic Counter

A counter component with a button to increment the count and a span to display the current count.

#### Preview

{% demo %}
{{content}}

{% sources title="Source code" src="../sources/basic-counter.html" /%}
{% /demo %}

#### Tag Name

`basic-counter`

#### Reactive Properties

- `count`: Integer `number` indicating the current count.

#### Descendant Elements

- `increment`: `button`, required. `HTMLButtonElement` to increment the count.
- `count`: `span`, required. `HTMLSpanElement` to display the current count.
