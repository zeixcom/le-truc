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
| `factory` | `(context: FactoryContext<P>) => FactoryResult` | Called at connect time; queries elements, calls `expose()`, returns effect descriptors |

### Factory Context Helpers

| Helper | Purpose |
|---|---|
| `first(selector, required?)` | Query single descendant; throws `MissingElementError` if `required` string given and no match |
| `all(selector, required?)` | Return `Memo<E[]>` backed by lazy `MutationObserver`; throws `MissingElementError` if `required` string given and no elements match |
| `host` | Component host element, typed as `HTMLElement & P` |
| `expose(props)` | Declare reactive properties — call once, imperatively, inside factory body |
| `watch(source, handler)` | Create reactive effect descriptor |
| `on(target, type, handler, options?)` | Create event listener descriptor |
| `pass(target, props)` | Create slot-swap descriptor for Le Truc child |
| `provideContexts(contexts)` | Create context-provider descriptor |
| `requestContext(context, fallback)` | Return `Memo<T>` for use inside `expose()` |

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

  // 3. Return effect descriptors (nested arrays OK, falsy guards filtered)
  return [
    on(button, 'click', () => { /* ... */ }),
    watch('disabled', bindProperty(button, 'disabled')),
    label && watch('label', bindText(label)),  // falsy guard for optional element
  ]
})
```

---

## Key Constraints

- `expose()` **must** be called before any signal access that reads `host.propName`
- Components always have `static observedAttributes = []`
- Parsers in `expose()` called **once at connect time** — HTML authors configure via attributes in server-rendered markup
- Attribute changes after connect **are not re-parsed** — reactive state flows through property interface only
- Factory result type: `FactoryResult` = `Array<EffectDescriptor | FactoryResult | Falsy>`
- Nested arrays flattened; falsy values filtered before activation — enabling `element && watch(...)` pattern

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

`watch` returns an `EffectDescriptor`. Drives reactive effect from explicitly declared source — only source triggers re-runs.

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

`on` returns an `EffectDescriptor`. Handler receives `(event, element)`.

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
