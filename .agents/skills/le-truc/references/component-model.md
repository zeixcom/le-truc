# Component Model

**Overview:** The Le Truc component model — factory form of `defineComponent`, reactivity flow, and signal types re-exported from `@zeix/cause-effect`.

---

## `defineComponent` — Factory Form (v2.0)

```typescript
defineComponent<P extends ComponentProps>(name, factory)
```

| Argument | Type | Purpose |
|---|---|---|
| `name` | `string` | Tag name — lowercase, must contain hyphen |
| `factory` | `(context: FactoryContext<P>) => FactoryResult \| Falsy \| void` | Called at connect time; queries elements, calls `expose()`, calls effect helpers |

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
  if (label) watch('label', bindText(label))  // guard for optional element
})
```

`watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` register their descriptor in an ambient collector the moment they're called — the factory doesn't collect or return anything. Calling one of these helpers outside synchronous factory (or `each()` callback) execution — after an `await`, in a detached `setTimeout` — throws `NoActiveCollectorError` immediately, rather than silently doing nothing.

Explicit `return [...]` of the same descriptors still works (dual support in v2.3, deprecated as of v3.0) — see ADR 0018.

---

## Key Constraints

- `expose()` **must** be called before any signal access that reads `host.propName`
- `defineComponent` never registers `observedAttributes` — `attributeChangedCallback` support was dropped entirely in v2.0
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

**Note:** No `Reader` type in v2.0. Read initial DOM values directly before `expose()`:

```typescript
expose({
  count: asInteger(parseInt(countEl.textContent || '0') || 0),
  value: textbox.value,
  label: asString(labelEl?.textContent ?? ''),
})
```

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
