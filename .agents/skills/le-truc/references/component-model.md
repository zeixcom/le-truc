# Component Model

**Overview:** The Le Truc component model, `defineComponent`, reactivity flow, and signal types re-exported from `@zeix/cause-effect`.

---

## `defineComponent` Factory

```typescript
defineComponent<P extends ComponentProps>(name, factory, extensions?)
```

| Argument | Type | Purpose |
|---|---|---|
| `name` | `string` | Tag name — lowercase, must contain hyphen |
| `factory` | `(context: FactoryContext<P>) => FactoryResult \| Falsy \| void` | Called at connect time; queries elements, calls `expose()`, calls effect helpers |
| `extensions` | `ComponentExtension[]` (optional) | Opt-in capabilities — see [Extensions](#extensions) |

### Factory Context Helpers

| Helper | Purpose |
|---|---|
| `first(selector, required?)` | Query single descendant; throws `MissingElementError` if `required` string given and no match |
| `all(selector, required?)` | Return `Memo<E[]>` backed by lazy `MutationObserver`; throws `MissingElementError` if `required` string given and no elements match |
| `host` | Component host element, typed as `HTMLElement & P` |
| `expose(props)` | Declare reactive properties — call once, imperatively, inside factory body |
| `watch(source, handler)` | Create and register a reactive effect descriptor |
| `on(target, type, handler, options?)` | Create and register an event listener descriptor |
| `pass(target, props)` | Create and register a slot-swap descriptor for a Le Truc child |
| `provideContexts(contexts)` | Create and register a context-provider descriptor |
| `requestContext(context, fallback)` | Return `Signal<T>` (backed by a `Slot`) for use inside `expose()` |

For a raw hand-authored `EffectDescriptor` not produced by any of the above (e.g. wrapping `IntersectionObserver`), register it via `watch(() => true, descriptor)` — `() => true` has no signal dependency, so the effect runs its setup once, on connect, and `watch()`'s internal `createEffect()` call registers the descriptor's returned cleanup for disconnect.

### Example

```typescript
defineComponent<MyProps>('my-component', ({ expose, first, host, on, watch }) => {
  // 1. Query descendants
  const button = first('button', 'Add a native <button> descendant.')
  const label = first('span.label')

  // 2. Declare reactive props
  expose({
    disabled: asBoolean(),
    label: asString(label?.textContent ?? button.textContent ?? ''),
  })

  // 3. Call effect helpers — each registers itself, no return needed
  on(button, 'click', () => { /* ... */ })
  watch('disabled', bindProperty(button, 'disabled'))
  if (label) watch('label', bindText(label)) // guard for optional element
})
```

`watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` register their descriptor in an ambient collector the moment they're called. Calling one of these helpers outside synchronous factory (or `each()` callback) execution — after an `await`, in a detached `setTimeout` — throws `NoActiveCollectorError` immediately, rather than silently doing nothing.

Explicit `return [...]` of the same descriptors still works (dual support in v2.3, deprecated as of v3.0).

---

## Extensions

`defineComponent`'s optional third argument is a `ComponentExtension[]`. Three are exported and opt-in — import and pass explicitly:

| Extension | Adds |
|---|---|
| `formAssociated()` | Form participation via `ElementInternals` — value sync, reset, state restore, `disabled`, native-parity host contract. Widens the factory context with `internals` |
| `formAssociatedCheckbox()` | Same host contract, keyed on `checked: boolean` instead of `value` — submits nothing when unchecked. Do not combine with `formAssociated()`: both declare `staticProps.formAssociated`, which throws `ExtensionCollisionError` in `DEV_MODE` |
| `observedAttributes(names)` | Re-runs the retained `Parser` for each named prop when its attribute mutates post-connect (still not the default — see Key Constraints below) |

```typescript
defineComponent('my-element', factory, [formAssociated()])
```

`ComponentExtension` contributes `staticProps`, `observedAttributes`, `reservedMembers`, and optional lifecycle hooks (`installOnPrototype`, `onConnect`, `onAttributeChanged`). `defineComponent()` folds every extension in the array once at class-definition time; `reservedMembers` and `observedAttributes` union across all extensions, so `expose()` throws `InvalidPropertyNameError` for a prop name any extension has reserved.

A fourth extension, `debug()`, is **not exported and never appears in this array**. `defineComponent()` appends it to every component automatically whenever the app is built with `DEV_MODE=true` — no source change needed, including for components you didn't write. It adds a reactive `debug: boolean` property, toggled from the browser's properties panel or `metaKey`+click. While `true`, `on()`/`pass()`/`watch()` firings pulse the host and, where the target is knowable (`on()`, `pass()`, or a `bind*`-backed `watch()` handler), mark it with a `data-le-truc-on`/`-pass`/`-watch` attribute and log one `console.debug()` entry. `debug` does nothing in production builds — the extension providing the property was never merged in, so setting it is a no-op, not just hidden. `debug` is a reserved prop name on every component in a `DEV_MODE` build, even ones that never touch `debug()` — `expose({ debug: ... })` throws in dev, works in prod.

---

## Key Constraints

- `expose()` **must** be called before any signal access that reads `host.propName`
- `defineComponent` doesn't register `observedAttributes` unless explicitly requested via `observedAttributes` extension
- Parsers in `expose()` called **once at connect time** — HTML authors configure via attributes in server-rendered markup
- Attribute changes after connect **are not re-parsed** — reactive state flows through property interface only
- Effect helpers register themselves when called — no `return` needed. Explicit `return [...]` of a `FactoryResult` (`Array<EffectDescriptor | FactoryResult | Falsy>`) still works but is deprecated; nested arrays are flattened and falsy values filtered, so the legacy `element && watch(...)` pattern still works too, but prefer `if (element) watch(...)` in new code

---

## Props Initializers in `expose()`

| Initializer Kind | Recognition | Behavior |
|---|---|---|
| Parser | Branded with `asParser()` | Called with `host.getAttribute(key)` at connect time; result becomes initial signal value |
| `MethodProducer` | Branded with `defineMethod()` | Function IS the method — installed as `host[key] = fn` |
| `Signal` | Any `Signal<T>` | Used directly as backing signal |
| Static value | Anything else (`string`, `number`, `boolean`, `[]`, ...) | Wrapped in `createState()` |
| `MemoCallback<T>` | `() => T` (unbranded thunk) | Wrapped in `createComputed()` — reactive derived value |

---

## `watch(source, handler | handlers)` — Reactive Effects

`watch` creates an `EffectDescriptor`, registers it automatically, and returns it (the return value is rarely used directly). Drives reactive effect from explicitly declared source — only source triggers re-runs.

```typescript
// String prop name — reads host.disabled
watch('disabled', bindProperty(button, 'disabled'))

// String prop name — custom handler
watch('value', value => { textbox.value = value })

// Signal source
watch(myMemo, bindText(el))

// Thunk source — all signals read inside tracked (pure phase)
watch(() => host.count * 2, bindText(el))

// Multiple sources (array) — handler receives array of values
watch(['a', 'b'], ([a, b]) => { /* ... */ })
```

### `SingleMatchHandlers<T>`

From `@zeix/cause-effect`, accepted as second argument in place of plain function:

```typescript
type SingleMatchHandlers<T> = {
  ok: (value: T) => MaybeCleanup
  err?: (error: Error) => MaybeCleanup
  nil?: () => MaybeCleanup
  stale?: () => MaybeCleanup  // Task only
}
```

`bindAttribute`, `bindStyle`, `dangerouslyBindInnerHTML` return `SingleMatchHandlers` — use directly as second argument to `watch`.

---

## `on(target, type, handler, options?)` — Event Listeners

`on` creates an `EffectDescriptor` and registers it automatically. Handler receives `(event, element)`.

```typescript
// Single element
on(button, 'click', (event, el) => {
  return { count: host.count + 1 }  // updates host in batch()
})

// Return void for side-effects only
on(input, 'input', () => { analytics.track('input') })

// Memo target — event delegation for bubbling events
on(allItems, 'click', (event, item) => {
  return { selectedId: item.dataset.id }
})
```

Returning `{ prop: value }` applies all entries to `host` in `batch()`. Returning `void` is no-op.

---

## Reactivity Flow

```
attribute at connect time
      ↓
   parser(attrValue)              ← called via expose() at connect time only
      ↓
   host.prop = parsed value       ← Signal<T> backed by a Slot

event handler or external set
      ↓
   host.prop = new value          ← Signal<T> backed by a Slot
      ↓
   watch(source, handler)         ← re-runs when source changes
      ↓
   handler(value)                 ← calls bind*(el) or custom logic
      ↓
   DOM update on target element
      ↓
   on(el, type, handler) fires
      ↓
   { prop: value } returned       ← or host.prop = value directly
      ↓
   signal.set(value) → watch re-runs
```

**Key timing:** Effects activate after all child custom elements in subtree are defined (or after 200ms timeout).

---

## `undefined` vs `null` from Effects

- `undefined` — restore original DOM value captured at setup time (not blank/null)
- `null` — not valid signal generic (`T extends {}`) — use fallback values or wrapper types

---

## Re-exported Signal Types

Le Truc re-exports full `@zeix/cause-effect` public API. Import from `@zeix/le-truc`:

```typescript
import {
  createState, createMemo, createSensor, createTask,
  createEffect, createScope, createSlot, createStore,
  createList, createCollection, deriveCollection,
  batch, untrack, unown, match,
  type State, type Memo, type Sensor, type Slot,
} from '@zeix/le-truc'
```

**Essential constraints:**
- All signal generics require `T extends {}` — no `null` or `undefined` in type parameter
- `createEffect` must be inside `createScope` or another effect
- Use wrapper types or sentinel values to represent absence
