# Accessibility

**Overview:** Accessibility requirements for Le Truc components. Follow [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) for complex patterns.

---

## Prefer Native Semantics Over Custom ARIA

Use native elements whenever they exist for the widget type. Native elements come with built-in keyboard behavior, focus management, form participation, and AT support.

| Widget | Use This | Not This |
|---|---|---|
| Button | `<button type="button">` | `<div role="button" tabindex="0">` |
| Checkbox | `<input type="checkbox">` | `<div role="checkbox">` |
| Text input | `<input type="text">` | `<div role="textbox" contenteditable>` |
| Select | `<select>` (simple cases) | custom `role="listbox"` (unless native insufficient) |
| Dialog | `<dialog>` | `<div role="dialog">` |
| Details/Summary | `<details>`/`<summary>` | `<div role="button" aria-expanded>` |

```html
<!-- ✅ Native semantics -->
<form-checkbox>
  <label>
    <input type="checkbox" />
    Accept terms
  </label>
</form-checkbox>

<!-- ❌ Unnecessary ARIA -->
<form-checkbox>
  <div role="checkbox" tabindex="0">Accept terms</div>
</form-checkbox>
```

---

## When ARIA is Required

For complex interactive patterns where no native element exists (combobox, tabs, tree, menubar, slider), follow ARIA APG.

### Tabs

- `role="tablist"` on container
- `role="tab"` on triggers
- `role="tabpanel"` on panels
- `aria-selected` on active tab
- Keyboard: arrow keys move between tabs

### Combobox

- `role="combobox"` on input
- `aria-expanded`, `aria-controls` → listbox id
- `role="listbox"` on list
- `role="option"` on items
- `aria-selected` on active option

### Dialog

- `role="dialog"` (or `<dialog>`)
- `aria-modal="true"`
- `aria-labelledby` → heading id
- Focus trap while open
- Escape closes

### Listbox

- `role="listbox"`
- `aria-multiselectable` if applicable
- `role="option"` on items
- `aria-selected`

---

## Keeping ARIA States in Sync

Reactive states that map to ARIA attributes must be kept in sync via effects. Use `toggleAttribute` for boolean ARIA states and `setAttribute` for enumerated ones:

```typescript
// In factory return array
watch('expanded', bindAttribute(trigger, 'aria-expanded'))  // boolean → toggleAttribute
watch('selectedId', bindAttribute(option, 'aria-selected', id => id === option.id))  // derived
```

For static ARIA attributes:
```typescript
// In factory body (runs once at connect)
trigger.setAttribute('aria-controls', 'panelId')
```

---

## Labels and Accessible Names

- Form controls **must** have associated `<label>` (via `for`/`id` or wrapping)
- Icon-only buttons **must** have either `aria-label` or visually-hidden text
- Groups of related controls should use `<fieldset>`/`<legend>`

```html
<!-- Label wrapping input -->
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

Visually-hidden CSS:
```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Focus Management

| Pattern | Requirement |
|---|---|
| Dialogs | Move focus to first focusable element when opened; restore to trigger when closed; trap focus while open |
| Menus | Focus moves with arrow keys; Escape closes and returns focus to trigger |
| Tab panels | Tab moves between tablist and active panel; arrow keys move between tabs |

Use `host.focus()` or `element.focus()` inside event handlers:

```typescript
return [
  on(host, 'open', () => {
    firstFocusable.focus()
    // Set up focus trap
  }),
]
```

---

## Focus Styles

Never suppress focus outlines globally. Use `:focus-visible` to show focus styles only for keyboard navigation:

```css
my-component {
  & label:has(:focus-visible) {
    box-shadow: 0 0 var(--space-xxs) 2px var(--color-selection);
  }

  & input:focus {
    outline: none;  /* Only OK when replaced by label's box-shadow */
  }
}
```

---

## Live Regions

When content updates without page navigation (loading states, validation messages, notifications), use `aria-live` so screen readers announce the change:

```html
<my-status>
  <span role="status" aria-live="polite"></span>
</my-status>
```

- `role="status"` = `aria-live="polite"` — announces when user idle
- `role="alert"` = `aria-live="assertive"` — interrupts user; use only for urgent errors

---

## Required ARIA Attributes by Widget

| Widget | Required ARIA |
|---|---|
| Button (custom) | `role="button"`, `tabindex="0"` |
| Checkbox (custom) | `role="checkbox"`, `aria-checked`, `tabindex="0"` |
| Radio (custom) | `role="radio"`, `aria-checked`, `tabindex` (0 for selected, -1 for others) |
| Radio group | `role="radiogroup"` on container |
| Switch | `role="switch"`, `aria-checked` |
| Slider | `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` |
| Progress bar | `role="progressbar"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` |
| Tabs | See [ARIA APG Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) |
| Dialog | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Alert dialog | `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` |
| Menu | `role="menu"`, `role="menuitem"` on items |
| Tree | `role="tree"`, `role="treeitem"` on items, `aria-expanded`, `aria-selected` |

---

## Keyboard Navigation

| Widget | Key | Action |
|---|---|---|
| Button | Space, Enter | Activate |
| Checkbox | Space | Toggle |
| Radio | Arrow keys | Move between options |
| Switch | Space | Toggle |
| Slider | Arrow keys | Increment/decrement |
| Tabs | Arrow keys | Move between tabs |
| Menu | Arrow keys | Move between items |
| Menu | Escape | Close menu |
| Dialog | Escape | Close dialog |
| Dialog | Tab | Move focus within dialog |

Implement keyboard handlers via `on()`:

```typescript
const button = first('button')
return [
  on(button, 'keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      // Activate
    }
  }),
]
```
