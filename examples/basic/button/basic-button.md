### Basic Button

A reusable button component controlled entirely by a parent through reactive properties, rather than direct DOM manipulation. It shows how to initialize state from existing DOM content and how optional descendant elements — a label, a badge — can be wired up only when present.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/basic-button.html" /%}
{% /demo %}

#### Tag Name

`basic-button`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `badge`
- `string`
- `''`
- Badge text
---
- `disabled`
- `boolean`
- `false`
- Whether the button is disabled
---
- `label`
- `string`
- Text content of `span.label` or `button`
- Accessible name of button
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
- Native `button` element
---
- `first('span.badge')`
- `HTMLSpanElement`
- optional
- Setting `badge` property has no effect if the element is missing
---
- `first('span.label')`
- `HTMLSpanElement`
- optional
- Setting `label` property has no effect if the element is missing
{% /table %}

#### Classes

Use `class` attribute on `button` to get a different style for the button.

{% table %}
- Class
- Description
---
- `primary`
- For a primary action
---
- (`secondary`)
- For a secondary action (default - no class looks like that)
---
- `tertiary`
- For a tertiary action
---
- `constructive`
- For a constructive action
---
- `destructive`
- For a destructive action
---
- `small`
- For a small button
---
- `large`
- For a large button
{% /table %}
