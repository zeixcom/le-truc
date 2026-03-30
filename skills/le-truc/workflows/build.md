<required_reading>
1. references/component-model.md — `defineComponent` args, reactivity flow, signal types
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
- **Props**: each reactive property, its type, and how it is initialised (parser, reader, or static value)
- **UI map** (`select`): named queries into the host subtree
- **Effects** (`setup`): which effect handles which prop on which element
- **Coordination**: how components communicate if more than one is involved (see references/coordination.md)

**Wait for the user to confirm or continue without objection before writing code.**

## Step 2: Write the TypeScript file (`.ts`)

Follow references/component-model.md exactly. Pattern:

```typescript
import {
  asBoolean,          // only import what you use
  type Component,
  defineComponent,
  on,
  setText,
} from '@zeix/le-truc'

// 1. Props type — all reactive property names and their TypeScript types
export type MyComponentProps = {
  disabled: boolean
  label: string
}

// 2. UI type — all named queries returned by the select function
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

// 4. Component definition
export default defineComponent<MyComponentProps, MyComponentUI>(
  'my-component',
  // props: how each property is initialised
  {
    disabled: asBoolean(),
    label: asString(ui => ui.label.textContent ?? ''),
  },
  // select: named DOM queries; first() for single elements, all() for collections
  ({ first }) => ({
    button: first('button', 'Add a native <button> descendant.'),
    label: first('span.label'),
  }),
  // setup: effects keyed by UI element name; host is always available
  ({ host }) => ({
    button: setProperty('disabled'),
    label: setText('label'),
  }),
)
```

Rules:
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

<!-- Disabled state (attribute drives the prop via parser) -->
<my-component disabled>
  <button type="button"><span class="label">Disabled</span></button>
</my-component>

<hr />

<!-- Variant (if the component supports modifier classes) -->
<my-component class="primary">
  <button type="button"><span class="label">Primary action</span></button>
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
| `disabled` | Boolean attribute; presence sets `disabled` to `true` |

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
- Docs: all required tables present in standard Markdown; accurate types and defaults
- Project test suite passes (if applicable)
</success_criteria>
