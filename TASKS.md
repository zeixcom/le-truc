# Tasks

## A) Clarify the Property Initializer API

### Status

Needs design decision — to be discussed with Solution Architect.

### Problem

The second parameter of `defineComponent()` accepts a plain object whose values can be one of five different things:

| Kind | Example | Detection | Result |
|---|---|---|---|
| **Static value** | `{ count: 0 }` | Not a function, not a Signal | `createState(value)` — read-write property |
| **Signal** | `{ state: createState(false) }` | `isSignal(value)` | Used directly — read-write or read-only depending on signal type |
| **Parser** | `{ count: asInteger(5) }` | `isParser(value)` — i.e. `fn.length >= 2` | `createState(parsed)` — read-write, added to `observedAttributes` |
| **Reader** | `{ value: read(ui => ui.input.value, asInteger()) }` | `isFunction(value)` and `fn.length < 2` | Return value passed to `#setAccessor` — typically a Signal or plain value |
| **MethodProducer** | `{ _ctx: provideContexts([...]) }` | Same as Reader (`isFunction` with 1 param) | Returns `void`; `#setAccessor` is silently skipped |

This creates several interrelated issues:

#### 1. Parser vs Reader detection relies on `function.length`

The distinction is checked at runtime via `value.length >= 2` in `isParser()`. This is fragile:

- A function `(ui, value = '') => ...` has `length === 1` and would be misclassified as a Reader.
- Rest parameters, destructuring, and default parameters all affect `function.length` in non-obvious ways.
- This is the kind of bug that would take hours to diagnose — the parser silently becomes a reader, the attribute is never observed, and the value is wrong.

The built-in parsers (`asString`, `asNumber`, etc.) work correctly because they're factory functions that return a properly-shaped inner function. But a user writing a custom parser inline could easily trip over this.

#### 2. Reader vs MethodProducer is indistinguishable

Both are functions with one parameter. The only difference is the return value:
- A Reader returns a value (which becomes the property's initial signal value).
- A MethodProducer returns `void` (and exists purely for side effects like setting up context listeners).

This works by convention: `#setAccessor` is only called when the result is non-null, so a MethodProducer's `undefined` return silently skips property creation. But:
- There's no way to explicitly declare intent ("this is a side effect, not a value").
- If a MethodProducer accidentally returns a truthy value, it would create a property accessor — a silent, confusing bug.
- The TypeScript types can't distinguish them; `MethodProducer<P, U>` is typed as `(ui) => void` but the union in `Initializers` can't enforce the return type at the call site.

#### 3. The `read()` helper is non-obvious

`read(ui => ui.input.value, asInteger())` composes a DOM reader with a parser/fallback. This is powerful but the mental model isn't immediately clear:
- Why does `read()` exist separately from parsers?
- When should I use `read()` vs a plain parser vs an initializer function?
- The name `read` doesn't convey that it's specifically for reading *from the DOM* and parsing the result.

#### 4. The object form hides the initialization order

All five kinds are mixed together in a flat object. There's no visual distinction between "this reads from an attribute" (parser), "this reads from the DOM" (reader), "this sets up a side effect" (MethodProducer), and "this is just a default value" (static). A newcomer scanning the props object has no way to tell what each entry does without understanding the detection heuristics.

### What works well (preserve this)

- **Built-in parsers as property values**: `{ count: asInteger(5) }` is concise and reads naturally. Most users will only ever use this form plus static values.
- **The `read()` helper**: Once understood, `read(ui => ui.input.value, asInteger())` is elegant. The composition of "where to read from" + "how to parse/fallback" is a good separation.
- **Sensors as property values**: `{ selected: createEventsSensor(...) }` fits naturally because the sensor *is* a reader that returns a Signal.
- **Context consumers**: `{ theme: requestContext(MEDIA_THEME, 'light') }` reads clearly.

### What should improve

1. **Eliminate `function.length` as a detection mechanism.** The parser/reader distinction should be explicit, not inferred from parameter count. Options include branded types, wrapper functions, a static property marker, or a different API shape entirely.

2. **Make MethodProducer intent explicit.** Side-effect-only initializers like `provideContexts()` should be clearly distinguishable from value-producing readers, both at the type level and at runtime.

3. **Clarify the mental model for users.** The docs should (and the API ideally would) make it immediately obvious which kind of initializer you're looking at. This might mean:
   - A function form for the props parameter that provides named helpers (e.g. `({ attr, dom, method }) => ({ count: attr(asInteger(5)), value: dom(ui => ui.input.value, asInteger()), _ctx: method(provideContexts([...])) })`)
   - Or keeping the object form for the simple/common cases and recommending the function form when readers or method producers are involved.

### Constraints

- The simple cases (`{ count: 0 }`, `{ count: asInteger(5) }`, `{ state: createState(false) }`) should remain as concise as they are today. Don't add ceremony to the 80% case to fix the 20% case.
- Whatever the detection mechanism becomes, it must work for both TypeScript and plain JavaScript users.
- Built-in parsers, `read()`, `createEventsSensor()`, `requestContext()`, and `provideContexts()` should all continue to work as property initializers — the API should get clearer, not more limited.
- Backward compatibility with 0.16 is not required (pre-1.0), but migration should be straightforward.

---

## B) Make `pass()` more robust with non-Le Truc components

### Status

Needs investigation.

### Problem

`pass()` currently requires the target element to be a Le Truc component with Slot-backed properties. If the target is a non-Le Truc custom element (Lit, Stencil, vanilla, etc.), `getSignals()` returns an empty map, `isSlot(slot)` is false for every property, and the call silently does nothing. There is no error, no warning — the binding just doesn't work.

This is surprising because the *intent* of `pass()` — "keep this child property in sync with a parent reactive value" — is framework-agnostic. A Lit element with a standard property descriptor could reasonably be a `pass()` target.

### What should improve

1. **Clear error or warning when `pass()` has no effect.** If a property exists on the target but has no Slot, the user should know that the binding wasn't established. A dev-mode warning at minimum; a thrown error for properties that don't exist at all on the target.

2. **Investigate falling back to `Object.defineProperty()` for non-Slot targets.** The pre-0.16 implementation used property descriptor overriding, which worked for any element with configurable property descriptors. This could serve as a fallback path:
   - If the target has a Slot for the property → use `slot.replace()` (current behavior).
   - If the target has a configurable property descriptor → override with a reactive getter/setter and restore on cleanup.
   - If neither → warn/error in dev mode.

   This would make `pass()` interoperable with other Web Component libraries where properties are typically configurable.

### Open questions

- Should the `Object.defineProperty()` fallback restore the original descriptor on cleanup? (The old implementation did this, but cleanup is no longer needed for Le Truc components since parent and child unmount together.)
- Are there Web Component libraries where property descriptors are non-configurable? If so, `pass()` would still silently fail for those — is that acceptable?
- Should `pass()` work with plain HTML elements (e.g. setting `input.value` reactively)? This would expand its scope significantly but could be useful.

---

## C) Replace the 50ms dependency timeout with a more robust solution

### Status

Needs design decision.

### Problem

When a component's `first()` or `all()` queries find custom elements that aren't yet defined (registered via `customElements.define()`), Le Truc collects them as dependencies and waits for `customElements.whenDefined()` before running effects. This wait is capped by a hardcoded 50ms timeout (`DEPENDENCY_TIMEOUT` in `src/ui.ts`).

This creates several issues:

#### 1. 50ms is too short for real-world scenarios

On slower devices, over slow networks with lazy-loaded component bundles, or in large pages where many components initialize concurrently, 50ms is frequently not enough. The timeout fires, effects run against un-upgraded elements, and the component may behave incorrectly until the dependency eventually upgrades (at which point nothing re-runs the effects).

#### 2. Errors are swallowed silently

The `resolveDependencies` implementation catches *all* errors (not just timeouts) and runs the callback anyway:

```js
.catch(() => {
  // Error during setup of <${name}>. Trying to run effects anyway.
  callback()
})
```

The `DependencyTimeoutError` is constructed and passed to `reject`, but the `.catch` discards it. In dev mode, there's no visible warning. The only clue is that effects may behave oddly because they're running against `:not(:defined)` elements.

#### 3. No recovery after late upgrade

If a dependency does get defined after the timeout, the component's effects have already run against the un-upgraded element. There's no mechanism to re-run effects once the dependency becomes available. The component is stuck in a degraded state.

### What should improve

1. **Make the timeout configurable or adaptive.** A global configuration, a per-component option, or an adaptive strategy (e.g. exponential backoff, or waiting longer if the document is still loading) would all be better than a hardcoded 50ms.

2. **Log the timeout in dev mode.** At minimum, the `DependencyTimeoutError` should be surfaced to the console in dev mode so developers know when dependencies aren't resolving in time.

3. **Consider re-running effects when late dependencies upgrade.** A `customElements.whenDefined()` listener could trigger effect re-initialization for components that ran against un-upgraded dependencies. This would make the timeout a performance optimization (run early if possible) rather than a correctness risk (run broken if too slow).

4. **Don't swallow non-timeout errors.** The `.catch(() => callback())` pattern discards all errors. At minimum, unexpected errors (anything that isn't a `DependencyTimeoutError`) should be re-thrown or logged.

### Constraints

- The common case (all dependencies already defined) must remain synchronous and zero-overhead — the current `if (dependencies.size) ... else callback()` fast path is good.
- The solution must not block rendering indefinitely — a component with a missing dependency should still eventually initialize, even if in a degraded state.
- Any re-run mechanism must avoid infinite loops if a dependency never gets defined.
