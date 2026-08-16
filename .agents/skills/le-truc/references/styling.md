# Styling

**Overview:** CSS for Le Truc components — host scoping, nesting, custom properties, variant modifier classes.

---

## Host Scoping

**All rules must be scoped to the host element tag name.** Never use bare selectors.

```css
/* ✅ Scoped to host */
my-component {
  display: inline-block;
}

my-component button {
  padding: var(--space-s) var(--space-m);
}

/* ❌ Leaks to whole page */
button {
  padding: 8px 16px;
}
```

---

## CSS Nesting

Use CSS nesting (`&`) for descendant selectors:

```css
my-component {
  display: inline-block;

  & button {
    border: 1px solid var(--color-border);
    background-color: var(--color-secondary);
    cursor: pointer;
  }

  & .label {
    font-weight: 600;
  }

  /* Nested descendants */
  & button:hover {
    background-color: var(--color-secondary-hover);
  }
}
```

---

## Design Token Custom Properties

**Always use custom properties for design tokens.** Never hardcode colors, spacing, or typography values.

| Category | Prefix | Example |
|---|---|---|
| Colors | `--color-*` | `--color-primary`, `--color-on-primary`, `--color-border` |
| Spacing | `--space-*` | `--space-xxs`, `--space-xs`, `--space-s`, `--space-m`, `--space-l` |
| Typography | `--font-*` | `--font-size-s`, `--font-size-m`, `--font-weight-bold` |
| Border radius | `--radius-*` | `--radius-s`, `--radius-m`, `--radius-circle` |
| Shadows | `--shadow-*` | `--shadow-s`, `--shadow-m` |
| Transitions | `--transition-*` | `--transition-fast`, `--transition-normal` |

```css
/* ✅ Design tokens */
my-component {
  padding: var(--space-s);
  background-color: var(--color-surface);
  border-radius: var(--radius-s);
  font-size: var(--font-size-m);
}

/* ❌ Hardcoded values */
my-component {
  padding: 8px;
  background-color: #ffffff;
  border-radius: 4px;
  font-size: 16px;
}
```

---

## Variant Modifier Classes

Express visual variants as **modifier classes on the host element**, not as separate selectors:

```css
/* ✅ Modifier classes on host */
my-component {
  & button {
    background-color: var(--color-secondary);
  }

  &.primary button {
    background-color: var(--color-primary);
    color: var(--color-on-primary);
  }

  &.danger button {
    background-color: var(--color-error);
    color: var(--color-on-error);
  }

  &.ghost button {
    background-color: transparent;
    border: 1px solid var(--color-border);
  }
}

/* ❌ Separate selectors */
.primary-button {
  /* ... */
}
.danger-button {
  /* ... */
}
```

---

## State Classes

For state-driven styling, prefer custom `:state()` pseudo-classes via `bindState(internals, token)` over modifier classes. A custom state is component-owned. Consumer code rewriting the host's `class` attribute cannot overwrite it. It works on any component (`internals` is attached unconditionally in the constructor), not only form-associated ones:

```css
my-component {
  & button {
    cursor: pointer;
  }

  &:state(disabled) button {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:state(loading) button {
    cursor: wait;
    position: relative;
  }

  &:state(loading)::after {
    content: '';
    /* spinner styles */
  }
}
```

```typescript
// In factory
watch('disabled', bindState(internals, 'disabled'))
watch('loading', bindState(internals, 'loading'))
```

`bindState` mirrors `bindClass`: `true` adds the token to `internals.states`, `false` removes it; a `null` `internals` (only possible if `attachInternals()` failed pre-upgrade) is a graceful no-op. Reach for `bindClass(host, token)` instead only when the state genuinely needs to be visible/targetable from outside as a regular class (e.g. a consumer selector that can't use `:state()`, or JS outside Le Truc reading `classList`) — that's the exception, not the default.

---

## Encapsulation

**Never style inner elements of child components.** Use CSS custom properties on child host instead:

```css
/* ✅ Set custom property on child host */
my-parent child-component {
  --button-color: var(--color-primary);
}

/* ❌ Encapsulation violation */
my-parent child-component button {
  color: red;
}
```

---

## Focus Styles

Never suppress focus outlines globally. Use `:focus-visible` for keyboard-only focus:

```css
my-component {
  & label:has(:focus-visible) {
    box-shadow: 0 0 var(--space-xxs) 2px var(--color-selection);
  }

  & input:focus {
    outline: none;  /* OK when replaced by label's box-shadow */
  }
}
```

---

## Complete Example

```css
my-button {
  display: inline-block;

  & button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    padding: var(--space-s) var(--space-m);
    border: 1px solid var(--color-border);
    background-color: var(--color-surface);
    color: var(--color-text);
    font-size: var(--font-size-m);
    font-weight: var(--font-weight-normal);
    border-radius: var(--radius-s);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  & button:hover {
    background-color: var(--color-surface-hover);
  }

  &.primary button {
    background-color: var(--color-primary);
    color: var(--color-on-primary);
    border-color: var(--color-primary);
  }

  &.primary button:hover {
    background-color: var(--color-primary-hover);
  }

  &:state(disabled) button {
    opacity: 0.5;
    cursor: not-allowed;
  }

  & .label {
    font-weight: var(--font-weight-bold);
  }

  & .badge {
    background-color: var(--color-badge);
    color: var(--color-on-badge);
    padding: var(--space-xxs) var(--space-xs);
    border-radius: var(--radius-circle);
    font-size: var(--font-size-xs);
  }
}
```
