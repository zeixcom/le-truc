# Le Truc — Migration Report: v1.x → v2.0

> Scope: Changes listed in CHANGELOG.md `[Unreleased]` section. Evaluated against
> the initial design intent documented in REQUIREMENTS.md.

---

## 1. What are the breaking changes?

### 1.1 `defineComponent()` signature — 4-parameter → 2-parameter factory form

**Old:**
```ts
defineComponent<P, U>(name, props, select, setup)
// props: property initializers (run at definition time, shared)
// select: (elementQueries) => UI (runs once per connect)
// setup: (ui) => Effects<P, U> (returns keyed effect object)
```

**New:**
```ts
defineComponent<P>(name, factory)
// factory: (FactoryContext<P>) => FactoryResult | void
// FactoryContext contains: first, all, host, expose, watch, on, pass,
//                          provideContexts, requestContext
```

Everything that was split across three arguments (`props`, `select`, `setup`) now lives inside a single factory closure. Properties are declared with `expose({ ... })`, queries with `first()` / `all()`, and effects are returned as a flat `FactoryResult` array.

### 1.2 `Parser<T>` signature simplified

**Old:**
```ts
type Parser<T, U extends UI> = (ui: U, value: string | null | undefined, old?: string | null) => T
```

**New:**
```ts
type Parser<T> = (value: string | null | undefined) => T
```

The `ui` context parameter and the `old` (previous attribute value) parameter are gone. Built-in parsers (`asInteger`, `asNumber`, `asBoolean`, `asString`, `asEnum`, `asJSON`, `asDate`) all updated accordingly. Custom parsers that read from `ui` must be rewritten to capture their dependencies from the factory closure instead.

### 1.3 Parsers are now call-once — no reactive attribute sync

**This is the most consequential semantic change.** In v1, parsers were listed in `static observedAttributes` so `attributeChangedCallback` re-ran the parser on every attribute mutation. In v2, `static observedAttributes = []` is always empty. Parsers run exactly once, at `connectedCallback` time, to read server-side-authored HTML attributes.

This is intentional (documented in CLAUDE.md) but it deviates from **REQUIREMENTS.md M3**, which says:

> "Properties declared with a Parser function are automatically added to `observedAttributes`. When the corresponding HTML attribute changes, the parser transforms the string value into a typed JS value and updates the signal. **Parsers serve dual duty: initial value from the attribute at connect time, and live sync on subsequent attribute changes.**"

The design has been consciously narrowed: attribute values drive state only at connect time. Post-connect state changes must use event handlers, `watch()`, or direct property writes. This is a model simplification, but it is a semantic regression from the documented requirement.

### 1.4 Effect factory functions removed — replaced by `watch()` + `bind*` helpers

Every v1 standalone effect factory is gone:

| v1 (removed) | v2 replacement |
|---|---|
| `setText(el, reactive)` | `watch(source, bindText(el))` |
| `setAttribute(el, name, reactive)` | `watch(source, bindAttribute(el, name))` |
| `toggleAttribute(el, name, reactive)` | `watch(source, bindAttribute(el, name))` with boolean |
| `toggleClass(el, token, reactive)` | `watch(source, bindClass(el, token))` |
| `setProperty(el, key, reactive)` | `watch(source, bindProperty(el, key))` |
| `setStyle(el, prop, reactive)` | `watch(source, bindStyle(el, prop))` |
| `show(el, reactive)` | `watch(source, bindVisible(el))` |
| `dangerouslyBindInnerHTML(el, reactive)` | `watch(source, dangerouslyBindInnerHTML(el))` |
| `on(el, type, handler)` | `on(el, type, handler)` (factory context method) |
| `pass(el, props)` | `pass(el, props)` (factory context method) |

### 1.5 `Reader<T, H>` type removed

Readers were one-argument functions that received the UI object and returned an initial value. They are now replaced by either a plain thunk `() => value` captured in the factory closure, or a `Signal<T>` passed directly to `expose()`.

### 1.6 `provideContexts()` and `requestContext()` are now `FactoryContext` methods

In v1, `provideContexts([...])` was called as a `MethodProducer` inside `props` (wrapped with `defineMethod()`). In v2, `provideContexts([...])` is called inside the factory body and its return value (an `EffectDescriptor`) is included in the return array. `requestContext(ctx, fallback)` is called inside `expose()` and returns a `Memo<T>` for use as a property initializer.

### 1.7 Removed types and error classes

| Removed | Reason |
|---|---|
| `Effects<P, U>`, `Effect<P, E>`, `ElementEffects<P, E>`, `ElementUpdater<E, T>` | Superseded by `EffectDescriptor` |
| `Reader<T, H>`, `LooseReader<T>`, `Fallback<T>`, `ParserOrFallback<T>`, `isReader()`, `read()` | Factory closure replaces these patterns |
| `ComponentSetup<P, U>`, `ComponentUI<P, U>`, `Component<P>`, `UI` | Factory pattern makes them unnecessary |
| `InvalidEffectsError`, `InvalidUIKeyError`, `InvalidPropertyNameError` | Effect validation and property validation simplified |
| `runEffects()`, `getHelpers()` public exports | Internal implementation details, no longer part of public API |

---

## 2. Why do these changes make sense?

### 2.1 Factory form: per-instance initialization

The 4-parameter form had an architectural asymmetry: `props` was defined once at class-creation time (not per-instance) while `select` and `setup` ran per-connect. This made dynamic, per-instance initialization impossible without workarounds. The factory form runs entirely inside `connectedCallback`, so every initialization — including element queries, property defaults, and effect setup — has access to the live component instance.

### 2.2 Factory form: eliminates the `U extends UI` generic

The `UI` generic propagated through `Parser<T, U>`, `Reader<T, U>`, `Fallback<T, U>`, `ComponentSetup<P, U>`, `ComponentUI<P, U>`, `Initializers<P, U>`, and every effect factory. Removing it dramatically simplifies the type surface. Parsers never needed the UI object in practice — they only used it to access fallbacks captured in `Fallback<T, U>`. Those fallbacks are now just ordinary closure variables.

### 2.3 `watch()` + `bind*`: explicit reactive sources

In v1, effect factories (`setText`, `setAttribute`, etc.) took a `Reactive` value and internally created an effect. The source of reactivity was implicit inside each effect function. In v2, `watch(source, handler)` makes the reactive source explicit and declarative — a single consistent mental model regardless of which DOM property is being updated. The `bind*` helpers are not effects; they're handler factories. This separation is conceptually cleaner and more composable.

### 2.4 `bind*` naming is accurate

The `bind` prefix signals "this returns a handler that connects a source to a target." The old `set*` names were misleading because they didn't set anything when called; they returned an effect factory. `bind*` more accurately describes the factory nature. The pattern is consistent: `watch(source, bind*(element, ...))`.

### 2.5 Parser simplification removes unused parameters

The `old` (previous attribute value) parameter in v1 parsers was never used by any built-in parser and was only available because `attributeChangedCallback` provides it. Since parsers now run only once and `attributeChangedCallback` no longer fires, both the `ui` and `old` parameters are correctly removed.

### 2.6 `EffectDescriptor` = deferred composition

The flat `EffectDescriptor[]` return model (vs. the old keyed `Effects` object) enables conditional effects with the `element && descriptor()` pattern, works naturally with array spread, and makes the activation boundary explicit: descriptors run after dependency resolution, not immediately when the factory runs.

---

## 4. New concepts to explain in documentation

### 4.1 The factory function and its lifecycle

The factory is called at `connectedCallback` time — not at module load time and not once per class. This means:
- Closure variables are per-instance, not per-class.
- If the component is disconnected and reconnected, the factory runs again with a fresh closure.
- `host` inside the factory is the live element instance, already in the DOM.

Communicate clearly: the factory is the component's setup phase, not its constructor.

### 4.2 `expose()` — declaring reactive properties at connect time

`expose()` must be called before effects reference any property by name. Property names passed to `expose()` become reactive signal-backed accessors on `host`. Keys not passed to `expose()` are plain non-reactive properties.

Contrast with v1: props were defined at class-definition time (second argument). In v2 they're defined per-connect inside the factory.

### 4.3 `EffectDescriptor` — deferred effects

An `EffectDescriptor` is a thunk `() => MaybeCleanup`. It is **not** executed immediately when the factory runs. It is queued and executed after all child custom element dependencies are resolved. Effects always run inside a reactive scope (`createScope`), so cleanup is automatic on disconnect.

Explain the conditional pattern: `element && watch('prop', bindText(element))` — if `element` is `null` (optional query), the `&&` short-circuits to `false`, which is filtered from the result array.

### 4.4 `watch(source, handler)` — explicit reactive sources

`watch` drives a DOM update from exactly one declared source. Reads inside the handler are **not tracked** (wrapped with `untrack`). This is the opposite of `createEffect` where all reads are tracked. Authors must explicitly choose the reactive source.

Multi-source form: `watch([source1, source2], ([v1, v2]) => ...)` — all sources are tracked together.

### 4.5 `bind*` helpers — not effects, but handler factories

`bindText(el)`, `bindProperty(el, key)`, etc. return functions (or `WatchHandlers<T>` objects). They are not effects themselves — they must be passed to `watch()`. A common mistake: `bindText(el)` alone does nothing; you need `watch(source, bindText(el))`.

`bindAttribute` and `bindStyle` return `WatchHandlers<T>` (with `ok`/`nil` branches) because `nil` has meaningful semantics (remove attribute, restore CSS cascade). `bindText`, `bindProperty`, `bindClass`, `bindVisible` return plain functions because `nil` has no useful behavior there.

### 4.6 Parsers are call-once, not live-sync

Parsers are for reading server-rendered HTML attribute values at connect time. They are **not** triggered by subsequent attribute mutations (unlike v1). This is the most important behavioral shift for authors migrating existing components that relied on attribute-driven reactivity.

---

## 5. Practical migration steps

### Step 1: Change `defineComponent` signature

```ts
// Before (v1)
defineComponent<MyProps, MyUI>(
  'my-element',
  { count: asInteger() },
  ({ first }) => ({ button: first('button') }),
  ({ host, button }) => ({
    button: {
      click: on(button, 'click', () => ({ count: host.count + 1 })),
      text: setText(button, 'count'),
    }
  }),
)

// After (v2)
defineComponent<MyProps>('my-element', ({ first, host, expose, watch, on }) => {
  const button = first('button')
  expose({ count: asInteger() })
  return [
    on(button, 'click', () => ({ count: host.count + 1 })),
    watch('count', bindText(button)),
  ]
})
```

### Step 2: Move `props` into `expose()`

| v1 pattern (second arg) | v2 equivalent (inside factory) |
|---|---|
| `{ value: asString() }` | `expose({ value: asString() })` |
| `{ value: 'default' }` | `expose({ value: 'default' })` |
| `{ value: someSignal }` | `expose({ value: someSignal })` |
| `{ clear: asMethod(() => ...) }` | `expose({ clear: asMethod(() => ...) })` |

### Step 3: Migrate custom Parsers

Remove the `ui` and `old` parameters; capture needed values from the factory closure instead:

```ts
// Before (v1)
const myParser = asParser((ui: MyUI, value) => value ?? ui.input.value)

// After (v2) — capture the element from the factory closure
const input = first('input') as HTMLInputElement
expose({ value: asParser(v => v ?? input.value) })
```

### Step 4: Migrate Readers

Readers (`(ui) => T`) are gone. Replace with a thunk `() => value` passed to `expose()`:

```ts
// Before (v1)
{ value: (ui: MyUI) => ui.input.value }

// After (v2)
const input = first('input') as HTMLInputElement
expose({ value: () => input.value })
```

### Step 5: Migrate effect factories

Replace each `set*` / `toggle*` call with `watch(source, bind*(element, ...))`:

```ts
// Before (v1) — inside setup(), keyed by element name
{
  label: {
    text: setText(label, 'count'),
    attr: setAttribute(label, 'data-count', 'count'),
  }
}

// After (v2) — flat array in return
return [
  watch('count', bindText(label)),
  watch('count', bindAttribute(label, 'data-count')),
]
```

### Step 6: Migrate `on()` and `pass()`

`on()` and `pass()` are now factory context methods — call them directly and return their result:

```ts
// Before (v1)
{ button: { click: on(button, 'click', handler) } }

// After (v2)
return [on(button, 'click', handler)]
```

### Step 7: Migrate context usage

```ts
// Before (v1)
{
  theme: requestContext(THEME_CONTEXT, 'light'),
},
undefined, // UI
() => ({
  host: provideContexts([MY_CONTEXT])
})

// After (v2)
expose({
  theme: requestContext(THEME_CONTEXT, 'light'), // inside expose()
})
return [
  provideContexts([MY_CONTEXT]), // in return array
]
```

### Step 8: Update TypeScript generics

Remove all `U extends UI` type parameters from custom parsers, readers, and helpers. The `UI` type is no longer exported. The `<P, U>` double generic on `defineComponent` becomes `<P>` only.
