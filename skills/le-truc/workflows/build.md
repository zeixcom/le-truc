<required_reading>
1. references/component-model.md — both forms of `defineComponent`, reactivity flow, signal types
2. references/markup.md — HTML structure and progressive-enhancement patterns
3. references/styling.md — CSS scoping, custom properties, variant classes
4. references/documentation.md — what to document and how
Read references/effects.md and references/parsers.md as you write the TypeScript file.
Read references/coordination.md if the component needs to talk to other components.
Read references/accessibility.md for any interactive or form-related widget.
</required_reading>

<process>
## Step 1: Plan

Before writing any code, produce a brief plan and show it to the user. Include:

- **Component name(s)**: tag name(s) in lowercase with a hyphen
- **Responsibility**: one sentence per component
- **Form**: factory (2-param, preferred) unless props must react to HTML attribute changes
- **Props**: each reactive property, its type, and how it is initialised (reader or static value for factory form; parser, reader, or static for 4-param)
- **UI elements**: named queries into the host subtree (via `first` / `all`)
- **Effects**: which effect handles which prop on which element
- **Coordination**: how components communicate if more than one is involved (see references/coordination.md)

**Wait for the user to confirm or continue without objection before writing code.**

## Step 2: Write the TypeScript file (`.ts`)

Follow references/component-model.md exactly.

### Factory form (preferred)

Use the 2-param factory form unless the component requires HTML attribute observation.

```typescript
import {
  type Component,
  defineComponent,
  on,
  read,
  setProperty,
  setText,
} from '@zeix/le-truc'

// 1. Props type — all reactive property names and their TypeScript types
export type MyComponentProps = {
  disabled: boolean
  label: string
}

// 2. UI type — all named elements returned by the factory
type MyComponentUI = {
  button: HTMLButtonElement
  label: HTMLSpanElement
}

// 3. Global element registry (enables typed access via querySelector)
declare global {
  interface HTMLElementTagNameMap {
    'my-component': Component<MyComponentProps>
  }
}

// 4. Component definition — factory form
export default defineComponent<MyComponentProps, MyComponentUI>(
  'my-component',
  ({ first, host }) => {
    const button = first('button', 'Add a native <button> descendant.')
    const label = first('span.label')
    return {
      ui: { button, label },
      props: {
        disabled: read(() => button.disabled, false),
        label: read(() => label.textContent ?? '', ''),
      },
      effects: {
        button: setProperty('disabled'),
        label: setText('label'),
      },
    }
  },
)
```

### 4-param form (attribute-driven props only)

Use the 4-param form when HTML authors control props via attributes (e.g., `<my-component disabled label="Click">`).

```typescript
import {
  asBoolean,
  asString,
  type Component,
  defineComponent,
  on,
  setProperty,
  setText,
} from '@zeix/le-truc'

export type MyComponentProps = {
  disabled: boolean
  label: string
}

type MyComponentUI = {
  button: HTMLButtonElement
  label: HTMLSpanElement
}

declare global {
  interface HTMLElementTagNameMap {
    'my-component': Component<MyComponentProps>
  }
}

export default defineComponent<MyComponentProps, MyComponentUI>(
  'my-component',
  // props: parsers auto-populate observedAttributes
  {
    disabled: asBoolean(),
    label: asString(ui => ui.label.textContent ?? ''),
  },
  // select: named DOM queries
  ({ first }) => ({
    button: first('button', 'Add a native <button> descendant.'),
    label: first('span.label'),
  }),
  // setup: effects keyed by UI element name
  ({ host }) => ({
    button: setProperty('disabled'),
    label: setText('label'),
  }),
)
```

Rules (both forms):
- Only import what you use.
- Mark props `readonly` only if they are sensor-driven (not settable from outside).
- Always provide the `required` string to `first()` for elements the component cannot work without.
- Custom effects must return a cleanup function.

## Step 3: Write the HTML file (`.html`)

Follow references/markup.md. Provide multiple representative examples:

```html
<!-- Default state -->
<my-component>
  <button type="button"><span class="label">Click me</span></button>
</my-component>

<hr />

<!-- Disabled state -->
<my-component>
  <button type="button" disabled><span class="label">Disabled</span></button>
</my-component>

<hr />

<!-- Variant (if the component supports modifier classes) -->
<my-component class="primary">
  <button type="button"><span class="label">Primary action</span></button>
</my-component>
```

For 4-param components with attribute-driven props, use attributes in the HTML:
```html
<my-component disabled label="Disabled">
  <button type="button"><span class="label">Disabled</span></button>
</my-component>
```

Rules (see references/markup.md for full guidance):
- The HTML must be valid and functional before JavaScript runs (progressive enhancement).
- Use native semantic elements inside the custom element.
- Include at least one instance per meaningful state variation (default, disabled, each variant).
- Separate examples with `<hr />`.

## Step 4: Write the CSS file (`.css`)

Follow references/styling.md. Example structure:

```css
my-component {
  /* Layout and base styles scoped to the host */
  display: inline-block;

  & button {
    /* Styles for descendant elements using CSS nesting */
    border: 1px solid var(--color-border);
    background-color: var(--color-secondary);
    cursor: pointer;
  }

  /* Variant modifier class */
  &.primary button {
    background-color: var(--color-primary);
    color: var(--color-on-primary);
  }
}
```

Rules (see references/styling.md for full guidance):
- Scope all rules to the host element tag name.
- Use CSS nesting (`& child`) for descendant selectors.
- Use design-token custom properties (`--color-*`, `--space-*`, `--font-size-*`) rather than hardcoded values.
- Variant styles via modifier classes on the host (e.g., `my-component.primary`).

## Step 5: Write the documentation file (`.md`)

Follow references/documentation.md. Use standard Markdown only. Example structure:

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

Document all attributes that HTML authors can set in markup. For factory-form components, note that attribute values are read once at connect time and are not reactive after that.

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

See references/documentation.md for which sections to include and which to omit.

## Step 6: Verify

Run the project's own test suite (check `package.json` for the test command). Do not assume a specific runner.

If tests don't exist yet, follow references/testing.md to advise on what to test.
</process>

<success_criteria>
- TypeScript: no type errors; all imports resolve; `Props` and `UI` types are explicit; `defineComponent` generics match
- HTML: valid markup; works before JS runs; covers all meaningful states and variants
- CSS: all rules scoped to host; custom properties used for all design tokens; no hardcoded colors or spacing
- Docs: all required tables present in standard Markdown; accurate types and defaults; Attributes section present if the component uses parsers
- Project test suite passes (if applicable)
</success_criteria>
