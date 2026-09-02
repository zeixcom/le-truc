### Form Listbox

A full-featured listbox with client-side filtering, optional remote option loading, and keyboard navigation. It demonstrates form participation and per-option reactive state within a single component.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/form-listbox.html" /%}
{% /demo %}

#### Tag Name

`form-listbox`

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
- Selected option value (`button[role="option"][aria-selected="true"]`)
---
- `filter`
- `string`
- `''`
- Filter text used to hide/show options
---
- `visibleOptions`
- `FormListboxOption[]`
- All options
- **Read-only.** The `{ value, label }` pairs currently passing `filter`, in document order. Composing parents gate their own UI on this rather than querying the option buttons.
{% /table %}

{% partial file="form-associated.md" /%}

#### Methods

{% table %}
- Name
- Type
- Description
---
- `focusFirstOption`
- `() => void`
- Moves focus to the first option still passing the filter, if any
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('[role="listbox"]')`
- `HTMLElement`
- **required**
- Container for option buttons
---
- `first('input.filter')`
- `HTMLInputElement`
- optional
- Text input for client-side filtering
---
- `first('button.clear')`
- `HTMLButtonElement`
- optional
- Clears current filter text
---
- `first('card-callout')`
- `HTMLElement`
- optional
- Callout container for loading/error states when `src` is used
---
- `first('.loading')`
- `HTMLElement`
- optional
- Loading state element
---
- `first('.error')`
- `HTMLElement`
- optional
- Error message element
---
- `all('button[role="option"]')`
- `Cell<HTMLButtonElement[]>`
- optional
- Option buttons (inline and/or rendered from `src`)
{% /table %}
