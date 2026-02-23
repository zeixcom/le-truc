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

The single external dependency is `@zeix/cause-effect`, which provides the reactive primitives: `createState`, `createComputed`, `createEffect`, `createMemo`, `createSensor`, `Signal`, `Memo`, `Sensor`, `batch`, and various type guards.

## The Component Lifecycle

`defineComponent(name, props, select, setup)` is the main entry point. It creates a class `Truc extends HTMLElement`, registers it via `customElements.define()`, and returns the class.

### connectedCallback — initialization

```
connectedCallback()
  │
  ├─ 1. getHelpers(this)  →  [{ first, all }, resolveDependencies]
  │     Determines query root (shadowRoot ?? this).
  │     Tracks custom element dependencies found during queries.
  │
  ├─ 2. ui = { ...select({ first, all }), host: this }
  │     User-provided select function queries DOM elements.
  │     Object is frozen — immutable after creation.
  │
  ├─ 3. Initialize signals for each property:
  │     ├─ Parser (≥2 args)?  →  parser(ui, this.getAttribute(key))
  │     ├─ Function (1 arg)?  →  reader(ui)  or  methodProducer(ui)
  │     └─ Otherwise          →  use value directly (static or Signal)
  │     Each result is passed to #setAccessor(key, value).
  │
  └─ 4. resolveDependencies(() => {
           this.#cleanup = runEffects(ui, setup(ui))
         })
         Waits for child custom elements to be defined (50ms timeout),
         then runs the setup function and activates effects.
```

### #setAccessor — signal creation

Takes a key and a value and creates the appropriate signal:

- Already a `Signal` → use directly
- A function → `createComputed(fn)` (read-only)
- Anything else → `createState(value)` (read-write)

For mutable signals, the value is wrapped in a `createSlot(signal)` — a Slot from `@zeix/cause-effect` that acts as an indirection layer. The Slot's `get`/`set` are used as the property descriptor on the component instance, which is what makes `host.count` reactive. Reading calls `signal.get()` inside effects, registering the dependency automatically.

The Slot enables signal swapping: if `#setAccessor` is called again for an existing key (e.g., via `attributeChangedCallback`), it calls `slot.replace(newSignal)` instead of redefining the property. This is also the mechanism used by `pass()` to inject parent signals into a child component.

### attributeChangedCallback — attribute sync

Only fires for properties whose initializer `isParser` (function with ≥2 parameters). These are collected into `static observedAttributes` at class creation time.

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

`on(type, handler, options?)` is different from `updateElement`-based effects. It calls `createScope()` for proper disposal and directly attaches an event listener to the target element. The handler receives the event and may return a partial property update object like `{ count: host.count + 1 }`. If it does, the updates are applied to the host in a `batch()`. For passive events (scroll, resize, touch, wheel), execution is deferred via `schedule()`.

### pass() — inter-component binding

`pass(props)` is a Le Truc–to–Le Truc optimization. It calls `createScope()` for proper cleanup and directly swaps the backing signal of a descendant component's Slot, creating a zero-overhead live binding: it uses `getSignals(target)` to access the child's internal signal map, captures `slot.current()` before replacing, then calls `slot.replace(signal)`. The cleanup restores the original signal with `slot.replace(original)` when the parent disconnects.

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

During `first()` and `all()` calls, any matched custom element that isn't yet defined (matches `:not(:defined)`) is collected. `resolveDependencies(callback)` then awaits `customElements.whenDefined()` for all of them with a 50ms timeout. On timeout, it logs a `DependencyTimeoutError` but still runs the callback — effects proceed even if dependencies aren't ready.

### Compile-time selector type inference

The file contains a type-level CSS selector parser that infers the correct `HTMLElement` subtype from selector strings at compile time. `first('button')` returns `HTMLButtonElement`, `first('input[type="text"]')` returns `HTMLInputElement`, `first('.foo')` returns `HTMLElement`. This works through template literal types that split combinators, extract tag names, and look them up in `HTMLElementTagNameMap` / `SVGElementTagNameMap` / `MathMLElementTagNameMap`.

## The Parser System

Parsers transform HTML attribute strings into typed JavaScript values. The key design choice: **a Parser is a function with ≥2 parameters** (`(ui, value, old?) => T`), while a **Reader is any function with 1 parameter** (`(ui) => T`). This distinction is checked at runtime via `value.length >= 2` in `isParser()`.

Parsers serve dual duty:
1. As property initializers — `{ config: asJSON({ theme: 'light' }) }` — called during `connectedCallback` with the attribute's initial value
2. As attribute watchers — automatically added to `observedAttributes` and called in `attributeChangedCallback`

The `read(reader, fallback)` function composes a `LooseReader` (which may return `string | null | undefined`) with a parser/fallback into a clean `Reader<T>`. This is useful for reading DOM state and parsing it: `read(ui => ui.input.value, asInteger())`.

## Event-Driven Sensors

`createEventsSensor(init, key, events)` returns a Reader that creates a `Sensor<T>` — a signal driven by DOM events. It uses event delegation: all listeners are attached to the host, and when an event fires, the sensor finds the matching target element via `Node.contains()`.

This is more declarative than `on()`: instead of imperatively updating host properties, the sensor produces a single reactive value from multiple event types. Use case: combining `input`, `change`, `focus`, `blur` into a single state value.

The sensor is created via `createSensor(set => ...)` from `@zeix/cause-effect`, which manages the lifecycle (activate when read, deactivate when unwatched).

## The Context Protocol

Implements the [W3C Community Protocol for Context](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md) for dependency injection between components.

### Provider side

`provideContexts(['theme', 'user'])` returns a function `(host) => Cleanup` that adds a `context-request` event listener. When a matching request arrives, it stops propagation and provides a getter `() => host[context]` to the callback.

This is used as a `MethodProducer` — a property initializer that returns `void` and exists only for its side effects (setting up the listener).

### Consumer side

`requestContext('theme', 'light')` returns a `Reader<Memo<T>>` used as a property initializer. During `connectedCallback`, it dispatches a `ContextRequestEvent` that bubbles up the DOM. If an ancestor provider intercepts it, the consumer receives a getter and wraps it in a `createMemo()`, creating a live reactive binding. If no provider responds, it falls back to the provided default value.

## The Scheduler

`schedule(element, task)` deduplicates high-frequency DOM updates using `requestAnimationFrame`. A `WeakMap<Element, () => void>` stores the latest task per element. If the same element schedules multiple tasks before the next frame, only the last one runs. This is used by `on()` for passive events and by `dangerouslySetInnerHTML`.

## Security

`setAttribute()` includes security validation:
- Blocks `on*` event handler attributes (prevents XSS via attribute injection)
- Validates URLs against an allowlist of safe protocols (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`) — blocks `javascript:`, `data:`, etc.

---

## Key Decisions Summary

| # | Item | Decision | Status |
|---|------|----------|--------|
| 7 | `pass()` scope | Le Truc targets only (Slot swap); use `setProperty()` for foreign custom elements | See Task 11 |
| 8 | Parser/MethodProducer branding | Symbol-branded `asParser()` / `asMethod()` wrappers; DEV_MODE warning for unbranded fallback | Done |
| 9a | Attribute name typo | TypeScript catches it at compile time; add DEV_MODE runtime warning for JS/dynamic cases | Done |
| 9b | Security validation silence | Always throw with a descriptive error; log at `LOG_ERROR` unconditionally | Done |
| 9c | `on()` dual return mode | Keep unified API; improve JSDoc and `@example` | Done |
| 9d | `pass()` signal restore | Restore original signal in cleanup; resolved with item 7 | Done |
| 9e | Dependency timeout visibility | Keep current DEV_MODE warning; document behaviour in JSDoc | Done |
| 9f | `RESET` sentinel | Replace with `undefined`; remove `RESET` export; make `resolveReactive` internal | Done |
| 10 | `runEffects` cleanup fix placement | Use `createScope` wrapper in `on()` / `pass()` | Done |
