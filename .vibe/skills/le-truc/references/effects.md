# Effects

**Overview:** How to drive DOM updates in Le Truc v2.0. All helpers imported from `@zeix/le-truc`. Effects driven by `watch()` in factory return array.

---

## Pattern

Every DOM update follows the same pattern:

```typescript
watch(source, handler)
```

- `source` — prop name string, `Signal`, or thunk `() => T`
- `handler` — either `(value: T) => void` (plain function) or `SingleMatchHandlers<T>` (object with `ok`, `nil?`, `err?`, `stale?` branches)

`bind*` helpers create typed handler functions or `SingleMatchHandlers` objects and can be passed directly to `watch`. They are **optional shortcuts** — plain handler functions that update DOM directly are equally valid and often cleaner when multiple DOM updates belong together.

---

## Thunk Sources

Thunk `() => T` as source lets you apply transformation before passing value to bind helper:

```typescript
// Prop is number, but bindProperty(input, 'value') needs string
watch(() => String(host.value), bindProperty(input, 'value'))

// Derived boolean from two props
watch(() => host.value > 0 && !host.disabled, bindVisible(clearBtn))

// Computed string for CSS custom property
watch(() => `${host.hue}deg`, bindStyle(host, '--hue'))
```

Without thunks, these require custom handlers. Thunks keep intent declarative.

---

## Choosing a Helper

| Goal | Helper | Handler Type |
|---|---|---|
| Set text content | `bindText(el, preserveComments?)` | `(value: string \| number) => void` |
| Set DOM property | `bindProperty(el, key)` | `(value: E[K]) => void` |
| Show/hide element | `bindVisible(el, transform?)` | `(value: T) => void` |
| Toggle CSS class | `bindClass(el, token, transform?)` | `(value: T) => void` |
| Set/remove attribute | `bindAttribute(el, name, allowUnsafe?)` | `SingleMatchHandlers<string \| boolean>` |
| Set inline style | `bindStyle(el, prop)` | `SingleMatchHandlers<string>` |
| Set innerHTML | `dangerouslyBindInnerHTML(el, options?)` | `SingleMatchHandlers<string>` |
| Attach event listener | `on(target, type, handler, options?)` | returns `EffectDescriptor` |
| Bind Le Truc child prop | `pass(target, props)` | returns `EffectDescriptor` |
| Per-element effects on Memo | `each(memo, callback)` | returns `EffectDescriptor` |

---

## Helper Reference

### `bindText(element, preserveComments?)`

Returns `(value: string | number) => void`. Sets `element.textContent`. Numbers coerced to strings.

```typescript
watch('label', bindText(span))
watch('label', bindText(el, true))  // preserve HTML comment nodes
```

### `bindProperty(element, key)`

Returns `(value: E[K]) => void`. Sets DOM property directly — use for `.disabled`, `.checked`, `.value`, `.hidden`, any IDL attribute.

```typescript
watch('disabled', bindProperty(button, 'disabled'))
watch('value', bindProperty(input, 'value'))
```

### `bindVisible(element, transform?)`

Returns `(value: T) => void`. Sets `element.hidden = !value`. `true` makes element visible.

```typescript
watch('loading', bindVisible(spinner))
watch('count', bindVisible(clearBtn, v => v > 0))  // custom transform
```

### `bindClass(element, token, transform?)`

Returns `(value: T) => void`. Adds `token` when truthy, removes when falsy.

```typescript
watch('active', bindClass(item, 'active'))
watch('state', bindClass(el, 'is-open', v => v === 'open'))  // custom transform
```

### `bindAttribute(element, name, allowUnsafe?)`

Returns `SingleMatchHandlers<string | boolean>`. Pass directly to `watch`.

- `ok(string)` → `safeSetAttribute(el, name, value)` (security validated)
- `ok(boolean)` → `el.toggleAttribute(name, value)` — adds when `true`, removes when `false`
- `nil` → `el.removeAttribute(name)`

```typescript
watch('href', bindAttribute(link, 'href'))
watch('expanded', bindAttribute(trigger, 'aria-expanded'))
watch('src', bindAttribute(img, 'src', true))  // skip security validation
```

### `bindStyle(element, prop)`

Returns `SingleMatchHandlers<string>`. Pass directly to `watch`.

- `ok(string)` → `el.style.setProperty(prop, value)`
- `nil` → `el.style.removeProperty(prop)` — restores CSS cascade value

```typescript
watch('opacity', bindStyle(overlay, 'opacity'))
watch('accentColor', bindStyle(card, '--highlight-color'))
```

### `dangerouslyBindInnerHTML(element, options?)`

Returns `SingleMatchHandlers<string>`. Pass directly to `watch`. Only use on trusted/sanitized content.

```typescript
watch('highlightedHtml', dangerouslyBindInnerHTML(codeBlock))
```

Options: `{ shadowRootMode?: ShadowRootMode, allowScripts?: boolean }`.

### `on(target, type, handler, options?)`

Returns `EffectDescriptor`. Handler receives `(event, element)`.

Two handler return modes:

```typescript
// Property update — applied in single batch()
on(button, 'click', () => ({ count: host.count + 1 }))

// Side-effect only
on(input, 'input', () => { analytics.track('typed') })

// Memo target — event delegation (bubbling events only)
on(allItems, 'click', (event, item) => ({ selectedId: item.dataset.id }))
```

`passive` set automatically for high-frequency events (scroll, resize, touch, wheel). For non-bubbling events with Memo target, per-element listeners set up as fallback — prefer `each()` + `on()` instead.

### `pass(target, props)`

Le Truc-to-Le Truc only. Replaces backing Slot signal of descendant component's prop with signal from parent.

```typescript
const child = first('child-component') as HTMLElement & ChildProps
pass(child, { disabled: 'disabled' })   // string prop name
pass(child, { value: mySignal })         // Signal
pass(child, { label: () => host.label }) // thunk
// SlotDescriptor — inline bi-directional adapter
pass(child, {
  progress: {
    get: () => host.value / host.max,    // normalize to 0-1
    set: (v: number) => { host.value = v * host.max },
  },
})
```

**Use `bindProperty()` inside `watch()` for non-Le Truc elements** (Lit, Stencil, plain custom elements).

### `each(memo, callback)`

For per-element effects on `Memo<E[]>` from `all()`. Elements enter/leave collection with own reactive scope.

```typescript
const items = all('[role="option"]')
return [
  each(items, item => [
    on(item, 'focus', () => ({ focusedId: item.id })),
    watch('selectedId', bindClass(item, 'selected', id => id === item.id)),
  ]),
]
```

---

## Custom Handler Functions

Any `(value: T) => void` function works as `watch` handler:

```typescript
watch('error', error => {
  textbox.ariaInvalid = String(!!error)
  if (error) textbox.setAttribute('aria-errormessage', errorId)
  else textbox.removeAttribute('aria-errormessage')
})
```

Return cleanup function if handler sets up listeners or timers:

```typescript
watch('active', active => {
  if (active) {
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }
})
```

---

## Multiple Effects on One Element

Return multiple entries in array:

```typescript
return [
  watch('value', bindProperty(input, 'value')),
  watch('disabled', bindProperty(input, 'disabled')),
  watch('error', bindClass(input, 'error', Boolean)),
]
```

---

## Conditional Effects for Optional Descendants

```typescript
const badge = first('span.badge')  // may return null

return [
  badge && watch('count', bindText(badge)),  // skipped if badge is null
]
```
