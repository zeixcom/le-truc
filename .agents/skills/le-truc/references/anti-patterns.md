# Anti-Patterns

**Overview:** Patterns to avoid in Le Truc components — TypeScript, HTML, CSS, and documentation.

---

## TypeScript Anti-Patterns

### Querying Outside Host's Subtree

```typescript
// ❌ Never: reaches outside component's DOM boundary
document.querySelector('.other-component')
this.parentElement.querySelector('button')
document.getElementById('some-id')
```

**Only legal interface** between component and outside world: `host` and (for consumer components) context.

---

### Directly Accessing Child Component Internals

```typescript
// ❌ Never: bypasses child's reactive system
const child = first('child-component')
child.querySelector('button').disabled = true

// ✅ Use pass() on child component itself
pass(child, { disabled: 'disabled' })

// ✅ Or watch() + bindProperty() for non-Le Truc
watch('disabled', bindProperty(child, 'disabled'))
```

---

### Sibling Communication

```typescript
// ❌ Never: siblings cannot talk to each other
const sibling = document.querySelector('other-component')
sibling.value = this.value
```

**Lift shared state to common ancestor** and pass it down.

---

### Unbranded Custom Parsers

```typescript
// ❌ Not recognized as parser — isParser() checks PARSER_BRAND only
const myParser = (value?: string) => value?.trim() ?? ''

// ✅ Always use asParser()
const myParser = asParser((value: string | null | undefined) => value?.trim() ?? '')
```

---

### Unbranded Method Producers

```typescript
// ❌ Not recognized as MethodProducer — treated as MemoCallback
expose({
  clear: () => { host.value = '' }
})

// ✅ Wrap with defineMethod() — fn is the method itself
expose({
  clear: defineMethod(() => { host.value = '' })
})
```

---

### Custom Watch Handlers Without Cleanup

```typescript
// ❌ Memory leak: listener never removed
watch('active', active => {
  document.addEventListener('keydown', handler)
})

// ✅ Return cleanup function
watch('active', active => {
  if (active) {
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }
})
```

---

### Missing TypeScript Props Type

```typescript
// ❌ No type safety on host.propName access
defineComponent('my-component', ({ expose, watch }) => { … })

// ✅ Explicit Props generic
defineComponent<MyComponentProps>('my-component', ({ expose, watch }) => { … })
```

---

### Props Type Declared as `interface`

```typescript
// ❌ interface fails the ComponentProps index-signature constraint
interface MyComponentProps { value: string }
defineComponent<MyComponentProps>('my-component', …)  // "Index signature … is missing"

// ✅ Always use type — TS infers an index signature for literals, never interfaces
type MyComponentProps = { value: string }
defineComponent<MyComponentProps>('my-component', …)
```

`ComponentProps` is `Record<ComponentProp, NonNullable<unknown>>`. TypeScript infers an implicit index signature for object type **literals** but never for **interfaces** (interfaces support declaration merging, so TS can't treat them as closed). This isn't a style preference — `interface` won't compile against `defineComponent`'s constraint.

---

### God Component

```typescript
// ❌ Overloaded with unrelated state — split into focused components
{
  userAvatar: asString(),
  cartItemCount: asInteger(),
  notificationCount: asInteger(),
  isMenuOpen: asBoolean(),
}
```

---

### `dangerouslyBindInnerHTML` on Untrusted Content

```typescript
// ❌ XSS risk
content: dangerouslyBindInnerHTML('userGeneratedHtml')

// ✅ Only on server-rendered or pre-sanitized HTML
content: dangerouslyBindInnerHTML('highlightedCode')
```

---

### `pass()` on Non-Le-Truc Elements

```typescript
// ❌ pass() bypasses non-Le-Truc change detection — child never updates
pass(litEl, { disabled: 'disabled' })

// ✅ Use watch() + bindProperty() for anything that isn't Le Truc
watch('disabled', bindProperty(litEl, 'disabled'))
```

---

### Non-Live DOM Snapshots as Reactive Inputs

Reactive thunks and `pass()` props re-evaluated when signal dependencies change. Reading DOM property that returns **snapshot** (static value at call time) will not trigger re-evaluation when DOM changes — causing stale state.

```typescript
// ❌ querySelector returns snapshot reference — does not update reactively
pass(add, {
  disabled: () => host.querySelector('[data-item]') === null,
})

// ✅ Use live collection (HTMLCollection always current)
pass(add, {
  disabled: () => container.children.length === 0,
})

// ✅ Or use createElementsMemo for signal-backed reactive collection
const items = createElementsMemo(container, '[data-item]')
pass(add, {
  disabled: () => items.get().length === 0,
})
```

**Live DOM APIs:** `element.children`, `element.childNodes`, `element.getElementsByTagName()`, `element.getElementsByClassName()` — all return live `HTMLCollection` or `NodeList` that reflect current DOM on every `.length` or index access.

**Snapshot DOM APIs:** `element.querySelectorAll()`, `element.querySelector()` (returns one element or null at call time), `Array.from(collection)`, spread `[...collection]` — all produce static snapshots that do not update.

---

### Querying Inside Effect or Event Callbacks

`first()` and `all()` run once, at connect time. They also register any undefined custom element in the host's dependency set — this drives the 200ms upgrade-wait.

A query inside a callback body breaks both guarantees:
- An `on()` handler runs on every event.
- A `watch()` effect re-runs on every signal change.
- Either way, the query repeats, and the connect-time dependency registration is lost.

```typescript
// ❌ Re-queries the DOM on every click; dependency registration skipped
on(host, 'click', () => {
  first('button')?.focus()
})

// ❌ Re-queries on every signal change
watch('count', () => {
  first('.badge')?.textContent = String(host.count)
})

// ✅ Query once in the factory body, capture in a const, use to guard the effect
const badge = first('.badge')
if (badge) watch('count', () => {
  badge.textContent = String(host.count)
})
```

`on()` and `pass()` skip gracefully when the target is falsy. Inlining a query as a call argument (`on(first('button'), 'click', …)`) works, but it hides the timing from readers and mixes two intents in one expression. Declare the query on its own line, directly above the effect it feeds — see "Statement Layout: Group by Concern" in `effects.md`.

This rule is specific to host-level `first()`/`all()` — they lose real guarantees (connect-time dependency registration, Memo liveness) when repeated inside a callback. `query()`/`queryAll()` never had those guarantees to begin with: they are one-shot, root-parameterized lookups meant to be called from inside `bindItem`/`each` callbacks, or from free-standing helper functions invoked from event handlers. Calling `query()` inside an `on()` handler is not this anti-pattern.

---

## HTML Anti-Patterns

### Empty Custom Element

```html
<!-- ❌ Nothing renders before JS runs -->
<my-component></my-component>

<!-- ✅ Content present from start -->
<my-component><button type="button">Click</button></my-component>
```

---

### Non-Semantic Elements

```html
<!-- ❌ Non-semantic -->
<my-button>
  <div role="button" tabindex="0">Submit</div>
</my-button>

<!-- ✅ Native element -->
<my-button>
  <button type="button">Submit</button>
</my-button>
```

---

### Inline Styles or Event Handlers

```html
<!-- ❌ -->
<my-component style="color: red" onclick="doSomething()">…</my-component>

<!-- ✅ -->
<my-component class="primary">…</my-component>
```

---

## CSS Anti-Patterns

### Hardcoded Values

```css
/* ❌ */
my-component button { background-color: #4a90d9; padding: 8px 16px; }

/* ✅ */
my-component button { background-color: var(--color-primary); padding: var(--space-s) var(--space-m); }
```

---

### Bare Selectors (Not Scoped to Host)

```css
/* ❌ Leaks to whole page */
button { border-radius: 4px; }

/* ✅ Scoped */
my-component button { border-radius: var(--space-xs); }
```

---

### Styling Inner Elements of Child Component

```css
/* ❌ Encapsulation violation */
my-parent child-component button { color: red; }

/* ✅ Use CSS class or custom property on child host */
my-parent child-component { --button-color: red; }
```

---

## Documentation Anti-Patterns

### Documenting Implementation Details

```markdown
<!-- ❌ -->
Uses createSlot internally to manage the backing signal.

<!-- ✅ Document observable interface only -->
```

---

### Incorrect Defaults

Default column in Reactive Properties table **must match** actual fallback in TypeScript source. Check `asString('')`, `asInteger(0)`, `asBoolean()` (→ `false`), etc.

---

### Missing Required Sections

Every component docs file must include:
- Description
- Tag Name
- Descendant Elements (even if empty)

---

## Summary Checklist

| Category | Anti-Pattern | Fix |
|---|---|---|
| TypeScript | Query outside subtree | Use `host` only |
| TypeScript | Direct child internals access | Use `pass()` or `watch()` + `bindProperty()` |
| TypeScript | Sibling communication | Lift to ancestor |
| TypeScript | Unbranded parser | Use `asParser()` |
| TypeScript | Unbranded method | Use `defineMethod()` |
| TypeScript | No cleanup in watch | Return cleanup function |
| TypeScript | Missing Props type | Add explicit generic |
| TypeScript | Props as `interface` | Declare props with `type` |
| TypeScript | God component | Split into focused components |
| TypeScript | Snapshot DOM in reactive | Use live DOM APIs |
| TypeScript | Query inside effect/event callback | Query once in factory body |
| HTML | Empty custom element | Add content |
| HTML | Non-semantic elements | Use native elements |
| HTML | Inline styles/handlers | Use classes |
| CSS | Hardcoded values | Use custom properties |
| CSS | Bare selectors | Scope to host |
| CSS | Style child internals | Use custom properties on child |
| Docs | Implementation details | Document interface only |
| Docs | Incorrect defaults | Match source |
| Docs | Missing sections | Add required sections |
