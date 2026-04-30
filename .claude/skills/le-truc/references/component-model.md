<overview>
The Le Truc component model: the factory form of `defineComponent`, the reactivity flow, and the signal types re-exported from `@zeix/cause-effect`.
</overview>

## `defineComponent` — factory form (v2.0)

```typescript
defineComponent<P extends ComponentProps>(name, factory)
```

| Argument | Type | Purpose |
|---|---|---|
| `name` | `string` | Tag name — lowercase, must contain a hyphen |
| `factory` | `(context: FactoryContext<P>) => FactoryResult` | Called at connect time; queries elements, calls `expose()`, returns effect descriptors |

The factory receives a `FactoryContext<P>` with these helpers:

| Helper | Purpose |
|---|---|
| `first(selector, required?)` | Query a single descendant; throws `MissingElementError` if `required` string is given and no match |
| `all(selector)` | Return a `Memo<E[]>` backed by a lazy `MutationObserver` |
| `host` | The component host element, typed as `HTMLElement & P` |
| `expose(props)` | Declare reactive properties — call once, imperatively, inside the factory body |
| `watch(source, handler)` | Create a reactive effect descriptor driven by a prop name, signal, or thunk |
| `on(target, type, handler, options?)` | Create an event listener descriptor |
| `pass(target, props)` | Create a slot-swap descriptor for a Le Truc child component |
| `provideContexts(contexts)` | Create a context-provider descriptor |
| `requestContext(context, fallback)` | Return a `Memo<T>` for use inside `expose()` |

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

  // 3. Return effect descriptors (nested arrays ok, falsy guards filtered)
  return [
    on(button, 'click', () => { /* ... */ }),
    watch('disabled', bindProperty(button, 'disabled')),
    label && watch('label', bindText(label)),  // falsy guard for optional element
  ]
})
```

**Key constraints:**
- `expose()` must be called before any signal access that reads `host.propName`
- Components always have `static observedAttributes = []`. Parsers in `expose()` are called **once at connect time** — HTML authors configure via attributes in server-rendered markup, but attribute changes after connect are not re-parsed. Reactive state flows through the property interface only.
- The factory result type is `FactoryResult` = `Array<EffectDescriptor | FactoryResult | Falsy>`. Nested arrays are flattened. Falsy values (`false`, `null`, `undefined`, `''`, `0`) are filtered before activation — enabling the `element && watch(...)` conditional pattern.

## Props initializers in `expose()`

| Initializer kind | How to recognize | Behavior |
|---|---|---|
| Parser | Branded with `asParser()` | Called with `host.getAttribute(key)` at connect time; result becomes the initial signal value |
| `MethodProducer` | Branded with `defineMethod()` | The function IS the method — installed as `host[key] = fn` |
| `Signal` | Any `Signal<T>` | Used directly as the backing signal |
| Static value | Anything else (`string`, `number`, `boolean`, `[]`, …) | Wrapped in `createState()` |
| `MemoCallback<T>` | `() => T` (unbranded thunk) | Wrapped in `createComputed()` — reactive derived value |

Note: There is no `Reader` type in v2.0. Read initial DOM values directly before calling `expose()`:

```typescript
expose({
  count: asInteger(parseInt(countEl.textContent || '0') || 0),
  value: textbox.value,
  label: asString(labelEl?.textContent ?? ''),
})
```

## `watch(source, handler | handlers)` — reactive effects

`watch` returns an `EffectDescriptor`. It drives a reactive effect from an explicitly declared source — only the source triggers re-runs, not incidental reads inside the handler.

```typescript
// String prop name — reads host.disabled
watch('disabled', bindProperty(button, 'disabled'))

// String prop name — custom handler
watch('value', value => {
  textbox.value = value
})

// Signal source
watch(myMemo, bindText(el))

// Thunk source — all signals read inside are tracked (pure phase)
watch(() => host.count * 2, bindText(el))

// SingleMatchHandlers for nil/err/stale branches
watch('href', bindAttribute(link, 'href'))  // bindAttribute returns SingleMatchHandlers<string | boolean>

// Multiple sources (array) — handler receives array of values
watch(['a', 'b'], ([a, b]) => { /* ... */ })
```

`SingleMatchHandlers<T>` (from `@zeix/cause-effect`) is accepted as the second argument in place of a plain function:
```typescript
type SingleMatchHandlers<T> = {
  ok: (value: T) => MaybeCleanup
  err?: (error: Error) => MaybeCleanup
  nil?: () => MaybeCleanup
  stale?: () => MaybeCleanup  // Task only: signal re-computing with retained value
}
```

`bindAttribute`, `bindStyle`, and `dangerouslyBindInnerHTML` return `SingleMatchHandlers` — use them directly as the second argument to `watch`.

## `on(target, type, handler, options?)` — event listeners

`on` returns an `EffectDescriptor`. The handler receives `(event, element)`.

```typescript
// Single element
on(button, 'click', (event, el) => {
  return { count: host.count + 1 }  // updates host in a batch()
})

// Return void for side-effects only
on(input, 'input', () => {
  analytics.track('input')
})

// Memo target — event delegation for bubbling events
on(allItems, 'click', (event, item) => {
  return { selectedId: item.dataset.id }
})
```

Returning `{ prop: value }` applies all entries to `host` in a `batch()`. Returning `void` is a no-op.

## Reactivity flow

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

Key timing: effects activate after all child custom elements in the subtree are defined (or after a 200ms timeout).

## `undefined` vs `null` from effects

- `undefined` — restore the original DOM value captured at setup time (not blank/null)
- `null` — not a valid signal generic (`T extends {}`) — use fallback values or wrapper types

## Re-exported signal types

Le Truc re-exports the full `@zeix/cause-effect` public API. Import everything from `@zeix/le-truc`:

```typescript
import {
  createState, createMemo, createSensor, createTask,
  createEffect, createScope, createSlot, createStore,
  createList, createCollection, deriveCollection,
  batch, untrack, unown, match,
  type State, type Memo, type Sensor, type Slot,
} from '@zeix/le-truc'
```

For detailed signal type guidance, use the `cause-effect` skill. Essential constraints:
- All signal generics require `T extends {}` — no `null` or `undefined` in the type parameter
- `createEffect` must be inside a `createScope` or another effect
- Use wrapper types or sentinel values to represent absence
