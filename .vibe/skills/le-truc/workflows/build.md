# Build Workflow

**Use when:** Creating a new Le Truc component.

**Required reading first:**
- `references/component-model.md` — factory form, reactivity flow, signal types
- `references/markup.md` — HTML structure, progressive enhancement
- `references/styling.md` — CSS scoping, custom properties, variants
- `references/documentation.md` — what to document and how

Read `references/effects.md` and `references/parsers.md` as you write TypeScript.
Read `references/coordination.md` if component needs to communicate with others.
Read `references/accessibility.md` for interactive/form widgets.

---

## Step 1: Plan

Before writing code, produce a brief plan and show it to the user. Include:

- **Component name(s):** tag name(s) in lowercase with hyphen
- **Responsibility:** one sentence per component
- **Props:** each reactive property, its type, initialization method
- **Elements:** which elements queried via `first`/`all`, which optional
- **Effects:** which `watch()`/`on()`/`pass()` drives which DOM update
- **Coordination:** how components communicate (see `references/coordination.md`)

**Wait for user confirmation before proceeding.**

---

## Step 2: Write TypeScript (`.ts`)

```typescript
import {
  asBoolean,
  asString,
  bindProperty,
  bindText,
  defineComponent,
} from '@zeix/le-truc'

// 1. Props type — all reactive property names and types
export type MyComponentProps = {
  disabled: boolean
  label: string
}

// 2. Global element registry (enables typed access)
declare global {
  interface HTMLElementTagNameMap {
    'my-component': HTMLElement & MyComponentProps
  }
}

// 3. Component definition
export default defineComponent<MyComponentProps>(
  'my-component',
  ({ expose, first, watch }) => {
    // Query descendants
    const button = first('button', 'Add a native <button> descendant.')
    const label = first('span.label')

    // Declare reactive props — call expose() ONCE
    expose({
      disabled: asBoolean(),
      label: asString(label?.textContent ?? button.textContent ?? ''),
    })

    // Return effect descriptors (nested arrays OK, falsy guards filtered)
    return [
      watch('disabled', bindProperty(button, 'disabled')),
      label && watch('label', bindText(label)),  // falsy guard for optional
    ]
  },
)
```

**Rules:**
- Only import what you use
- Always provide `required` string to `first()` for essential elements
- Use `element && watch(...)` for optional descendants
- Custom `watch` handlers with listeners/timers must return cleanup function
- Mark props `readonly` only if sensor-driven (not settable from outside)

---

## Step 3: Write HTML (`.html`)

Provide multiple representative examples:

```html
<!-- Default state -->
<my-component>
  <button type="button"><span class="label">Click me</span></button>
</my-component>

<hr />

<!-- Disabled state -->
<my-component disabled>
  <button type="button" disabled><span class="label">Disabled</span></button>
</my-component>

<hr />

<!-- Variant -->
<my-component class="primary">
  <button type="button"><span class="label">Primary action</span></button>
</my-component>
```

Parsers in `expose()` read attributes at connect time:
```html
<my-component disabled label="Disabled">
  <button type="button" disabled><span class="label">Disabled</span></button>
</my-component>
```

**Rules:**
- Valid, functional HTML before JavaScript runs (progressive enhancement)
- Use native semantic elements inside custom element
- Include at least one instance per meaningful state/variant
- Separate examples with `<hr />`

---

## Step 4: Write CSS (`.css`)

```css
my-component {
  display: inline-block;

  & button {
    border: 1px solid var(--color-border);
    background-color: var(--color-secondary);
    cursor: pointer;
  }

  &.primary button {
    background-color: var(--color-primary);
    color: var(--color-on-primary);
  }
}
```

**Rules:**
- Scope all rules to host element tag name
- Use CSS nesting (`& child`) for descendants
- Use design-token custom properties (`--color-*`, `--space-*`, `--font-size-*`)
- Variants via modifier classes on host

---

## Step 5: Write Documentation (`.md`)

```markdown
### My Component

One paragraph describing what the component does and which patterns it demonstrates.

#### Tag Name

`my-component`

#### Reactive Properties

| Name | Type | Default | Description |
|---|---|---|---|
| `disabled` | `boolean` | `false` | Whether the button is disabled |
| `label` | `string` | `''` | Button label text |

#### Attributes

| Name | Description |
|---|---|
| `disabled` | Boolean attribute; presence sets `disabled` to `true` (read at connect time) |

#### CSS Classes

| Class | Description |
|---|---|
| `primary` | Applies primary action styling |

#### Descendant Elements

| Selector | Type | Required | Description |
|---|---|---|---|
| `first('button')` | `HTMLButtonElement` | required | The interactive button |
| `first('span.label')` | `HTMLSpanElement` | required | Displays the label text |
```

See `references/documentation.md` for required sections.

---

## Step 6: Verify

Run the project's test suite (check `package.json` for test command).

If no tests exist, follow `references/testing.md`.

---

## Success Criteria

- TypeScript: no type errors; all imports resolve; `Props` type explicit; `defineComponent` generic matches
- HTML: valid markup; works before JS; covers all states/variants
- CSS: all rules scoped to host; custom properties for design tokens; no hardcoded values
- Docs: all required tables present; accurate types/defaults; Attributes section if using parsers
- Project test suite passes
