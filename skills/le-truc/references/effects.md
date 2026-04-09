<overview>
How to drive DOM updates in Le Truc v2.0.
All helpers are imported from `@zeix/le-truc`. Effects are driven by `watch()` in the factory return array.
</overview>

## Pattern

Every DOM update follows the same pattern:

```typescript
watch(source, handler)
```

- `source` — a prop name string, a `Signal`, or a thunk `() => T`
- `handler` — either `(value: T) => void` (plain function) or `WatchHandlers<T>` (object with `ok`, `nil?`, `err?` branches)

The `bind*` helpers create typed handler functions or `WatchHandlers` objects. Pass them directly to `watch`.

## Choosing a helper

| Goal | Helper | Handler type |
|---|---|---|
| Set text content | `bindText(el, preserveComments?)` | `(value: string \| number) => void` |
| Set a DOM property | `bindProperty(el, key)` | `(value: E[K]) => void` |
| Show or hide an element | `bindVisible(el, transform?)` | `(value: T) => void` |
| Toggle a CSS class | `bindClass(el, token, transform?)` | `(value: T) => void` |
| Set/remove an attribute | `bindAttribute(el, name, allowUnsafe?)` | `WatchHandlers<string \| boolean>` |
| Set an inline style | `bindStyle(el, prop)` | `WatchHandlers<string>` |
| Set innerHTML | `dangerouslyBindInnerHTML(el, options?)` | `WatchHandlers<string>` |
| Attach an event listener | `on(target, type, handler, options?)` | returns `EffectDescriptor` |
| Bind a Le Truc child's prop | `pass(target, props)` | returns `EffectDescriptor` |
| Per-element effects on a Memo | `each(memo, callback)` | returns `EffectDescriptor` |

## Helper reference

### `bindText(element, preserveComments?)`

Returns `(value: string | number) => void`. Sets `element.textContent`. Numbers are coerced to strings.

```typescript
watch('label', bindText(span))

// Preserve HTML comment nodes
watch('label', bindText(el, true))
```

### `bindProperty(element, key)`

Returns `(value: E[K]) => void`. Sets a DOM property directly — use for `.disabled`, `.checked`, `.value`, `.hidden`, and any other IDL attribute.

```typescript
watch('disabled', bindProperty(button, 'disabled'))
watch('value', bindProperty(input, 'value'))
```

### `bindVisible(element, transform?)`

Returns `(value: T) => void`. Sets `element.hidden = !value`. `true` makes the element visible.

```typescript
// Show spinner when host.loading is truthy
watch('loading', bindVisible(spinner))

// Custom boolean transform
watch('count', bindVisible(clearBtn, v => v > 0))
```

### `bindClass(element, token, transform?)`

Returns `(value: T) => void`. Adds `token` when truthy, removes it when falsy.

```typescript
watch('active', bindClass(item, 'active'))

// Custom transform
watch('state', bindClass(el, 'is-open', v => v === 'open'))
```

### `bindAttribute(element, name, allowUnsafe?)`

Returns `WatchHandlers<string | boolean>`. Pass directly to `watch`.

- `ok(string)` → `safeSetAttribute(el, name, value)` (security validated)
- `ok(boolean)` → `el.toggleAttribute(name, value)` — adds (no value) when `true`, removes when `false`
- `nil` → `el.removeAttribute(name)`

```typescript
watch('href', bindAttribute(link, 'href'))
watch('expanded', bindAttribute(trigger, 'aria-expanded'))

// Skip security validation for pre-validated values
watch('src', bindAttribute(img, 'src', true))
```

### `bindStyle(element, prop)`

Returns `WatchHandlers<string>`. Pass directly to `watch`.

- `ok(string)` → `el.style.setProperty(prop, value)`
- `nil` → `el.style.removeProperty(prop)` — restores the CSS cascade value

```typescript
watch('opacity', bindStyle(overlay, 'opacity'))
watch('accentColor', bindStyle(card, '--highlight-color'))
```

### `dangerouslyBindInnerHTML(element, options?)`

Returns `WatchHandlers<string>`. Pass directly to `watch`. Only use on trusted or sanitized content.

```typescript
watch('highlightedHtml', dangerouslyBindInnerHTML(codeBlock))
```

Options: `{ shadowRootMode?: ShadowRootMode, allowScripts?: boolean }`.

### `on(target, type, handler, options?)`

Returns an `EffectDescriptor`. The handler receives `(event, element)`.

Two handler return modes:

```typescript
// Property update — applied in a single batch()
on(button, 'click', () => ({ count: host.count + 1 }))

// Side-effect only
on(input, 'input', () => {
  analytics.track('typed')
})

// Memo target — event delegation (bubbling events only)
on(allItems, 'click', (event, item) => ({
  selectedId: item.dataset.id,
}))
```

`passive` is set automatically for high-frequency events (scroll, resize, touch, wheel). For non-bubbling events with a Memo target, per-element listeners are set up as a fallback — prefer `each()` + `on()` instead.

### `pass(target, props)`

Le Truc-to-Le Truc only. Replaces the backing Slot signal of a descendant component's prop with a signal from the parent.

```typescript
const child = first('child-component') as HTMLElement & ChildProps
pass(child, { disabled: 'disabled' })   // string prop name
pass(child, { value: mySignal })         // Signal
pass(child, { label: () => host.label }) // thunk
```

**Use `bindProperty()` inside `watch()` for non-Le Truc elements** (Lit, Stencil, plain custom elements).

### `each(memo, callback)`

For per-element effects on a `Memo<E[]>` from `all()`. Elements enter/leave the collection with their own reactive scope.

```typescript
const items = all('[role="option"]')
return [
  each(items, item => [
    on(item, 'focus', () => ({ focusedId: item.id })),
    watch('selectedId', bindClass(item, 'selected', id => id === item.id)),
  ]),
]
```

## Custom handler functions

Any `(value: T) => void` function works as a `watch` handler:

```typescript
watch('error', error => {
  textbox.ariaInvalid = String(!!error)
  if (error) textbox.setAttribute('aria-errormessage', errorId)
  else textbox.removeAttribute('aria-errormessage')
})
```

Return a cleanup function if the handler sets up listeners or timers:

```typescript
watch('active', active => {
  if (active) {
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }
})
```

## Multiple effects on one element

Return multiple entries in the array:

```typescript
return [
  watch('value', bindProperty(input, 'value')),
  watch('disabled', bindProperty(input, 'disabled')),
  watch('error', bindClass(input, 'error', Boolean)),
]
```

## Conditional effects for optional descendants

```typescript
const badge = first('span.badge')  // may return null

return [
  badge && watch('count', bindText(badge)),  // skipped if badge is null
]
```
