# Effects

**Overview:** How to drive DOM updates in Le Truc. All helpers imported from `@zeix/le-truc`. Effects driven by `watch()`, called directly in the factory.

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
| Show/hide element | `bindVisible(el)` | `(value: T) => void` |
| Toggle CSS class | `bindClass(el, token)` | `(value: T) => void` |
| Toggle custom `:state()` pseudo-class | `bindState(internals, token)` | `(value: boolean) => void` |
| Set/remove attribute | `bindAttribute(el, name, allowUnsafe?)` | `SingleMatchHandlers<string \| boolean>` |
| Set inline style | `bindStyle(el, prop)` | `SingleMatchHandlers<string>` |
| Set innerHTML | `dangerouslyBindInnerHTML(el, options?)` | `SingleMatchHandlers<string>` |
| Attach event listener | `on(target, type, handler, options?)` | registers an `EffectDescriptor` |
| Bind Le Truc child prop | `pass(target, props)` | registers an `EffectDescriptor` |
| Per-element effects on Signal | `each(memo, callback)` | registers an `EffectDescriptor` |
| Sync keyed data to container children | `reconcile(container, template, source, bindItem)` | registers an `EffectDescriptor` |
| Register a hand-authored descriptor | `watch(() => true, descriptor)` | runs `descriptor` once on connect, registers its returned cleanup for disconnect |

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

**Map form:** `bindProperty(element, keys)` with an array of keys returns `(value: Partial<Pick<E, K>>) => void`. Patches only the keys present in the object — a missing key is left untouched, not cleared, since object properties have no "remove" operation. This differs from every other `bind*` helper's map form below.

```typescript
watch(
  () => ({ disabled: !host.ready, ariaBusy: String(!host.ready) }),
  bindProperty(button, ['disabled', 'ariaBusy']),
)
```

### `bindVisible(element)`

Returns `(value: T) => void`. Sets `element.hidden = !value`. `true` makes element visible.

```typescript
watch('loading', bindVisible(spinner))
watch(() => host.count > 0, bindVisible(clearBtn))  // thunk derives the boolean
```

### `bindClass(element, token)`

Returns `(value: T) => void`. Adds `token` when truthy, removes when falsy.

```typescript
watch('active', bindClass(item, 'active'))
watch(() => host.state === 'open', bindClass(el, 'is-open'))
```

**Map form:** `bindClass(element, tokens)` with an array of tokens returns `(value: Partial<Record<Tk, boolean>>) => void`. Toggles every declared token in one call — a token missing from the object is treated as falsy (removed), same coercion as the single-token form. No `nil` handling needed: an empty object already clears every declared token.

```typescript
watch(
  () => ({ selected: item.id === host.selectedId, disabled: item.disabled }),
  bindClass(item, ['selected', 'disabled']),
)
```

### `bindState(internals, token)`

Returns `(value: boolean) => void`. Adds `token` to `internals.states` when truthy, removes when falsy — consumer CSS matches with `:state(token)`. `null` internals (only possible if `attachInternals()` failed pre-upgrade) is a graceful no-op.

```typescript
watch('disabled', bindState(internals, 'disabled'))
watch('overflowEnd', bindState(internals, 'overflow-end'))
```

Prefer `bindState` over `bindClass(host, token)` for host-level state. Consumer code rewriting the host's `class` attribute cannot overwrite a custom state. It is also available on every component (`internals` is attached unconditionally), not only form-associated ones. `internals` comes from `FactoryContext` — destructure it alongside `watch`/`host`/etc.

**Map form:** `bindState(internals, tokens)` with an array of tokens returns `(value: Partial<Record<Tk, boolean>>) => void`. Same toggle-loop semantics as `bindClass`'s map form — a token missing from the object is treated as falsy. The `null`-internals no-op still applies.

```typescript
watch(
  () => ({ 'filter-active': filter === 'active', 'filter-completed': filter === 'completed' }),
  bindState(internals, ['filter-active', 'filter-completed']),
)
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

**Map form:** `bindAttribute(element, names, allowUnsafe?)` with an array of names returns `SingleMatchHandlers<Partial<Record<N, string | boolean>>>`. `ok(map)` sets/toggles every declared name (string → validated `setAttribute`, boolean → `toggleAttribute`); a name missing from the map (or `null`/`undefined`) is removed. `nil` removes every declared name.

```typescript
watch(
  () => ({ 'aria-expanded': String(open), 'aria-disabled': disabled }),
  bindAttribute(trigger, ['aria-expanded', 'aria-disabled']),
)
```

### `bindStyle(element, prop)`

Returns `SingleMatchHandlers<string>`. Pass directly to `watch`.

- `ok(string)` → `el.style.setProperty(prop, value)`
- `nil` → `el.style.removeProperty(prop)` — restores CSS cascade value

```typescript
watch('opacity', bindStyle(overlay, 'opacity'))
watch('accentColor', bindStyle(card, '--highlight-color'))
```

**Map form:** `bindStyle(element, props)` with an array of property names returns `SingleMatchHandlers<Partial<Record<P, string | null>>>`. `ok(map)` sets every declared property present and non-nil, removes the rest (missing or `null`/`undefined`). `nil` removes every declared property. Use this when one computed value drives several CSS custom properties at once, instead of one `watch()` call per property.

```typescript
watch(
  () => ({ '--gauge-color': color, '--gauge-degree': `${degree}deg` }),
  bindStyle(host, ['--gauge-color', '--gauge-degree']),
)
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

// Signal target — event delegation (bubbling events only)
on(allItems, 'click', (event, item) => ({ selectedId: item.dataset.id }))
```

`passive` set automatically for high-frequency events (scroll, resize, touch, wheel). For non-bubbling events with a Signal target, per-element listeners set up as fallback — prefer `each()` + `on()` instead.

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

For per-element effects on `Signal<E[]>` from `all()`. Elements enter/leave collection with own reactive scope.

```typescript
const items = all('[role="option"]')
each(items, item => {
  on(item, 'focus', () => ({ focusedId: item.id }))
  watch(() => host.selectedId === item.id, bindClass(item, 'selected'))
})
```

The callback's 2nd parameter is `first`, a type-safe, throwing lookup scoped to `item` instead of the host — same shape as the factory's own `first()`, minus dependency resolution for undefined custom elements. Use it instead of `item.querySelector()`.

The callback can call `watch()`, `on()`, `each()` (nested, to any depth), `pass()`, and `provideContexts()` directly — same as the factory itself — or return a single `EffectDescriptor` / `FactoryResult` array (legacy form, still supported).

### `reconcile(container, template, source, bindItem)`

Data-driven complement of `each()`: syncs a keyed `List<T>` or `Collection<T>` (from cause-effect) to a container's children. The component owns the container; entering keys clone the `<template>`'s single root element (stamped with `data-key`), leaving keys dispose their scope and are removed, survivors are moved — always reused. `bindItem(element, item, key, first)` is mounted once per entering element in its own scope (a returned cleanup runs on leave/disconnect) and does all content work; it also runs for server-rendered children adopted by `data-key` on first run, so keep it idempotent. Unkeyed and unmatched children are removed (self-cleaning); children with `data-unreconciled` are exempt entirely.

`bindItem`'s 4th parameter, `first`, is the same scoped lookup `each()`'s callback receives — pre-bound to `element`, throws `MissingElementError` with "in item ..." wording when required and missing. Use it instead of `element.querySelector()`.

```typescript
const container = first('[data-container]', 'Add a container element.')
const template = first('template', 'Add a template element for items.')
const list = createList<string>([], { keyConfig: 'item' })
reconcile(container, template, list, (element, item, _key, first) => {
  first('slot')?.replaceWith(document.createTextNode(item.get()))
})
on(form, 'submit', e => { e.preventDefault(); list.add(textbox.value.trim()) })
```

One-way sync, data → DOM: mutate the list in event handlers, never the container's children directly. Throws `InvalidTemplateError` if the template content doesn't have exactly one root element.

### `query(root, selector, required?)` and `queryAll(root, selector, required?)`

Standalone siblings of `first()`/`all()`, root-parameterized instead of host-bound. Use them for a lookup relative to an element you already have — inside `each()`/`bindItem` (when you need a second-level lookup beyond the scoped `first` parameter), or in a free-standing helper function called from an event handler, outside the factory body entirely:

```typescript
function getItemText(item: HTMLElement): string {
  return query(item, 'label.text, span')?.textContent?.trim() ?? 'item'
}
```

Same selector-to-type inference and `MissingElementError` behavior as `first()`/`all()`. `queryAll()` returns a plain array, queried once — never a `Signal`. Neither participates in dependency resolution for undefined custom elements; that guarantee is host-level `first()`/`all()` only.

### Hand-authored descriptors: `watch(() => true, descriptor)`

A hand-authored `EffectDescriptor` — a raw `() => MaybeCleanup` thunk not produced by `watch()`/`on()`/`pass()`/`each()`/`reconcile()`/`provideContexts()` — has no dedicated registration helper. For native APIs with their own setup/cleanup lifecycle, bind it to a constant thunk instead:

```typescript
watch(() => true, () => {
  const observer = new IntersectionObserver(([entry]) => {
    isVisible.set(entry.isIntersecting)
  })
  observer.observe(host)
  return () => observer.disconnect()
})
```

`() => true` has no signal dependency, so `deriveCell` evaluates it once and never reruns — the descriptor's setup runs exactly once, on connect. `watch()` calls `createEffect()` internally, which self-registers the descriptor's returned cleanup on the active owner, so it runs on disconnect. Without this wrapping (or `return`), a bare descriptor's cleanup never registers anywhere — `disconnectedCallback()` has no way to find it, so it silently never runs.

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
watch(() => Boolean(host.error), bindClass(input, 'error'))
```

---

## Statement Layout: Group by Concern

Order factory statements so each query sits next to the effect(s) that consume it. Do not hoist every query into one block at the top. A concern is one query plus the `on()`/`watch()`/`pass()`/`each()` call(s) that use it — keep each concern self-contained.

Exception: a query that seeds `expose()`'s initial value, or one shared by several concerns, stays hoisted near the top.

For an optional descendant, the query and its guard form one concern:

```typescript
const badge = first('span.badge') // may return null
if (badge) watch('count', bindText(badge)) // skipped if badge is null
```

`on()` and `pass()` also skip a falsy target on their own — an absent optional element makes the effect a no-op, with no throw and no stray listener.

`first()` and `all()` must run in the factory body, never inside a callback — this does not apply to `query()`/`queryAll()` or the scoped `first` passed to `each()`/`bindItem`, which never had dependency-resolution or Signal-liveness to lose. See "Querying Inside Effect or Event Callbacks" in `anti-patterns.md`.
