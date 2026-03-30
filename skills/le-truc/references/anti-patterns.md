<overview>
Patterns to avoid in Le Truc components — TypeScript, HTML, CSS, and documentation.
</overview>

## TypeScript anti-patterns

### Querying outside the host's subtree

```typescript
// ✗ Never: reaches outside the component's DOM boundary
document.querySelector('.other-component')
this.parentElement.querySelector('button')
document.getElementById('some-id')
```

The only legal interface between a component and the outside world is `host` and (for consumer components) context.

### Directly reading or writing inner elements of a child component

```typescript
// ✗ Never: bypasses the child's reactive system
const child = first('child-component')
child.querySelector('button').disabled = true

// ✅ Use pass() or setProperty() on the child component itself
```

### Sibling communication

```typescript
// ✗ Never: siblings cannot talk to each other
const sibling = document.querySelector('other-component')
sibling.value = this.value
```

Lift shared state to a common ancestor and pass it down.

### Unbranded custom parsers

```typescript
// ✗ Unreliable: default parameters reduce fn.length
const myParser = (ui, value = '') => value.trim()

// ✅ Always use asParser()
const myParser = asParser((ui, value = '') => value.trim())
```

### Unbranded method producers

```typescript
// ✗ Not recognised as a MethodProducer — treated as a Reader
{
  add: (ui) => { ui.host.add = () => { /* … */ } }
}

// ✅ Wrap with asMethod()
{
  add: asMethod((ui) => { ui.host.add = () => { /* … */ } })
}
```

### Custom effects without a cleanup function

```typescript
// ✗ Memory leak: listener never removed
(host, target) => {
  target.addEventListener('resize', handler)
}

// ✅ Return a cleanup function
(host, target) => {
  target.addEventListener('resize', handler)
  return () => target.removeEventListener('resize', handler)
}
```

### Missing TypeScript types on Props and UI

```typescript
// ✗ No type safety — parsers and UI queries are the main type-safety mechanism
defineComponent('my-component', { label: asString() }, …)

// ✅ Explicit generic types
defineComponent<MyComponentProps, MyComponentUI>('my-component', …)
```

### Overloading one component with unrelated state

```typescript
// ✗ "God component" — split into focused components
{
  userAvatar: asString(),
  cartItemCount: asInteger(),
  notificationCount: asInteger(),
  isMenuOpen: asBoolean(),
}
```

### `dangerouslySetInnerHTML` on untrusted content

```typescript
// ✗ XSS risk
content: dangerouslySetInnerHTML('userGeneratedHtml')

// ✅ Only on server-rendered or pre-sanitised HTML
content: dangerouslySetInnerHTML('highlightedCode')
```

### `pass()` on non-Le-Truc elements

```typescript
// ✗ pass() bypasses non-Le-Truc change detection — the child never updates
'lit-element': pass({ disabled: hostSignal })

// ✅ Use setProperty() for anything that isn't a Le Truc component
'lit-element': setProperty('disabled')
```

## HTML anti-patterns

### Empty custom element (no descendant content)

```html
<!-- ✗ Nothing renders before JS runs -->
<my-component></my-component>

<!-- ✅ Content present from the start -->
<my-component><button type="button">Click</button></my-component>
```

### `<div>` where a semantic element exists

```html
<!-- ✗ Non-semantic -->
<my-button>
  <div role="button" tabindex="0">Submit</div>
</my-button>

<!-- ✅ Native element -->
<my-button>
  <button type="button">Submit</button>
</my-button>
```

### Inline styles or event handlers

```html
<!-- ✗ -->
<my-component style="color: red" onclick="doSomething()">…</my-component>
```

## CSS anti-patterns

### Hardcoded values

```css
/* ✗ */
my-component button { background-color: #4a90d9; padding: 8px 16px; }

/* ✅ */
my-component button { background-color: var(--color-primary); padding: var(--space-s) var(--space-m); }
```

### Bare selectors (not scoped to the host)

```css
/* ✗ Leaks to the whole page */
button { border-radius: 4px; }

/* ✅ Scoped */
my-component button { border-radius: var(--space-xs); }
```

### Styling inner elements of a child component

```css
/* ✗ Encapsulation violation */
my-parent child-component button { color: red; }

/* ✅ Use a CSS class or custom property on the child host */
my-parent child-component { --button-color: red; }
```

## Documentation anti-patterns

### Documenting implementation details

```markdown
<!-- ✗ -->
Uses createSlot internally to manage the backing signal.

<!-- ✅ Document the observable interface only -->
```

### Incorrect defaults

The "Default" column in the Reactive Properties table must match the actual fallback in the TypeScript source. Check `asString('')`, `asInteger(0)`, `asBoolean()` (→ `false`), etc.

### Missing required sections

Every component docs file must include Description, Tag Name, and Descendant Elements (even if empty — though a component with no descendants would be unusual).
