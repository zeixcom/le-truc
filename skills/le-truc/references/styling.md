<overview>
CSS patterns for Le Truc component style files.
These patterns apply to the `.css` file that accompanies each component.
</overview>

## Scope all rules to the host element

Every rule must be nested under the host element tag name. This ensures styles do not leak to other components.

```css
my-component {
  /* host-level layout */
  display: inline-block;

  /* descendant styles via CSS nesting */
  & button {
    border: 1px solid var(--color-border);
    padding: var(--space-xs) var(--space-s);
  }
}
```

Never write a bare selector (`button { … }`) in a component CSS file.

## CSS nesting for descendants

Use `& child` to scope descendant rules. No need for BEM class names — the component tag name provides the scope.

```css
my-component {
  & label {
    display: flex;
    gap: var(--space-s);
  }

  & input {
    border: 1px solid var(--color-border);
  }

  & input:focus {
    outline: none;
    box-shadow: 0 0 var(--space-xxs) 2px var(--color-selection);
  }
}
```

## Custom properties for all design tokens

Never hardcode colors, spacing, font sizes, or border radii. Use the project's design-token custom properties:

| Category | Pattern | Examples |
|---|---|---|
| Colors | `--color-*` | `--color-border`, `--color-primary`, `--color-text`, `--color-secondary-hover` |
| Spacing | `--space-*` | `--space-xs`, `--space-s`, `--space-m`, `--space-l` |
| Typography | `--font-size-*`, `--line-height-*` | `--font-size-m`, `--line-height-xs` |
| Input | `--input-height` | standard form control height |
| Transitions | `--transition-short`, `--easing-inout` | for hover/active transitions |
| Border radius | `--space-xs` | shared token used for radius too |

```css
/* ✅ Good */
my-component {
  & button {
    background-color: var(--color-secondary);
    padding: var(--space-xs) var(--space-s);
    border-radius: var(--space-xs);
    font-size: var(--font-size-m);
    transition: background-color var(--transition-short) var(--easing-inout);

    &:hover {
      background-color: var(--color-secondary-hover);
    }
  }
}

/* ✗ Bad */
my-component {
  & button {
    background-color: #f0f0f0;
    padding: 4px 8px;
    border-radius: 4px;
  }
}
```

## Variant modifier classes on the host

Style variants by combining the host tag name with a modifier class. Never use a separate class on an inner element for a variant.

```css
my-component {
  /* default variant styles here */

  &.primary {
    & button {
      background-color: var(--color-primary);
      color: var(--color-on-primary);
    }
  }

  &.danger {
    & button {
      background-color: var(--color-danger);
    }
  }

  &.ghost {
    & button {
      background-color: transparent;
      border-color: currentColor;
    }
  }
}
```

## State styles

Reactive states (disabled, loading, active, selected) are typically reflected as attributes on the host. Style them with attribute selectors:

```css
my-component {
  &:has([disabled]) {
    opacity: 0.5;
    pointer-events: none;
  }
}

/* Or: host-attribute selector if the state attribute lives on the host */
my-component[disabled] {
  opacity: 0.5;
}
```

Focus styles:

```css
my-component {
  & label:has(:focus-visible) {
    box-shadow: 0 0 var(--space-xxs) 2px var(--color-selection);
  }
}
```

## visually-hidden utility

For visually hiding elements that must remain accessible (e.g., replacing a native checkbox with a custom visual):

```css
.visually-hidden {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}
```

This is typically defined in a shared global stylesheet, not repeated per component.

## What to avoid

- Hardcoded color, spacing, or font values
- Bare selectors not scoped to the host
- `!important`
- Styles on inner elements of a child component (encapsulation violation)
- Inline styles in CSS files (obviously)
