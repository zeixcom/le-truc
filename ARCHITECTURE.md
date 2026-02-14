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
  util.ts             Logging, element introspection, property validation

  effects/
    attribute.ts      setAttribute, toggleAttribute
    class.ts          toggleClass
    event.ts          on() — event listener effect
    html.ts           dangerouslySetInnerHTML
    method.ts         callMethod, focus
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
- A function → `createComputed(fn)` (read-only, non-configurable)
- Anything else → `createState(value)` (read-write, configurable)

Then defines a property descriptor on the component instance with `get: signal.get` and `set: signal.set` (if mutable). This is what makes `host.count` reactive — reading it calls `signal.get()` inside effects, which registers the dependency automatically.

### attributeChangedCallback — attribute sync

Only fires for properties whose initializer `isParser` (function with ≥2 parameters). These are collected into `static observedAttributes` at class creation time.

When an attribute changes: parse the new value through the parser, then assign it to the component property (which triggers `signal.set()`). Computed (read-only) signals are skipped.

### disconnectedCallback — cleanup

Calls the cleanup function returned by `runEffects()`, which tears down all effects and event listeners.

## The Effect System

### Three layers

1. **`runEffects(ui, effects)`** — top-level orchestrator. Iterates the keys of the effects record. For each key, checks whether `ui[key]` is a `Memo` (from `all()`) or a single `Element` (from `first()`), and delegates accordingly.

2. **`runElementsEffects(host, elementChanges, effects)`** — handles dynamic collections. Creates a `createEffect()` that watches the `Memo<ElementChanges>` and attaches/detaches per-element effects as elements are added or removed from the DOM.

3. **`runElementEffects(host, target, effects)`** — runs one or many effect functions against a single target element, collecting their cleanup functions.

### updateElement — the shared abstraction

Every built-in effect (`setAttribute`, `toggleClass`, `setText`, `setProperty`, `setStyle`, `toggleAttribute`, `dangerouslySetInnerHTML`, `callMethod`, `focus`, `show`) follows the same pattern via `updateElement(reactive, updater)`:

```
updateElement(reactive, { op, name, read, update, delete? })
  │
  ├─ Captures fallback = read(target)     ← current DOM value
  │
  └─ createEffect(() => {
       value = resolveReactive(reactive)   ← auto-tracks signal deps
       if value === RESET  → use fallback
       if value === null && delete exists → delete(target)
       if value !== current → update(target, value)
     })
```

The `Reactive<T>` type is a union of three forms:
- `keyof P` — a string property name on the host (reads `host[name]`)
- `Signal<T>` — a signal (calls `.get()`)
- `(target: E) => T` — a reader function

`resolveReactive()` handles all three and returns the concrete value. Because it calls `.get()` inside a `createEffect`, signal dependencies are automatically tracked.

### The RESET sentinel

`RESET` is a `Symbol('RESET')` typed as `any`. When a reactive resolves to `RESET` (e.g., the reader function threw an error), the effect restores the original DOM value captured at setup time.

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
| `callMethod(name, reactive, args?)` | `m` | Calls a method when reactive is truthy |
| `focus(reactive)` | `m` | Calls `el.focus()` when truthy |

All default their `reactive` parameter to the effect name (e.g., `setAttribute('href')` reads `host.href`).

### on() — event listener effect

`on(type, handler, options?)` is different from `updateElement`-based effects. It directly attaches an event listener to the target element. The handler receives the event and may return a partial property update object like `{ count: host.count + 1 }`. If it does, the updates are applied to the host in a `batch()`. For passive events (scroll, resize, touch, wheel), execution is deferred via `schedule()`.

### pass() — inter-component binding

`pass(props)` overrides property descriptors on a child Le Truc component, replacing them with getters (and optional setters) that read from the parent's signals. This creates a live reactive binding between parent and child without the child needing to know about the parent. On cleanup, original descriptors are restored.

## The UI Query System

`getHelpers(host)` returns `[{ first, all }, resolveDependencies]`.

### first(selector, required?)

Calls `root.querySelector()`. If the matched element is an undefined custom element, its tag name is added to the dependency set. Returns the element or `undefined` (throws `MissingElementError` if `required` is provided and element is missing).

### all(selector, required?)

Returns a `Memo<ElementChanges<E>>` created by `observeSelectorChanges()`. This sets up a `MutationObserver` (lazily, via the `watched` option on `createMemo`) that watches for `childList`, `subtree`, and relevant attribute changes. The memo tracks `{ current: Set<E>, added: E[], removed: E[] }` — a diff of which elements matching the selector were added or removed.

The `MutationObserver` config is smart about which attributes to watch: `extractAttributes(selector)` parses the CSS selector to find attribute names implied by `.class`, `#id`, and `[attr]` patterns.

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

`requestContext('theme', 'light')` returns a `Reader<Memo<T>>` used as a property initializer. During `connectedCallback`, it dispatches a `ContextRequestEvent` that bubbles up the DOM. If an ancestor provider intercepts it, the consumer receives a getter and wraps it in `createComputed()`, creating a live reactive binding. If no provider responds, it falls back to the provided default value.

## The Scheduler

`schedule(element, task)` deduplicates high-frequency DOM updates using `requestAnimationFrame`. A `WeakMap<Element, () => void>` stores the latest task per element. If the same element schedules multiple tasks before the next frame, only the last one runs. This is used by `on()` for passive events and by `dangerouslySetInnerHTML`.

## Security

`setAttribute()` includes security validation:
- Blocks `on*` event handler attributes (prevents XSS via attribute injection)
- Validates URLs against an allowlist of safe protocols (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`) — blocks `javascript:`, `data:`, etc.

---

## Open Questions

### Parser/Reader distinction via `function.length`

The distinction between Parser (≥2 params) and Reader (1 param) is detected at runtime via `value.length >= 2`. This is fragile — default parameters, rest parameters, and destructuring all affect `function.length` in non-obvious ways. A function `(ui, value = '') => ...` has `length === 1` and would be misclassified as a Reader. This is a potential source of subtle bugs. Would a branded type, a wrapper function, or a static property be a more robust marker?

### MethodProducer is invisible in the type system

`MethodProducer<P, U>` is defined as `(ui) => void`, but `isReaderOrMethodProducer` just checks `isFunction`. There's no way to distinguish a `Reader` from a `MethodProducer` at runtime — the only difference is that a MethodProducer returns `void` and relies on side effects (like `provideContexts`). Since `#setAccessor` is only called when the result is non-null, this works by convention, but the flow is non-obvious: the MethodProducer's return value (`undefined`) causes `#setAccessor` to be silently skipped, which is the desired behavior but isn't explicitly documented in the code.

### Dependency timeout of 50ms

`DEPENDENCY_TIMEOUT` is hardcoded at 50ms. This seems very short — on slower devices or with lazy-loaded component definitions, this could fire frequently. The error is logged but effects still run, so it's non-fatal, but it could cause effects to run against not-yet-upgraded elements. Is this timeout well-calibrated? Should it be configurable?

### `resolveDependencies` uses Promise.race with error swallowing

The dependency resolution catches all errors and runs the callback anyway. The `.catch(() => { callback() })` pattern means even unexpected errors (not just timeouts) are silently swallowed. The `DependencyTimeoutError` is constructed and passed to `reject`, but the actual logging happens... nowhere visible. The error is created inside a `new Promise((_, reject) => { reject(new DependencyTimeoutError(...)) })`, which rejects the race, but the `.catch` just calls `callback()` without logging the error.

### `CircularMutationError` is defined but never thrown

`CircularMutationError` is exported from `errors.ts` and from `index.ts`, but no code in the repository actually throws it. Is this dead code left from a previous implementation, or is it intended for future use?

### `callMethod` reads `() => null` as fallback

`callMethod` uses `read: () => null` — it never reads the current state. This means it always runs `update()` when the reactive is truthy, even if the method was already called. For idempotent methods like `focus()` this is fine, but for methods with side effects it could cause redundant calls. The `focus` effect partially addresses this with `read: el => el === document.activeElement`, but this pattern isn't consistent.

### Commented-out code in effects.ts and component.ts

`effects.ts` contains a large commented-out `insertOrRemoveElement` function with its `ElementInserter` type. `component.ts` has commented-out lines in `#setAccessor` involving `UNSET` and `prev` signal cleanup. These suggest in-progress or abandoned features. Should they be removed, or are they actively being worked on?

### `on()` event handler can't access component UI

The `on()` effect handler receives only the event — it cannot access the component's `ui` object (unlike `createEventsSensor` handlers, which receive `{ event, ui, target, prev }`). This means `on()` handlers can't easily read from other UI elements. Is this intentional to keep `on()` simple, or is it a limitation that should be addressed?

### `createEventsSensor` captures `targets` once

In `createEventsSensor`, the `targets` array is computed once at sensor creation time from the current state of the `Memo`. If the collection changes later (elements added/removed), the sensor won't pick up new targets. For `Memo`-based collections that are specifically designed to be dynamic, this seems like a gap.

### `dangerouslySetInnerHTML` script handling

The script re-execution logic clones scripts by copying only `textContent` and `type`. This drops `src`, `async`, `defer`, `crossorigin`, `integrity`, `nomodule`, and other attributes. External scripts (`<script src="...">`) will silently become empty inline scripts. Is this intentional (security boundary) or an oversight?
