### Basic Button

A reusable button component designed to be controlled by a parent component via `pass()`. Demonstrates initialising reactive properties by reading DOM state directly in `expose()` (`button.disabled`, `span.label` text content), and shows how optional descendant elements (`span.label`, `span.badge`) are handled gracefully: when absent, the corresponding `watch()` calls are guarded with `if (el)` and never attach.

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
