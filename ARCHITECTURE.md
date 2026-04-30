# Architecture

Le Truc is a reactive custom elements library. This document describes how the pieces in `src/` fit together.

The single external dependency is `@zeix/cause-effect`, which provides the reactive primitives used by Le Truc: `createState`, `createComputed`, `createEffect`, `createMemo`, `createScope`, `createSensor`, `createSlot`, `createTask`, `createStore`, `createList`, `createCollection`, `Signal`, `Memo`, `Sensor`, `Slot`, `batch`, `match`, `unown`, `untrack`, and various type guards and utility functions. See `index.ts` for the full re-export surface.

## The Component Lifecycle

`defineComponent` creates a class `Truc extends HTMLElement`, registers it via `customElements.define()`, and returns the class.

The **factory form** `(name, factory)`: the factory receives a `FactoryContext` with `{ all, expose, first, host, on, pass, provideContexts, requestContext, watch }`. It calls `expose({ ... })` for reactive props and returns a `FactoryResult` — an array of effect descriptors (nested arrays are flattened; falsy values are filtered). `static observedAttributes = []` — parsers in `expose()` are called once at connect time with the current attribute value.

### connectedCallback — initialization

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
           this.#cleanup = createScope(() => activateResult(descriptors), {
             root: true
           })
         })
         Waits for child custom elements to be defined (200ms timeout),
         then activates effects inside an unowned scope.
         { root: true } prevents the component scope from being registered as
         a child of whatever createEffect happens to be running when
         connectedCallback fires (e.g. a list-sync watch that inserted the
         element). Without it, the parent effect's next re-run would dispose
         the component scope and kill all its reactive effects.
         disconnectedCallback remains the sole lifecycle authority.
```

**Critical timing detail**: `watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` return **effect descriptors** — functions that, when called inside a scope, create the actual effect. They do NOT create effects immediately when called in the factory body. This preserves the v1.0 timing guarantee: effects activate only after dependency resolution (child custom elements are defined).

From the user's perspective this is transparent — they call `watch(...)`, get back an opaque value, put it in the return array. The engine handles activation timing. The same pattern already exists in v1.0: `on('click', handler)` returns a curried `(host, target) => Cleanup`, not a live effect.

**Why this matters**: `pass()` needs the target component's signals to exist. Those signals are created in the target's `connectedCallback`, which requires `customElements.define()` to have run. `resolveDependencies` waits for that. If effects activated immediately, `pass` would find an empty signal map and silently fail.

### #setAccessor — signal creation

Takes a key and a value and creates the appropriate signal:

- Already a `Signal` → use directly
- A function → `createComputed(fn)` (read-only)
- Anything else → `createState(value)` (read-write)

For mutable signals, the value is wrapped in a `createSlot(signal)` — a Slot from `@zeix/cause-effect` that acts as an indirection layer. The Slot's `get`/`set` are used as the property descriptor on the component instance, which is what makes `host.count` reactive. Reading calls `signal.get()` inside effects, registering the dependency automatically.

The Slot enables signal swapping: `pass()` calls `slot.replace(newSignal)` to inject a parent signal into a child component without redefining the property descriptor.

### disconnectedCallback — cleanup

Calls the cleanup function stored from `createScope()`, which tears down all effects and event listeners.

## The Effect System

Effects in Le Truc are **effect descriptors** — thunks `() => MaybeCleanup`. The factory function returns a `FactoryResult` array of them (nested arrays are flattened; falsy values are filtered). After dependency resolution, each descriptor is activated inside a `createScope()`.

### bind* helpers — DOM update handlers

`src/helpers.ts` provides `SingleMatchHandlers<T>` objects and plain handler functions for use with `watch()`:

| Helper | Returns | What it does |
|---|---|---|
| `bindAttribute(el, name)` | `SingleMatchHandlers<string \| boolean>` | Sets/removes an attribute; boolean uses `toggleAttribute` |
| `bindClass(el, token)` | `(value: boolean) => void` | Adds/removes a CSS class |
| `bindText(el)` | `(value: string) => void` | Sets text content |
| `bindProperty(el, key)` | `(value: T) => void` | Sets a DOM property directly |
| `bindStyle(el, prop)` | `SingleMatchHandlers<string>` | Sets/removes an inline style |
| `bindVisible(el)` | `(value: boolean) => void` | Controls `el.hidden = !value` |
| `dangerouslyBindInnerHTML(el, opts?)` | `SingleMatchHandlers<string>` | Sets innerHTML, optionally in a shadow root |

### on() — event binding

`on(target, type, handler, options?)` from `FactoryContext` — takes an explicit element or `Memo<Element[]>`, returns an `EffectDescriptor`. The handler receives `(event, element)`. For `Memo` targets, uses event delegation. Returns a partial property update `{ prop: value }` to batch-update host.

### pass() — inter-component binding

`pass(target, props)` from `FactoryContext` — takes an explicit element or `Memo<Component<Q>[]>`, returns an `EffectDescriptor`. Directly swaps the backing signal of a descendant Le Truc component's Slot, creating a zero-overhead live binding. Uses `getSignals(target)` to access the child's internal signal map, captures `slot.current()` before replacing, then calls `slot.replace(signal)`. Cleanup restores the original signal when the parent disconnects.

This is more efficient than `setProperty()` for Le Truc targets: it eliminates the intermediate `createEffect` and property-assignment overhead on every reactive update. The parent and child share the exact same underlying signal node.

**Scope is Le Truc components only.** For non-Le Truc custom elements (Lit, Stencil, FAST, etc.), use `setProperty()` instead.

## The UI Query System

`getHelpers(host)` returns `[{ first, all }, resolveDependencies]`.

### first(selector, required?)

Calls `root.querySelector()`. If the matched element is an undefined custom element, its tag name is added to the dependency set. Returns the element or `undefined` (throws `MissingElementError` if `required` is provided and element is missing).

### all(selector, required?)

Returns a `Memo<E[]>` created by `createElementsMemo()`. This sets up a `MutationObserver` (lazily, via the `watched` option on `createMemo`) that watches for `childList`, `subtree`, and relevant attribute changes. The memo always contains the current matching elements; added/removed diffs are derived downstream by the owning `createEffect`.

The `MutationObserver` config is smart about which attributes to watch: `extractAttributes(selector)` parses the CSS selector to find attribute names implied by `.class`, `#id`, and `[attr]` patterns.

**Mutation filtering**: The observer's callback uses a `couldMatch` helper that checks `node.matches(selector)` and `node.querySelector(selector)` on added/removed nodes. This prevents spurious invalidations from mutations *inside* matched elements (e.g., `innerHTML` changes on a `button[role="option"]` that add/remove `<mark>` tags).

**Custom `equals`**: The memo uses `(a, b) => a.length === b.length && a.every((el, i) => el === b[i])` to compare arrays by element identity. Since `cause-effect` 0.18.4, `invalidate()` propagates `FLAG_CHECK` instead of `FLAG_DIRTY`, so effects correctly skip re-runs when `equals` returns `true`. The `couldMatch` filter and the `equals` check together ensure effects only re-run when the matched element set actually changes.

### Dependency resolution

During `first()` and `all()` calls, any matched custom element that isn't yet defined (matches `:not(:defined)`) is collected. `resolveDependencies(callback)` then awaits `customElements.whenDefined()` for all of them with a 200ms timeout. On timeout, it logs a `DependencyTimeoutError` but still runs the callback — effects proceed even if dependencies aren't ready.

### Compile-time selector type inference

The file contains a type-level CSS selector parser that infers the correct `HTMLElement` subtype from selector strings at compile time. `first('button')` returns `HTMLButtonElement`, `first('input[type="text"]')` returns `HTMLInputElement`, `first('.foo')` returns `HTMLElement`. This works through template literal types that split combinators, extract tag names, and look them up in `HTMLElementTagNameMap` / `SVGElementTagNameMap` / `MathMLElementTagNameMap`.

## The Parser System

Parsers transform HTML attribute strings into typed JavaScript values. `Parser<T>` = `(value: string | null | undefined) => T`. Always create custom parsers with `asParser()` — it attaches the `PARSER_BRAND` symbol so `isParser()` can identify them reliably.

`Reader<T, H>` = `(host: H) => T`. Readers receive the host element directly. If the reader returns a function (`MemoCallback`) or `TaskCallback`, `#setAccessor` wraps it in a computed/task signal; otherwise a mutable state signal is created.

Parsers are called once at connect time with `this.getAttribute(key)`. `static observedAttributes = []` — attributes don't drive reactive updates after connect.

## Event-Driven State

For props that derive from DOM events and should be read-only to consumers, use `createState` + `on`:

```ts
const length = createState(textbox.value.length)

expose({
    length: length.get,  // getter only — consumers cannot set this prop
})

return [
    on(textbox, 'input', () => {
        length.set(textbox.value.length)
    }),
]
```

Exposing `state.get` rather than the full `State` makes `host.length` readable but not settable from outside. The `on()` handler attaches synchronously at connect time. Pass the signal directly to `watch()` within the same factory to skip the host slot lookup: `watch(length, bindVisible(clearBtn))`.

## The Context Protocol

Implements the [W3C Community Protocol for Context](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md) for dependency injection between components.

### Provider side

`provideContexts([...])` is a `FactoryContext` helper that returns an `EffectDescriptor`. Include it in the factory's return array:

```ts
return [provideContexts([MEDIA_MOTION, MEDIA_THEME, MEDIA_VIEWPORT])]
```

Installs a `context-request` event listener via `createScope`; when a matching request arrives, it stops propagation and provides a getter `() => host[context]` to the callback. The listener is removed on `disconnectedCallback` via the effect cleanup.

### Consumer side

`requestContext(context, fallback)` is a `FactoryContext` helper that returns a `Memo<T>` directly — use it inside `expose()`:

```ts
expose({
    theme: requestContext(MEDIA_THEME, 'unknown'),
})
```

Dispatches a `ContextRequestEvent` that bubbles up the DOM during `connectedCallback`. If an ancestor provider intercepts it, the consumer receives a getter and wraps it in a `createMemo()`, creating a live reactive binding. If no provider responds, it falls back to the provided default value.

## The Scheduler

`schedule(element, task)` deduplicates high-frequency DOM updates using `requestAnimationFrame`. A `WeakMap<Element, () => void>` stores the latest task per element. If the same element schedules multiple tasks before the next frame, only the last one runs. This is used by `on()` for passive events and by `dangerouslyBindInnerHTML`.

## Security

`setAttribute()` includes security validation:
- Blocks `on*` event handler attributes (prevents XSS via attribute injection)
- Validates URLs against an allowlist of safe protocols (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`) — blocks `javascript:`, `data:`, etc.

---

## Key Decisions

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Single `defineComponent` form | Factory form `(name, factory)` | 4-param form, builder pattern | Factory closure gives direct element access, eliminating the UI object indirection layer; attributes drive state only at connect time |
| Attributes drive state at connect time only | `static observedAttributes = []`, parsers called once | Always-reactive attributes, observed attrs | v2.0 BC: components get initial state from attributes, then manage state via reactive props and event handlers |
| `Parser<T>` takes value only | `(value: string \| null \| undefined) => T` | `(ui, value) => T` | Simpler, no UI object needed; fallbacks are static values captured in closure |
| `Reader<T, H>` receives host | `(host: HTMLElement & P) => T` | `(ui) => T` with UI object | Factory closure already has access to queried elements; host is the relevant context for property initialization |
| Slot-based signal swapping | `createSlot` wrapping mutable signals | Direct property assignment, Proxy-based | Enables `pass()` zero-overhead binding; consistent signal identity across the component lifecycle |
| Branded parsers and methods | Symbol-based branding (`PARSER_BRAND`, `METHOD_BRAND`) | Structural typing, class instances | `fn.length` is unreliable with default params/rest/destructuring; symbols are unforgeable |
| Lazy `MutationObserver` for `all()` | Observer activates on first read via `watched` option | Always-on observer, polling | Avoids overhead for collections not read in effects; auto-disconnects when unwatched |
| Bind helper naming | `bind*` prefix | `sync*`, `update*` | `sync` implies bidirectionality; `bind` clearly conveys one-directional declarative DOM binding |
| Bind helpers return plain function or SingleMatchHandlers | `bindText`/`bindProperty`/`bindClass`/`bindVisible` → `(value) => void`; `bindAttribute`/`bindStyle`/`dangerouslyBindInnerHTML` → `SingleMatchHandlers<T>` | All return plain functions, all return SingleMatchHandlers | `bindAttribute`/`bindStyle` have a meaningful nil path (remove attr/style) and `bindAttribute` has a boolean toggle branch; the others don't benefit from SingleMatchHandlers |
| `bindAttribute` boolean dispatch | `toggleAttribute(name, value)` | Stringify boolean, throw on boolean | Maps naturally to the native boolean-attribute API; avoids invalid string values like `'true'`/`'false'` for presence-only attributes |
| `bindVisible` direction | `el.hidden = !value` (value=true → element visible) | `el.hidden = value` (named `bindHidden`) | `bindVisible(el)` reads as English — "bind visibility to value" |

## The Factory Form — Specification

Components use a single factory form. The factory receives a context with helpers for querying, declaring properties, and setting up effects:

```
factory({ all, expose, first, host, on, pass, provideContexts, requestContext, watch })
  → query elements with first/all
  → expose({ ... })               ← engine calls #initSignals immediately
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

Le Truc uses four prefix families, each mapping to a distinct layer of the stack:

| Prefix | Layer | Examples | What it creates |
|--------|-------|---------|-----------------|
| `define*` | DOM / component | `defineComponent`, `defineMethod` | Things with a DOM identity — custom elements, methods that live on elements |
| `bind*` | DOM update handlers | `bindText`, `bindAttribute`, `bindClass`, `bindVisible`, `bindStyle`, `bindProperty`, `dangerouslyBindInnerHTML` | Handler factories that apply a value to a DOM node; always used as the second argument to `watch()` |
| `as*` | Parsers / type coercion | `asBoolean`, `asInteger`, `asNumber`, `asString`, `asEnum`, `asJSON`, `asClampedInteger`, `asParser` | Branded parser factories that coerce an attribute string to a typed value; pure data-level, no DOM involvement |
| `create*` | Data flow / signals | `createState`, `createEffect`, `createScope`, `createSensor`, `createElementsMemo` | Reactive primitives from `@zeix/cause-effect` or Le Truc's signal-layer utilities |

The `define*` / `bind*` split within the DOM layer reflects direction of coupling: `define*` brings a DOM concept into existence (register, install); `bind*` connects a data value to an existing DOM node (update, sync).

`as*` parsers sit at the data level — they are standalone pure functions, independent of any element or component. They happen to be used inside `expose()` at connect time, but carry no DOM state themselves.

Factory context helpers (`watch`, `on`, `pass`, `provideContexts`, `requestContext`, `expose`, `first`, `all`) are plain verbs — they are bound methods on `FactoryContext`, not standalone factory functions, so no prefix applies.

Helpers also pair by cardinality:

| Query | Effect |
|-------|--------|
| `first(selector)` → `Element` | `watch(source, handler)` → reactive effect on a single source |
| `all(selector)` → `Memo<Element[]>` | `each(memo, callback)` → per-element effects *(standalone import)* |

### `expose(props)`

Declares the component's reactive public API. Called once during factory execution. Internally calls `#initSignals()`:

- **Parser** (branded via `asParser()`) → called with `getAttribute(key)`, creates signal from result
- **MethodProducer** (branded via `defineMethod()`) → assigned directly as the property value; the function IS the method. Per-instance state lives in factory scope.
- **Static value or Signal** → used directly as signal initializer

The parser receives `getAttribute(key)` from `#initSignals` — if the HTML attribute is set it wins; if absent the static fallback is used. Capture DOM state eagerly in the factory closure:

```ts
label: asString(label?.textContent ?? first('label')?.textContent ?? '')
```

**Methods**: `expose()` handles methods via `defineMethod()`, keeping all public API declaration in one place.

```ts
const length = createState(textbox.value.length)

expose({
    checked: checkbox.checked,                 // static → createState
    label: asString(label?.textContent ?? ''), // parser → reads attribute, falls back
    clear: clearMethod,                        // defineMethod → installs host.clear
    length: length.get,                        // getter only → read-only to consumers
    theme: requestContext('theme', 'light'),   // context → see §requestContext
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

// MatchHandlers form — ok/nil/err/stale paths (precedence: nil > err > stale > ok):
watch('src', {
    ok: src => { renderContent(src) },
    nil: () => { resetToEmpty() },
    err: error => { showError(error) },
    stale: () => { showRefreshIndicator() },
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

### Safety Utilities

With built-in effects (`setAttribute`, `toggleAttribute`, etc.) no longer wrapping DOM operations, their safety features need to be available as importable utilities:

- **`safeSetAttribute(element, name, value)`** — validates URL protocols, blocks `on*` handlers
- **`escapeHTML(text)`** — already exists in examples; promote to library export
- **`setTextPreservingComments(element, text)`** — replaces non-comment child nodes (what `bindText` does internally)

These are opt-in imports, not factory helpers. Authors who use native DOM methods directly accept responsibility for validation.

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
| `expose` handles methods | `defineMethod()` stays, used inside `expose()` | Direct assignment on host, drop `defineMethod` | Keeps all public API declaration in one place; `#initSignals` dispatch logic unchanged |
| Parsers unchanged | `Fallback<T, U>` already accepts plain values | Separate value-transformer API | No breaking change; reader-function fallbacks still valid for 4-param form |
| Safety as importable utilities | `safeSetAttribute`, `escapeHTML`, etc. | Built into `watch`/factory helpers | Opt-in is appropriate; most DOM updates don't need validation |
