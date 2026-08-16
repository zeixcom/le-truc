### Form Tokenbox

A tokenized text input where typed text becomes a removable pill on `,`, `Enter`, or blur, gated by the native input's own constraint validation — including a `type="email"` variant where each token must pass native email validity. It demonstrates driving a reactive list (`MutableList`) from a single text field while keeping form participation via `ElementInternals`.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-tokenbox.html" /%}
{% /demo %}

#### Tag Name

`form-tokenbox`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `value`
- `string`
- `''`
- Committed tokens, joined by `", "`. Setting it re-splits on `,` and rebuilds the pills.
---
- `description`
- `string`
- Text content of `.description`
- Helper text shown below the input
{% /table %}

{% partial file="form-associated.md" /%}

#### Methods

{% table %}
- Name
- Type
- Description
---
- `clear`
- `() => void`
- Removes all tokens and clears the input, then dispatches `input` and `change` events
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
- Textbox for typing new tokens; no `name` attribute needed (the host carries it)
---
- `first('[data-container]')`
- `HTMLElement`
- **required**
- Container holding the token pills and the input
---
- `first('template')`
- `HTMLTemplateElement`
- **required**
- Template used to render each token pill, reconciled against the token list
---
- `first('.error')`
- `HTMLElement`
- optional
- Validation message target linked by `aria-errormessage`
---
- `first('.description')`
- `HTMLElement`
- optional
- Description target linked by `aria-describedby`
---
- `first('.status')`
- `HTMLElement`
- optional
- Live region announcing added/removed tokens
{% /table %}
