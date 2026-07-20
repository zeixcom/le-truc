# Effects

**Overview:** How to drive DOM updates in Le Truc v2.3. All helpers imported from `@zeix/le-truc`. Effects driven by `watch()`, called directly in the factory — it registers itself, no `return` needed.

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
| Toggle custom `:state()` pseudo-class | `bindState(internals, token)` | `(value: boolean) => void` |
| Set/remove attribute | `bindAttribute(el, name, allowUnsafe?)` | `SingleMatchHandlers<string \| boolean>` |
| Set inline style | `bindStyle(el, prop)` | `SingleMatchHandlers<string>` |
| Set innerHTML | `dangerouslyBindInnerHTML(el, options?)` | `SingleMatchHandlers<string>` |
| Attach event listener | `on(target, type, handler, options?)` | registers an `EffectDescriptor` |
| Bind Le Truc child prop | `pass(target, props)` | registers an `EffectDescriptor` |
| Per-element effects on Memo | `each(memo, callback)` | registers an `EffectDescriptor` |
| Register a hand-authored descriptor | `run(descriptor)` | registers a raw `EffectDescriptor` not produced by any helper |

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

### `bindState(internals, token)`

Returns `(value: boolean) => void`. Adds `token` to `internals.states` when truthy, removes when falsy — consumer CSS matches with `:state(token)`. `null` internals (only possible if `attachInternals()` failed pre-upgrade) is a graceful no-op.

```typescript
watch('disabled', bindState(internals, 'disabled'))
watch('overflowEnd', bindState(internals, 'overflow-end'))
```

Prefer `bindState` over `bindClass(host, token)` for host-level state: a custom state can't be clobbered by consumer code rewriting the host's `class` attribute, and it's available on every component (`internals` is attached unconditionally), not only form-associated ones. `internals` comes from `FactoryContext` — destructure it alongside `watch`/`host`/etc.

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

Creates and registers an `EffectDescriptor`. Handler receives `(event, element)`.

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
each(items, item => {
  on(item, 'focus', () => ({ focusedId: item.id }))
  watch('selectedId', bindClass(item, 'selected', id => id === item.id))
})
```

The callback can call `watch()`, `on()`, `each()` (nested, to any depth), `pass()`, and `provideContexts()` directly — same as the factory itself — or return a single `EffectDescriptor` / `FactoryResult` array (legacy form, still supported).

### `run(descriptor)`

Registers a hand-authored `EffectDescriptor` — a raw `() => MaybeCleanup` thunk not produced by `watch()`/`on()`/`pass()`/`each()`/`provideContexts()`. Use it for native APIs with their own setup/cleanup lifecycle:

```typescript
run(() => {
  const observer = new IntersectionObserver(([entry]) => {
    isVisible.set(entry.isIntersecting)
  })
  observer.observe(host)
  return () => observer.disconnect()
})
```

Without `run()` (or `return`), a bare descriptor's cleanup never registers anywhere — `disconnectedCallback()` has no way to find it, so it silently never runs.

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

Call each helper directly — order doesn't matter:

```typescript
watch('value', bindProperty(input, 'value'))
watch('disabled', bindProperty(input, 'disabled'))
watch('error', bindClass(input, 'error', Boolean))
```

---

## Conditional Effects for Optional Descendants

```typescript
const badge = first('span.badge')  // may return null

if (badge) watch('count', bindText(badge))  // skipped if badge is null
```
