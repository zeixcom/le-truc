### Basic Button

A reusable button component controlled entirely by a parent through reactive properties, rather than direct DOM manipulation. It shows how to initialize state from existing DOM content and how optional descendant elements — a label, a badge — can be wired up only when present.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/basic-button.html" /%}
{% /demo %}

#### Tag Name

`basic-button`

#### Server Args

Values a composing parent passes at the compose site (`<BasicButton … />`). Each modifier arg is a closed literal union whose default carries no styles of its own — the inner button's `class` is the non-default tokens only, so all defaults render no class at all. Page-authored markup keeps styling its button through the `class` attribute instead (see Classes).

{% table %}
- Name
- Type
- Default
- Description
---
- `children`
- content
- –
- Static rich label content (an icon plus text), rendered by `span.label` in place of the `label` text. Non-interactive: the compiler refuses interactive content at the compose site. Writing the `label` property at runtime replaces rich children with that text
---
- `variant`
- `'primary' | 'secondary' | 'tertiary'`
- `'secondary'`
- The weight: which hierarchy level the action sits at
---
- `kind`
- `'constructive' | 'normal' | 'destructive'`
- `'normal'`
- The color family: what the action does to the user's data
---
- `size`
- `'small' | 'medium' | 'large'`
- `'medium'`
- The button's size
---
- `type`
- `'button' \| 'submit'`
- `'button'`
- The native button's `type`
---
- `ariaLabel`
- `string`
- –
- Accessible name, for a button whose label is a symbol
---
- `onClick`
- `(e: MouseEvent) => void`
- –
- Click handler, bound by the composing parent on the native button (a handler arg, LT-461 — never rendered or serialized)
{% /table %}

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
- Visible label text; may be passed as a static arg instead. Writing it at runtime replaces rich `children` content with that text
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
