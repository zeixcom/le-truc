# Architecture

Le Truc is a reactive custom elements library. This document describes how the pieces in `src/` fit together.

## File Map

```
src/
  component.ts        The heart: defineComponent() and the Truc class
  effects.ts          Effect orchestration: runEffects, updateElement
  ui.ts               DOM queries (first/all), dependency resolution, selector type inference
  parsers.ts          Parser/Reader type system and composition
  events.ts           Event-driven sensor factory (createEventsSensor)
  context.ts          Context protocol (provide/request) for dependency injection
  scheduler.ts        rAF-based task deduplication
  errors.ts           Domain-specific error classes
  internal.ts         Internal signal map (getSignals) — shared by component.ts and pass.ts
  util.ts             Logging, element introspection, property validation

  effects/
    attribute.ts      setAttribute, toggleAttribute
    class.ts          toggleClass
    event.ts          on() — event listener effect
    html.ts           dangerouslySetInnerHTML
    pass.ts           pass() — inter-component reactive property binding
    property.ts       setProperty, show
    style.ts          setStyle
    text.ts           setText

  helpers.ts          bind* convenience handlers for use with watch()

  parsers/
    boolean.ts        asBoolean
    json.ts           asJSON
    number.ts         asInteger, asNumber
    string.ts         asString, asEnum
```

## Dependency Graph

Arrows mean "imports from". The graph flows bottom-up from leaf utilities to `component.ts`.

```
util.ts ─────────────────────────────────────────────┐
errors.ts ──────── util.ts                           │
scheduler.ts ──── (leaf, no internal imports)        │
parsers.ts ─────── ui.ts (types only)                │
parsers/* ──────── parsers.ts, ui.ts (types)         │
                                                     │
internal.ts ────── (leaf, signal storage)            │
ui.ts ──────────── errors.ts, util.ts                │
                                                     │
effects.ts ─────── component.ts (types), errors.ts,  │
                   ui.ts, util.ts                    │
                                                     │
effects/* ──────── component.ts (types), effects.ts  │
                   + scheduler.ts, util.ts, etc.     │
                                                     │
events.ts ──────── component.ts (types), parsers.ts, │
                   scheduler.ts, ui.ts               │
                                                     │
context.ts ─────── component.ts (types), parsers.ts, │
                   ui.ts                             │
                                                     │
component.ts ───── effects.ts, errors.ts, parsers.ts,│
                   ui.ts, util.ts                    │
```

The single external dependency is `@zeix/cause-effect`, which provides the reactive primitives used by Le Truc: `createState`, `createComputed`, `createEffect`, `createMemo`, `createScope`, `createSensor`, `createSlot`, `createTask`, `createStore`, `createList`, `createCollection`, `Signal`, `Memo`, `Sensor`, `Slot`, `batch`, `match`, `unown`, `untrack`, and various type guards and utility functions. See `index.ts` for the full re-export surface.

## The Component Lifecycle

`defineComponent` has two overloads. Both create a class `Truc extends HTMLElement`, register it via `customElements.define()`, and return the class.

- **2-param factory form v1.1** `(name, factory)` *(current)*: the factory receives a `FactoryContext` with `{ all, each, expose, first, host, on, pass, provideContexts, requestContext, watch }`. It calls `expose({ ... })` for reactive props and returns a flat `FactoryResult` array of effect descriptors. `static observedAttributes = []` — parsers in `expose()` are called once at connect time but `attributeChangedCallback` never fires. See the v1.1 Specification section below for full details.
- **4-param form** `(name, props, select, setup)` *(@deprecated)*: `props` is evaluated at class-definition time; parsers in `props` auto-populate `static observedAttributes`. Still the right choice when attribute changes on a live document must drive reactive updates.

### connectedCallback — initialization

```
connectedCallback()
  │
  ├─ 1. getHelpers(this)  →  [{ first, all }, resolveDependencies]
  │     Determines query root (shadowRoot ?? this).
  │     Tracks custom element dependencies found during queries.
  │
  ├─ 2a. [v1.1 factory form]
  │       context = { first, all, host, expose, watch, each, on, pass, ... }
  │       descriptors = factory(context)       ← expose() called inside; signals created
  │       (if expose() not called, ui = { host } is set automatically)
  │
  ├─ 2b. [4-param form — @deprecated]
  │       ui = { ...select({ first, all }), host }  (frozen)
  │       #initSignals(ui, props)
  │
  │  #initSignals dispatches per initializer:
  │     ├─ Parser (PARSER_BRAND)?   →  parser(ui, this.getAttribute(key))
  │     ├─ MethodProducer (METHOD_BRAND)?  →  methodProducer(ui)
  │     ├─ Function (1 arg)?        →  reader(ui)
  │     └─ Otherwise                →  use value directly (static or Signal)
  │     Each non-null result is passed to #setAccessor(key, value).
  │
  └─ 3. resolveDependencies(() => {
           [v1.1 factory] this.#cleanup = createScope(() => descriptors.filter(Boolean).forEach(d => d()))
           [4-param form] this.#cleanup = runEffects(ui, setup(ui))
         })
         Waits for child custom elements to be defined (200ms timeout),
         then activates effects.
```

### #setAccessor — signal creation

Takes a key and a value and creates the appropriate signal:

- Already a `Signal` → use directly
- A function → `createComputed(fn)` (read-only)
- Anything else → `createState(value)` (read-write)

For mutable signals, the value is wrapped in a `createSlot(signal)` — a Slot from `@zeix/cause-effect` that acts as an indirection layer. The Slot's `get`/`set` are used as the property descriptor on the component instance, which is what makes `host.count` reactive. Reading calls `signal.get()` inside effects, registering the dependency automatically.

The Slot enables signal swapping: if `#setAccessor` is called again for an existing key (e.g., via `attributeChangedCallback`), it calls `slot.replace(newSignal)` instead of redefining the property. This is also the mechanism used by `pass()` to inject parent signals into a child component.

### attributeChangedCallback — attribute sync

Factory-form components have `static observedAttributes = []` — this callback never fires for them. For 4-param components, only fires for properties whose initializer `isParser` (branded with `PARSER_BRAND`); these are collected into `static observedAttributes` at class creation time.

When an attribute changes: parse the new value through the parser, then assign it to the component property (which triggers `signal.set()`). Computed (read-only) signals are skipped.

### disconnectedCallback — cleanup

Calls the cleanup function returned by `runEffects()`, which tears down all effects and event listeners.

## The Effect System

### How `runEffects` works

`runEffects(ui, effects)` is the top-level orchestrator (internal, not publicly exported). It creates a `createScope()` that owns all child effects for the component. For each key in the effects record:

- **`Memo` (from `all()`)**: Wraps a `createEffect()` around the loop. Reading `memo.get()` tracks the collection as a dependency, so when elements are added/removed the effect re-runs. The ownership graph automatically disposes inner per-element effects on re-run.
- **Single `Element` (from `first()`)**: Runs the effect functions directly inside the scope (no wrapping effect needed since the target is static).

### updateElement — the shared abstraction

Every built-in effect (`setAttribute`, `toggleClass`, `setText`, `setProperty`, `setStyle`, `toggleAttribute`, `dangerouslySetInnerHTML`, `show`) follows the same pattern via `updateElement(reactive, updater)`:

```
updateElement(reactive, { op, name, read, update, delete? })
  │
  ├─ Captures fallback = read(target)     ← current DOM value
  │
  └─ createEffect(() => {
       value = resolveReactive(reactive)   ← auto-tracks signal deps
       if value === undefined → use fallback (error in reader, or prop missing)
       if value === null      → delete(target) if available, else use fallback
       if value !== current   → update(target, value)
     })
```

The `Reactive<T>` type is a union of three forms:
- `keyof P` — a string property name on the host (reads `host[name]`)
- `Signal<T>` — a signal (calls `.get()`)
- `(target: E) => T` — a reader function

`resolveReactive()` handles all three and returns the concrete value. Because it calls `.get()` inside a `createEffect`, signal dependencies are automatically tracked.

### Built-in effects at a glance

| Effect | Op | What it does |
|---|---|---|
| `setAttribute(name, reactive?)` | `a` | Sets an attribute with URL safety validation |
| `toggleAttribute(name, reactive?)` | `a` | Boolean attribute: present when truthy |
| `toggleClass(token, reactive?)` | `c` | Adds/removes a CSS class |
| `setText(reactive)` | `t` | Replaces non-comment child nodes with a text node |
| `setProperty(key, reactive?)` | `p` | Sets a DOM property directly |
| `show(reactive)` | `p` | Controls `el.hidden` |
| `setStyle(prop, reactive?)` | `s` | Sets/removes an inline style |
| `dangerouslySetInnerHTML(reactive, opts?)` | `h` | Sets innerHTML, optionally in a shadow root |

All default their `reactive` parameter to the effect name (e.g., `setAttribute('href')` reads `host.href`).

### on() — event listener effect

**v1.1 (current)**: `on(target, type, handler, options?)` from `FactoryContext` — takes an explicit target element or `Memo<Element[]>`, returns an `EffectDescriptor`. The handler receives `(event, element)`. For `Memo` targets, uses event delegation. Returns a partial property update object `{ prop: value }` to batch-update host. See the v1.1 Specification section for full details.

**v1.0 (@deprecated)**: `on(type, handler, options?)` in `src/effects/event.ts` — target-less form used in the `effects` record. Calls `createScope()` for proper disposal and attaches a listener to the target element (passed implicitly by `runEffects`).

### pass() — inter-component binding

**v1.1 (current)**: `pass(target, props)` from `FactoryContext` — takes an explicit target element or `Memo<Component<Q>[]>`, returns an `EffectDescriptor`.

**v1.0 (@deprecated)**: `pass(props)` in `src/effects/pass.ts` — target-less form used in the `effects` record.

Both forms implement the same signal-swapping mechanism: calls `createScope()` for proper cleanup and directly swaps the backing signal of a descendant component's Slot, creating a zero-overhead live binding. It uses `getSignals(target)` to access the child's internal signal map, captures `slot.current()` before replacing, then calls `slot.replace(signal)`. The cleanup restores the original signal with `slot.replace(original)` when the parent disconnects.

This is more efficient than `setProperty()` for Le Truc targets: it eliminates the intermediate `createEffect` and property-assignment overhead on every reactive update. The parent and child share the exact same underlying signal node.

**Scope is Le Truc components only.** For non-Le Truc custom elements (Lit, Stencil, FAST, etc.), use `setProperty()` instead. Installing a reactive getter via `Object.defineProperty` bypasses those frameworks' own change-detection cycles — the foreign component's render/update is never triggered when the signal changes, because it only fires when a value is *set* through the framework's setter, not when the property is *read*. `setProperty()` goes through the public setter and is always correct for any element.

## The UI Query System

`getHelpers(host)` returns `[{ first, all }, resolveDependencies]`.

### first(selector, required?)

Calls `root.querySelector()`. If the matched element is an undefined custom element, its tag name is added to the dependency set. Returns the element or `undefined` (throws `MissingElementError` if `required` is provided and element is missing).

### all(selector, required?)

Returns a `Memo<E[]>` created by `createElementsMemo()`. This sets up a `MutationObserver` (lazily, via the `watched` option on `createMemo`) that watches for `childList`, `subtree`, and relevant attribute changes. The memo always contains the current matching elements; added/removed diffs are derived downstream by the owning `createEffect` in `runEffects`.

The `MutationObserver` config is smart about which attributes to watch: `extractAttributes(selector)` parses the CSS selector to find attribute names implied by `.class`, `#id`, and `[attr]` patterns.

**Mutation filtering**: The observer's callback uses a `couldMatch` helper that checks `node.matches(selector)` and `node.querySelector(selector)` on added/removed nodes. This prevents spurious invalidations from mutations *inside* matched elements (e.g., `innerHTML` changes on a `button[role="option"]` that add/remove `<mark>` tags).

**Custom `equals`**: The memo uses `(a, b) => a.length === b.length && a.every((el, i) => el === b[i])` to compare arrays by element identity. Since `cause-effect` 0.18.4, `invalidate()` propagates `FLAG_CHECK` instead of `FLAG_DIRTY`, so effects correctly skip re-runs when `equals` returns `true`. The `couldMatch` filter and the `equals` check together ensure effects only re-run when the matched element set actually changes.

### Dependency resolution

During `first()` and `all()` calls, any matched custom element that isn't yet defined (matches `:not(:defined)`) is collected. `resolveDependencies(callback)` then awaits `customElements.whenDefined()` for all of them with a 200ms timeout. On timeout, it logs a `DependencyTimeoutError` but still runs the callback — effects proceed even if dependencies aren't ready.

### Compile-time selector type inference

The file contains a type-level CSS selector parser that infers the correct `HTMLElement` subtype from selector strings at compile time. `first('button')` returns `HTMLButtonElement`, `first('input[type="text"]')` returns `HTMLInputElement`, `first('.foo')` returns `HTMLElement`. This works through template literal types that split combinators, extract tag names, and look them up in `HTMLElementTagNameMap` / `SVGElementTagNameMap` / `MathMLElementTagNameMap`.

## The Parser System

Parsers transform HTML attribute strings into typed JavaScript values. The key design choice: **a Parser is a function branded with `PARSER_BRAND`** (`(ui, value, old?) => T`), while a **Reader is any function with 1 parameter** (`(ui) => T`). Always create custom parsers with `asParser()` — it attaches the brand so `isParser()` can identify them reliably. Relying on `fn.length >= 2` as the parser signal is deprecated and may be removed in a future major version; in `DEV_MODE`, unbranded two-argument functions trigger a `console.warn`.

Parsers serve dual duty in the 4-param form:
1. As property initializers — called during `connectedCallback` with the attribute's initial value
2. As attribute watchers — automatically added to `observedAttributes` and re-called in `attributeChangedCallback` on every attribute change

In the factory form, parsers serve only role 1: called once at connect time with the current attribute value; `observedAttributes = []` so `attributeChangedCallback` never fires.

The `read(reader, fallback)` function composes a `LooseReader` (which may return `string | null | undefined`) with a parser/fallback into a clean `Reader<T>`. This is useful for reading DOM state and parsing it: `read(ui => ui.input.value, asInteger())`.

## Event-Driven Sensors

`createEventsSensor(element, init, events)` creates a `Sensor<T>` — a signal driven by DOM events. Used inside `expose()` to declare a sensor-backed reactive property. The element is the first argument (explicit, not a UI key string).

```ts
expose({
    length: createEventsSensor(textbox, textbox.value.length, {
        input: ({ target }) => (target as HTMLInputElement).value.length,
    }),
})
```

Internally, the sensor attaches listeners to the element and emits a new value whenever a matched event fires. The sensor is created via `createSensor(set => ...)` from `@zeix/cause-effect`, which manages the lifecycle (activate when read, deactivate when unwatched).

This is more declarative than `on()`: instead of imperatively updating host properties, the sensor produces a single reactive value from multiple event types. Use case: combining `input`, `change`, `focus`, `blur` into a single state value.

The sensor is created via `createSensor(set => ...)` from `@zeix/cause-effect`, which manages the lifecycle (activate when read, deactivate when unwatched).

## The Context Protocol

Implements the [W3C Community Protocol for Context](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md) for dependency injection between components.

### Provider side

**v1.1 (current)**: `provideContexts([...])` is a `FactoryContext` helper that returns an `EffectDescriptor`. Include it in the factory's return array:

```ts
return [provideContexts([MEDIA_MOTION, MEDIA_THEME, MEDIA_VIEWPORT])]
```

**v1.0 (@deprecated)**: `provideContexts([...])` was an `Effect` used in the `effects` record as `host: provideContexts([...])`.

Both forms install a `context-request` event listener via `createScope`; when a matching request arrives, it stops propagation and provides a getter `() => host[context]` to the callback. The listener is removed on `disconnectedCallback` via the effect cleanup.

### Consumer side

**v1.1 (current)**: `requestContext(context, fallback)` is a `FactoryContext` helper that returns a `Memo<T>` directly — use it inside `expose()`:

```ts
expose({
    theme: requestContext(MEDIA_THEME, 'unknown'),
})
```

**v1.0 (@deprecated)**: `requestContext` returned a `Reader<Memo<T>>` used as a property initializer in the `props` map.

Both forms dispatch a `ContextRequestEvent` that bubbles up the DOM during `connectedCallback`. If an ancestor provider intercepts it, the consumer receives a getter and wraps it in a `createMemo()`, creating a live reactive binding. If no provider responds, it falls back to the provided default value.

## The Scheduler

`schedule(element, task)` deduplicates high-frequency DOM updates using `requestAnimationFrame`. A `WeakMap<Element, () => void>` stores the latest task per element. If the same element schedules multiple tasks before the next frame, only the last one runs. This is used by `on()` for passive events and by `dangerouslySetInnerHTML`.

## Security

`setAttribute()` includes security validation:
- Blocks `on*` event handler attributes (prevents XSS via attribute injection)
- Validates URLs against an allowlist of safe protocols (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`) — blocks `javascript:`, `data:`, etc.

---

## Key Decisions

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Two overloads for `defineComponent` | v1.1 factory (current) + 4-param (deprecated) | Single form, builder pattern | v1.1 factory is the primary form; 4-param form retained for components that require reactive `observedAttributes` |
| Slot-based signal swapping | `createSlot` wrapping mutable signals | Direct property assignment, Proxy-based | Enables `pass()` zero-overhead binding; consistent signal identity across the component lifecycle |
| Branded parsers and methods | Symbol-based branding (`PARSER_BRAND`, `METHOD_BRAND`) | Structural typing, class instances | `fn.length` is unreliable with default params/rest/destructuring; symbols are unforgeable |
| Lazy `MutationObserver` for `all()` | Observer activates on first read via `watched` option | Always-on observer, polling | Avoids overhead for collections not read in effects; auto-disconnects when unwatched |
| Effect keyed by UI element | `effects: { elementName: Effect[] }` | Flat effect list, per-property effects | Enables automatic Memo wrapping for collections; clear target binding without repetition |
| Bind helper naming | `bind*` prefix | `sync*`, `update*` | `sync` implies bidirectionality; `update` conflicts with internal `updateElement` and sounds imperative; `bind` clearly conveys one-directional declarative DOM binding |
| Bind helpers return plain function or WatchHandlers | `bindText`/`bindProperty`/`bindClass`/`bindVisible` → `(value) => void`; `bindAttribute`/`bindStyle` → `WatchHandlers<T>` | All return plain functions, all return WatchHandlers | `bindAttribute`/`bindStyle` have a meaningful nil path (remove attr/style) and `bindAttribute` has a boolean toggle branch; the others don't benefit from WatchHandlers |
| `bindAttribute` boolean dispatch | `toggleAttribute(name, value)` | Stringify boolean, throw on boolean | Maps naturally to the native boolean-attribute API; avoids invalid string values like `'true'`/`'false'` for presence-only attributes |
| `bindVisible` direction | `el.hidden = !value` (value=true → element visible) | `el.hidden = value` (named `bindHidden`) | Preserves v1.0 `show()` direction; `bindVisible(el)` reads as English — "bind visibility to value" |

## v1.1 Specification — New 2-Param Factory Form

See `VERSION_1.1_GOALS.md` for the goals. This section is the refined architectural specification for the new API.

### Design Summary

The new 2-param factory form replaces the structured return object (`{ ui, props, effects }`) with imperative setup (`expose()`) and a flat array of effect descriptors. The factory receives a context object with helpers for querying, declaring properties, and setting up effects.

```
v1.0 factory flow:
  factory({ first, all, host })
    → return { ui, props, effects }
    → engine: initSignals(props) → resolveDeps → createScope(runEffects(effects))

v1.1 factory flow:
  factory({ all, expose, first, host, on, pass, provideContexts, watch })
    → query elements with first/all
    → expose({ ... })              ← engine calls #initSignals immediately
    → return [ watch(...), on(...) ] ← effect descriptors; engine activates after deps resolve
```

### The Factory Context

The factory receives a single destructurable context object:

```ts
type FactoryContext<P extends ComponentProps> = {
    // Queries (unchanged from v1.0)
    first: FirstElement
    all: AllElements
    host: Component<P>

    // Property declaration
    expose: (props: Initializers<P>) => void

    // Effect helpers — return effect descriptors
    watch:            /* see §watch */
    on:               /* see §on */
    pass:             /* see §pass */
    provideContexts:  /* see §provideContexts */
}
```

Components destructure only what they need. A minimal component might use `{ expose, first, host, watch }`. A complex component with collections, events, and inter-component binding might use `{ all, expose, first, host, on, pass, provideContexts, requestContext, watch }`.

Note: `each` is **not** part of `FactoryContext`. It is a standalone named export from the library (`import { each } from '@zeix/le-truc'`). Components that need per-element collection effects import it directly alongside `defineComponent`.

### Naming Convention

Helpers pair by cardinality:

| Query | Effect |
|-------|--------|
| `first(selector)` → `Element` | `watch(signal, callback)` → effect on host property |
| `all(selector)` → `Memo<Element[]>` | `each(memo, callback)` → per-element effects *(standalone import)* |

### `expose(props)`

Declares the component's reactive public API. Called once during factory execution. Internally calls `#initSignals()` — the same dispatch logic as v1.0:

- **Parser** (branded with `PARSER_BRAND`) → called with `(ui, getAttribute(key))`, creates signal from result
- **MethodProducer** (branded with `METHOD_BRAND`) → assigned directly as the property value; the function IS the method. Per-instance state lives in factory scope.
- **Reader** (1-arg function) → called with `(ui)`, result used as signal initializer
- **Static value or Signal** → used directly as signal initializer

**Parser compatibility**: Parsers keep their `(ui, value) => T` signature unchanged. The `Fallback<T, U>` type is already `T | Reader<T, U>`, so passing plain values as fallbacks works today:

```ts
// v1.0 — reader-function fallback (reads DOM lazily via ui):
label: asString(() => label?.textContent ?? host.querySelector('label')?.textContent ?? '')

// v1.1 — plain value fallback (reads DOM eagerly via closure):
label: asString(label?.textContent ?? first('label')?.textContent ?? '')
```

Both are valid `Fallback<string, U>`. The reader form becomes unnecessary since the factory closure already has direct element access. The parser still receives `getAttribute(key)` from `#initSignals` — if the HTML attribute is set, it wins; if absent, the fallback is used. No parser API changes needed.

**Methods**: `expose()` handles methods via `asMethod()`, keeping all public API declaration in one place. The dispatch through `#initSignals` continues to work: method producers are called for their side effect and ignored for signal creation.

```ts
expose({
    checked: checkbox.checked,                    // static → createState
    label: asString(label?.textContent ?? ''),     // parser → reads attribute, falls back
    clear: clearMethod,                            // asMethod → installs host.clear
    length: createEventsSensor(textbox, 0, { ... }), // sensor → see §createEventsSensor
    theme: requestContext('theme', 'light'),        // context → see §requestContext
})
```

### `watch(source, handler)` — Property Effect

Wraps `createEffect` + `match` to create a reactive effect driven by one or more signals.

```ts
// Single signal — string name resolves to host[name]:
watch('checked', checked => {
    checkbox.checked = checked
    host.toggleAttribute('checked', checked)
})

// Single signal — direct Signal/Memo reference:
watch(lowerFilter, filter => {
    searchInput.value = filter
})

// Multiple signals — array form, callback receives tuple:
watch(['value', 'filter'], ([value, filter]) => {
    // re-runs when either host.value or host.filter changes
})

// MatchHandlers form — ok/nil/err paths:
watch('src', {
    ok: src => { renderContent(src) },
    nil: () => { resetToEmpty() },
    err: error => { showError(error) },
})
```

**Semantics**: `watch` uses `match` internally. The effect re-runs **only when the declared source signals change** — other signals read inside the handler do NOT trigger re-runs. This is a deliberate choice: effects declare their dependencies explicitly, making data flow traceable.

**Return value**: An effect descriptor (see §Lifecycle below). Falsy values (`false`, `undefined`) are valid and filtered out, enabling conditional effects:

```ts
return [
    label && watch('label', text => { label.textContent = text }),
]
```

### `each(memo, callback)` — Collection Effect

**Standalone import** — `each` is not part of `FactoryContext`. Import it directly:

```ts
import { defineComponent, each } from '@zeix/le-truc'
```

Per-element reactive effects on a `Memo<Element[]>` from `all()`. Provides automatic lifecycle management: when elements enter the collection, their effects are created; when they leave, their effects are disposed.

```ts
each(options, option => [
    watch('value', value => {
        option.ariaSelected = String(host.value === option.value)
        option.tabIndex = host.value === option.value ? 0 : -1
    }),
    watch(lowerFilter, filter => {
        const text = option.textContent?.trim() ?? ''
        option.hidden = !text.toLowerCase().includes(filter)
        option.innerHTML = highlightMatch(text, filter)
    }),
])
```

The callback receives a single element and returns an array of effect descriptors (same shape as the factory's top-level return). This makes the pattern recursive — `each` inside `each` is valid for nested collections.

**Implementation**: When activated, `each` creates a `createEffect` that reads `memo.get()` (tracking the Memo). For each element, it calls the callback and activates the returned descriptors in a per-element scope owned by the wrapping `createEffect`. When the Memo changes, the wrapping effect re-runs: old per-element scopes are disposed, new ones created.

### `on(target, type, handler, options?)` — Event Binding

Attaches an event listener. The target is explicit. The handler always receives `(event, target)` — a unified signature regardless of whether the target is an Element or Memo. This gives properly typed `target` without the `event.target` casting that DOM APIs typically require.

```ts
// Single element — target is the element itself:
on(checkbox, 'change', (event, el) => ({ checked: el.checked }))

// Memo target — event delegation; target is the matched element:
on(dots, 'click', (event, dot) => {
    host.index = parseInt(dot.dataset.index || '0')
})
```

**Element target**: Attaches a listener directly to the element. Handler receives `(event, element)` where `element` is the target passed to `on()`. Handler may return `{ prop: value }` to batch-update host properties (same as v1.0).

**Memo target — event delegation**: Attaches a single listener on the component's query root (`host.shadowRoot ?? host`). When an event fires, checks `element.contains(event.target)` for each element in `memo.get()` to find the matched element. The handler receives `(event, matchedElement)`.

**Non-bubbling events on Memo targets**: Delegation only works for events that bubble. If `on()` receives a Memo target with a non-bubbling event type, behavior differs by build mode:

- **DEV_MODE**: Logs a warning pointing the user toward the `each()` + per-element `on()` pattern, then falls back to per-element listeners.
- **Production**: Silently falls back to per-element listeners.

The fallback uses the same per-element lifecycle management as `each()` internally (listeners added/removed as elements join/leave the Memo). This ensures production code never breaks, while development builds educate authors toward the explicit `each()` pattern — which is preferred because it makes the per-element cost visible and gives the author control over what else happens per-element.

**Exhaustive non-bubbling event list**: `focus`, `blur`, `scroll`, `resize`, `load`, `unload`, `error`, `toggle`, `mouseenter`, `mouseleave`, `pointerenter`, `pointerleave`, `abort`, `canplay`, `canplaythrough`, `durationchange`, `emptied`, `ended`, `loadeddata`, `loadedmetadata`, `loadstart`, `pause`, `play`, `playing`, `progress`, `ratechange`, `seeked`, `seeking`, `stalled`, `suspend`, `timeupdate`, `volumechange`, `waiting`.

```ts
// DEV_MODE warning: 'focus' does not bubble — prefer each() for per-element listeners
// Falls back to per-element listeners in both modes
on(inputs, 'focus', (event, el) => { /* works, but warns in dev */ })

// Preferred explicit pattern:
each(inputs, input => [
    on(input, 'focus', (event, el) => { /* ... */ }),
])
```

**`on` inside `each`**: When `on` appears inside an `each` callback, the target is a single element (the iteration variable), so it binds a per-element listener — no delegation. This is the correct pattern for non-bubbling events and for cases where per-element lifecycle management is needed (listener added when element enters the Memo, removed when it leaves).
```

### `pass(target, props)` — Inter-Component Binding

Passes reactive values to a descendant Le Truc component by swapping its Slot-backed signals. Same mechanism as v1.0, but with explicit target.

```ts
// Single element:
pass(listbox, { filter: () => host.value })

// Memo target — auto-iterates like each():
pass(spinbuttons, { value: 'quantity' })
```

**Memo target**: Iterates current elements in the Memo, swaps signals for each, and manages per-element lifecycle (restore original signals when elements leave the collection). Internally uses the same per-element scoping as `each()`.

**Provided as factory helper** (not imported), so it can capture `host` from the factory context. This eliminates the import.

### `provideContexts(contexts)` — Context Provider

Provided as a factory helper, always bound to `host`. Attaches a `context-request` listener.

```ts
return [
    provideContexts([MEDIA_MOTION, MEDIA_THEME, MEDIA_VIEWPORT]),
]
```

No target parameter needed — context provision only makes sense on the host element. The helper captures `host` from the factory context.

### `requestContext(context, fallback)` — Context Consumer

Used inside `expose()` as a property initializer. Dispatches a `ContextRequestEvent` from the host.

```ts
expose({
    theme: requestContext('theme', 'light'),
})
```

The signature changes slightly: `requestContext` is provided as a factory helper that captures `host`, so the user no longer needs to pass it. Internally dispatches the event from `host` and returns a `Memo<T>`.

### `createEventsSensor(target, init, events)` — Event-Driven Sensor

Refactored to accept a target element directly instead of a UI key string.

```ts
expose({
    length: createEventsSensor(textbox, textbox.value.length, {
        input: ({ target }) => target.value.length,
    }),
})
```

The `target` parameter replaces the string `key` lookup. The `init` parameter is a plain value (not `read(reader, fallback)` — `read` is eliminated). Internally, `createEventsSensor` still returns a `Sensor<T>` that `#initSignals` handles.

**Handler context**: The `ui` field in handler context objects becomes unnecessary (elements are in the closure). The handler receives `{ event, target, prev }` — dropping `ui`.

### Component Lifecycle (v1.1)

```
connectedCallback()
  │
  ├─ 1. getHelpers(this)  →  [{ first, all }, resolveDependencies]
  │
  ├─ 2. Create factory context with helpers bound to this instance
  │     (expose, watch, each, on, pass, provideContexts, requestContext)
  │
  ├─ 3. Run factory:
  │       descriptors = factory(context)
  │       ├── first(), all() execute → queries run, dependencies collected
  │       ├── expose() executes → #initSignals() creates signals immediately
  │       └── watch(), on(), etc. execute → return effect descriptors (thunks)
  │
  └─ 4. resolveDependencies(() => {
           this.#cleanup = createScope(() => {
               for (const descriptor of descriptors.filter(Boolean))
                   descriptor()  // activate effect, registers in scope
           })
         })
```

**Critical timing detail**: `watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` return **effect descriptors** — functions that, when called inside a scope, create the actual effect. They do NOT create effects immediately when called in the factory body. This preserves the v1.0 timing guarantee: effects activate only after dependency resolution (child custom elements are defined).

From the user's perspective this is transparent — they call `watch(...)`, get back an opaque value, put it in the return array. The engine handles activation timing. The same pattern already exists in v1.0: `on('click', handler)` returns a curried `(host, target) => Cleanup`, not a live effect.

**Why this matters**: `pass()` needs the target component's signals to exist. Those signals are created in the target's `connectedCallback`, which requires `customElements.define()` to have run. `resolveDependencies` waits for that. If effects activated immediately, `pass` would find an empty signal map and silently fail.

### Safety Utilities

With built-in effects (`setAttribute`, `toggleAttribute`, etc.) no longer wrapping DOM operations, their safety features need to be available as importable utilities:

- **`safeSetAttribute(element, name, value)`** — validates URL protocols, blocks `on*` handlers
- **`escapeHTML(text)`** — already exists in examples; promote to library export
- **`setTextPreservingComments(element, text)`** — replaces non-comment child nodes (what `setText` does internally)

These are opt-in imports, not factory helpers. Authors who use native DOM methods directly accept responsibility for validation.

### Worked Example: `form-combobox` in v1.1

The combobox is one of the most complex components (6 UI targets, 12 effects, event sensors, `pass`, `show`, memos). Here's how it translates:

```ts
export default defineComponent<FormComboboxProps, FormComboboxUI>(
    'form-combobox',
    ({ all, expose, first, host, on, pass, watch }) => {
        const textbox = first('input', 'Needed to enter value.')
        const listbox = first('form-listbox', 'Needed to display options.')
        const clear = first('button.clear')
        const error = first('form-combobox > .error')
        const description = first('.description')

        const errorId = error?.id
        const descriptionId = description?.id

        const showPopup = createState(false)
        const isExpanded = createMemo(
            () => showPopup.get() && listbox.options.length > 0,
        )

        expose({
            value: '',
            length: createEventsSensor(textbox, textbox.value.length, {
                input: ({ target }) => target.value.length,
            }),
            error: '',
            description: description?.textContent ?? '',
            clear: clearMethod,
        })

        return [
            // Host effects
            watch('value', value => {
                host.setAttribute('value', value)
            }),
            on(host, 'keyup', ({ key }) => {
                if (key === 'Escape') {
                    showPopup.set(false)
                    textbox.focus()
                }
                if (key === 'Delete') host.clear()
            }),

            // Textbox effects
            watch(['error', 'description'], ([err, desc]) => {
                textbox.ariaInvalid = String(!!err)
                textbox.setAttribute('aria-errormessage',
                    err && errorId ? errorId : '')
                textbox.setAttribute('aria-describedby',
                    desc && descriptionId ? descriptionId : '')
            }),
            watch(isExpanded, expanded => {
                textbox.ariaExpanded = String(expanded)
            }),
            on(textbox, 'input', (_event, el) => {
                el.checkValidity()
                batch(() => {
                    host.value = el.value
                    host.error = el.validationMessage ?? ''
                    showPopup.set(true)
                })
            }),
            on(textbox, 'keydown', (event) => {
                const { key, altKey } = event
                if (key === 'ArrowDown') {
                    if (altKey) showPopup.set(true)
                    if (isExpanded.get()) listbox.options[0]?.focus()
                }
            }),

            // Listbox effects
            watch(isExpanded, expanded => { listbox.hidden = !expanded }),
            pass(listbox, { filter: () => host.value }),
            on(listbox, 'change', (event) => {
                const input = event.target
                if (input instanceof HTMLInputElement) {
                    textbox.value = input.value
                    textbox.checkValidity()
                    batch(() => {
                        host.value = input.value
                        host.error = textbox.validationMessage ?? ''
                        showPopup.set(false)
                        textbox.focus()
                    })
                }
            }),

            // Clear button
            clear && watch('length', length => { clear.hidden = !length }),
            clear && on(clear, 'click', () => { host.clear() }),

            // Text displays
            error && watch('error', text => { error.textContent = text }),
            description && watch('description', text => {
                description.textContent = text
            }),
        ]
    },
)
```

**What changed**: 13 imports → 4 (`asString`, `batch`, `createMemo`, `createState`; the rest come from the factory context). No `ui` returned. No `effects` keyed by element name. Effects are grouped logically (by concern) rather than structurally (by target element). Optional elements use `&&` guards in the flat array.

### Key Decisions

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Naming: `watch`/`each` | Parallel `first`/`all` for cardinality | `fx`/`forEach`, `watch`/`map`, `effect`/`iterate` | Reads as English ("watch this when checked changes", "for each option do..."); consistent pairing with query helpers |
| `watch` uses `match` internally | Explicit dependency declaration | Plain `createEffect` (track all reads) | Makes data flow traceable; prevents accidental re-runs from incidental reads inside the handler |
| Effect descriptors (thunks) | Deferred activation after dependency resolution | Immediate activation, `pass`-specific deferral | Preserves v1.0 timing guarantee; keeps `pass` simple; no dual-behavior helpers |
| `on` unified handler signature | Always `(event, target)` | `(event)` for Element, `(event, matched)` for Memo | Consistent; properly typed `target` avoids `event.target` casting |
| `on` with Memo uses delegation | Single listener on query root; DEV_MODE warn + fallback for non-bubbling | Always per-element, always throw | Better perf for large collections; graceful degradation in production; dev builds educate toward `each()` |
| `on` inside `each` binds per-element | Direct listener on iteration element | Always delegate regardless of context | Enables non-bubbling events; automatic add/remove lifecycle when elements join/leave the Memo |
| `pass` with Memo auto-iterates | Built-in per-element lifecycle | Require `each(memo, el => pass(el, ...))` | Common enough to warrant first-class support; avoids boilerplate |
| `each` callback returns array | Same shape as factory return | Void callback with self-registering helpers | Consistent at every level; composable; no dual-behavior for `watch`/`on` inside vs. outside `each` |
| `each` as standalone export | Named export from `effects.ts`, not in `FactoryContext` | Keep in context like `watch`/`on` | `each` closes over no host state; including it unconditionally in the context object prevents tree-shaking for components that never use it |
| `expose` handles methods | `asMethod()` stays, used inside `expose()` | Direct assignment on host, drop `asMethod` | Keeps all public API declaration in one place; `#initSignals` dispatch logic unchanged |
| Parsers unchanged | `Fallback<T, U>` already accepts plain values | Separate value-transformer API | No breaking change; reader-function fallbacks still valid for 4-param form |
| Safety as importable utilities | `safeSetAttribute`, `escapeHTML`, etc. | Built into `watch`/factory helpers | Opt-in is appropriate; most DOM updates don't need validation |

### Implementation Plan

1. **Phase 1: Engine** — Modify `connectedCallback` to support the new factory return shape (flat array of effect descriptors). Implement `expose()` calling `#initSignals`. Keep v1.0 `{ ui, props, effects }` return working alongside — detect which form by checking `Array.isArray(result)` vs `isRecord(result)`.

2. **Phase 2: Core helpers** — Implement `watch()` (wrapping `match`), `each()` (collection lifecycle), new `on(target, type, handler)` with Memo delegation overload, new `pass(target, props)` with Memo overload. Wire them into the factory context.

3. **Phase 3: Context & sensors** — Refactor `provideContexts` and `requestContext` as factory-context-bound helpers. Refactor `createEventsSensor` to accept target element directly, drop `ui` from handler context.

4. **Phase 4: Safety utilities** — Extract `safeSetAttribute`, promote `escapeHTML`, implement `setTextPreservingComments`. Export from library.

5. **Phase 5: Migration** — Convert example components to the new form. Use the test suite (~1150 tests, 3 browsers) as correctness backstop. Prioritize: simple components first (basic-*), then form components, then complex modules.

6. **Phase 6: Deprecation** — Mark `read()`, built-in effects (`setText`, `setAttribute`, etc.), and the `{ ui, props, effects }` return shape as `@deprecated` with JSDoc pointing to v1.1 equivalents. Mark 4-param `defineComponent` overload as `@deprecated`. Update type declarations in `types/`. Update `CLAUDE.md` surprising behaviors. Removal deferred to v2.0.

### Resolved Decisions

- **4-param form**: Supported in v1.1 but marked `@deprecated`. Built-in effects (`setText`, etc.) remain available for its `setup` function. Removal decision deferred to v2.0.
- **`each` single-descriptor shortcut**: `each(slides, slide => watch('index', ...))` (without brackets) accepted as overload.
- **Non-bubbling events**: Exhaustive list maintained. DEV_MODE warns and falls back to per-element; production silently falls back. No throws.

### Remaining Open Questions

1. **`watch` with MatchHandlers and arrays**: The exact TypeScript overload signatures need design. `watch(source, callback)` vs `watch(source, { ok, nil, err })` vs `watch([s1, s2], ([v1, v2]) => ...)` — three overloads with tuple typing for the array form. Consider whether this complexity belongs in Le Truc or should be upstreamed to Cause & Effect first (as mentioned in VERSION_1.1_GOALS.md). To be resolved during Phase 2 implementation.
