<overview>
Accessibility requirements for Le Truc components.
</overview>

## Prefer native semantics over custom ARIA

Use native elements whenever they exist for the widget type. Native elements come with built-in keyboard behavior, focus management, form participation, and AT support:

| Widget | Use this | Not this |
|---|---|---|
| Button | `<button type="button">` | `<div role="button" tabindex="0">` |
| Checkbox | `<input type="checkbox">` | `<div role="checkbox">` |
| Text input | `<input type="text">` | `<div role="textbox" contenteditable>` |
| Select | `<select>` (simple cases) | custom `role="listbox"` (unless native is insufficient) |
| Dialog | `<dialog>` | `<div role="dialog">` |
| Details/Summary | `<details>` / `<summary>` | `<div role="button" aria-expanded>` |

## When ARIA is required

For complex interactive patterns where no native element exists (combobox, tabs, tree, menubar, slider), follow the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/). Key patterns:

- **Tabs**: `role="tablist"` on container, `role="tab"` on triggers, `role="tabpanel"` on panels; `aria-selected` on active tab; keyboard: arrow keys move between tabs
- **Combobox**: `role="combobox"` on input, `aria-expanded`, `aria-controls` → listbox id; `role="listbox"` on list, `role="option"` on items, `aria-selected` on active option
- **Dialog**: `role="dialog"` (or `<dialog>`), `aria-modal="true"`, `aria-labelledby` → heading id; focus trap while open; Escape closes
- **Listbox**: `role="listbox"`, `aria-multiselectable` if applicable; `role="option"` on items, `aria-selected`

## Keeping ARIA states in sync

Reactive states that map to ARIA attributes must be kept in sync via effects. Use `toggleAttribute` for boolean ARIA states and `setAttribute` for enumerated ones:

```typescript
// setup
trigger: [
  toggleAttribute('aria-expanded', 'open'),     // adds/removes aria-expanded
  setAttribute('aria-controls', 'panelId'),      // sets aria-controls once (static)
]

option: [
  toggleAttribute('aria-selected', 'selected'),
]
```

## Labels and accessible names

- Form controls must have an associated `<label>` (via `for`/`id` or wrapping)
- Icon-only buttons must have either `aria-label` or visually-hidden text
- Groups of related controls should use `<fieldset>`/`<legend>`

```html
<!-- Label wrapping the input -->
<form-textbox>
  <label>
    Email
    <input type="email" />
  </label>
</form-textbox>

<!-- Icon button with visually-hidden text -->
<icon-button>
  <button type="button">
    <svg aria-hidden="true">…</svg>
    <span class="visually-hidden">Delete</span>
  </button>
</icon-button>
```

## Focus management

- Dialogs: move focus to the first focusable element when opened; restore focus to the trigger when closed; trap focus while open
- Menus: focus moves with arrow keys; Escape closes and returns focus to trigger
- Tab panels: Tab moves between the tablist and the active panel; arrow keys move between tabs

Use `host.focus()` or `element.focus()` inside event handlers when focus needs to move programmatically.

## Focus styles

Never suppress focus outlines globally. Use `:focus-visible` to show focus styles only for keyboard navigation:

```css
my-component {
  & label:has(:focus-visible) {
    box-shadow: 0 0 var(--space-xxs) 2px var(--color-selection);
  }

  & input:focus {
    outline: none;  /* only acceptable when replaced by the label's box-shadow above */
  }
}
```

## Live regions

When content updates without a page navigation (loading states, validation messages, notifications), use `aria-live` so screen readers announce the change:

```html
<my-status>
  <span role="status" aria-live="polite"></span>
</my-status>
```

`role="status"` is equivalent to `aria-live="polite"`. Use `aria-live="assertive"` (or `role="alert"`) only for urgent errors that interrupt the user.
