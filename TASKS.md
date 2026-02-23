# Tasks

Prioritized from top (quick fixes, no API changes) to bottom (design decisions needed).

### 7. `pass()` fallback for non-Le Truc components

**Effort:** Medium | **API change:** None (expanded behavior) | **Status:** Needs investigation

Currently `pass()` only works with Le Truc Slot-backed properties. The pre-0.16 implementation used `Object.defineProperty()` to override property descriptors, which worked with any custom element.

**Action:**
- Add a fallback path in `pass()`: if the target has no Slot for a property but has a configurable property descriptor, override it with a reactive getter/setter.
- Restore the original descriptor on cleanup (the effect should return a cleanup function in this case).
- In `DEV_MODE`, warn if the descriptor is non-configurable (binding not possible).
- Test with Lit, Stencil, and vanilla custom elements.

**Open questions:**
- Should `pass()` also work with plain HTML elements (e.g. `input.value`)? This would significantly expand scope — consider deferring to a separate effect like `setProperty()`.
- Are there Web Component libraries where property descriptors are non-configurable? Acceptable to warn and skip in those cases.

**Decision: Do. Extend `pass()` with an `Object.defineProperty` fallback, scoped to custom elements only.**

`pass()` today silently skips properties without a Slot and only emits a DEV_MODE warning. The pre-0.16 behaviour — overriding the property descriptor with a reactive getter/setter — worked with any custom element. Restoring it as a fallback path makes `pass()` composable with Lit, Stencil, and vanilla Web Components without changing the existing Slot-fast-path.

**Integration analysis:**

- **Vanilla custom elements**: Property descriptors defined in the constructor or class body with `Object.defineProperty` are configurable by default. The fallback will work and must save and restore the original descriptor on cleanup.
- **Lit**: Lit reactive properties are defined on the class prototype via `@property()` or `static properties`. Prototype-level descriptors are configurable. The fallback's `Object.defineProperty` on the *instance* will shadow the prototype descriptor correctly. Lit's internal `_$changedProperties` mechanism fires `update()` on set; overriding via instance property descriptor bypasses Lit's setter, meaning Lit's reactive rendering **will not re-run** — which is the desired behavior (Le Truc is driving the update, not Lit).
- **Stencil**: Stencil components expose reactive props as instance properties with configurable descriptors. The fallback works. Same caveat: Stencil's internal change detection won't fire, which is acceptable in a `pass()` binding scenario.
- **Non-configurable descriptors**: Some libraries (e.g. sealed/frozen class fields via TC39 class fields without explicit `configurable: true`) produce non-configurable descriptors. The fallback must detect this via `Object.getOwnPropertyDescriptor()` and log a DEV_MODE warning rather than throw.

**Scope boundary**: `pass()` targets custom elements (elements whose `localName` contains a hyphen). Extending to plain HTML elements (e.g. `input.value`) is explicitly **deferred** — it overlaps with `setProperty()` and the scope expansion is not justified by current use cases.

**Signal restore on cleanup (9d resolved here)**: Because the fallback path requires an explicit cleanup function (to restore the original descriptor), this is the right moment to also restore the original signal in the Slot-backed path. The assumption "child always dies with parent" holds for the *primary* use case, but signal restore is cheap (one `slot.replace(originalSignal)` call) and removes a latent bug if a child component is ever detached and reattached without its parent. Make `pass()` return a cleanup function that restores both the Slot's original signal and any overridden property descriptors.

---

### 8. Parser/Reader/MethodProducer disambiguation

**Effort:** Large | **API change:** Yes (branded types or wrapper) | **Status:** Needs design decision

`isParser()` (`src/parsers.ts:30-33`) distinguishes parsers from readers by checking `fn.length >= 2`. This is fragile: default parameters, rest parameters, and destructuring all affect `function.length` in non-obvious ways. A custom parser `(ui, value = '') => ...` has `length === 1` and would be silently misclassified as a reader.

**Action — choose one approach:**

**8a. Branded functions (minimal API change):** Add a symbol property to parser functions. The built-in parsers already go through factory functions, so branding is easy. Custom parsers would use a helper: `asParser((ui, value) => ...)`.

**8b. Explicit wrapper (clearer intent):** Require parsers to be wrapped — `{ count: asInteger(5) }` already works (factory), custom parsers use `asParser(fn)`. Readers remain unwrapped or use `read()`.

Either approach also fixes the Reader vs MethodProducer ambiguity: branding makes intent explicit for all three kinds. `provideContexts()` and similar would be branded as side-effect initializers, distinguishable from value-returning readers at both the type level and runtime.

**Constraints:**
- `{ count: 0 }`, `{ count: asInteger(5) }`, `{ state: createState(false) }` must stay as-is.
- Built-in parsers, `read()`, `createEventsSensor()`, `requestContext()`, `provideContexts()` must all continue to work.
- Must work for both TypeScript and plain JavaScript.
- Pre-1.0, so backward compat not required, but migration should be straightforward.

**Decision: Do. Use symbol-branded functions. Introduce `asParser()` and `asMethod()` wrappers. Keep `function.length` detection only as a transitional DEV_MODE warning.**

The `function.length` check is a pre-1.0 known-bug (REQUIREMENTS R1). It must be resolved before the API is frozen.

**Chosen approach — symbol branding (8a), applied to all three kinds:**

A private symbol `PARSER_BRAND` is added as a non-enumerable property to every parser function. `isParser()` checks for the symbol first, falls back to `fn.length >= 2` for backward compatibility, and in DEV_MODE warns when the fallback is triggered. After 1.0, the `fn.length` fallback is removed.

Built-in parsers (`asInteger`, `asBoolean`, `asJSON`, `asString`, `asEnum`, `asNumber`) are already produced by factory functions — branding is a one-line addition in each factory. `read()` returns a Reader, not a Parser, so it is not branded.

`provideContexts()` and any future MethodProducers return a function that is branded with a `METHOD_BRAND` symbol. `isMethodProducer()` checks for this brand. In `connectedCallback`, the dispatch order becomes explicit: branded Parser → branded MethodProducer → Reader → static/Signal. This removes the convention that "returns undefined → skip `#setAccessor`" and replaces it with an explicit check.

**New public API surface (additive, no breaking changes to existing call sites):**

```ts
// For custom parsers:
asParser((ui, value) => ...) → Parser<T, U>  (branded)

// For custom MethodProducers:
asMethod((ui) => { /* side effects */ }) → MethodProducer<P, U>  (branded)
```

Existing built-in parsers and `provideContexts()` are internally branded — no change for users of these APIs. Custom parsers and MethodProducers are rare today; the wrapper functions are acceptable ergonomically.

**Type-level impact**: `Initializers<P, U>` can narrow the `Parser` branch to require the brand at the type level, making it a compile-time error to pass an unbranded two-argument function as a parser property initializer.

---

## 9. API Least-Astonishment Review (pre-1.0 checklist)

These items each map to a "Surprising Behavior" in `CLAUDE.md`. They are already working correctly; the question for each is whether the current design is the right one to ship at 1.0, or whether a small API adjustment would make the behavior more discoverable and predictable for users.

---

### 9a. `setAttribute`/`toggleAttribute` default reactive typo detection

**Status: Done.**

`resolveReactive()` now emits a DEV_MODE `console.warn` when a string reactive property name is not found on the host. This catches typos like `setAttribute('hreff')` in JavaScript and dynamic cases not covered by TypeScript's type-level `keyof P` guard.

---

### 9b. `setAttribute` security validation — fail loudly

**Status: Done.**

`safeSetAttribute` throws descriptive errors that identify the attribute name, the element, and the blocked value. These errors propagate to `updateElement`'s `err()` callback which logs at `LOG_ERROR` level unconditionally (already the case via `log()`). Security failures are never silent in any environment.

---

### 9c. `on()` handler return value

**Current behaviour:** An event handler returning `{ prop: newValue }` updates host properties via `batch()`; returning `undefined` (or nothing) is a no-op side-effect. Both are valid and silently accepted.

**Why it's surprising:** This is a hidden dual-mode API. The type `EventHandler` allows both, but there is no syntactic distinction between an intentional side-effect handler and one that accidentally returns nothing. An early-return branch that forgets to return an update object silently becomes a no-op.

**Architect question:** Could the two modes be split into distinct APIs (e.g. `on()` for side-effects only, `update()` or a second argument for property-updating handlers)? Or is the unified return-value convention ergonomic enough to keep, and the type system provides sufficient guidance?

**Decision: Keep the unified API. Improve types and JSDoc. No API split.**

Splitting `on()` into two functions (side-effect-only vs. property-updating) would be an additive API change with no ergonomic gain — the type system already discriminates via the return type `{ [K in keyof P]?: P[K] } | void | Promise<void>`. The "dual mode" is not a hidden feature; it follows the exact pattern of `addEventListener` callbacks returning values for auto-batching, which is a documented shortcut.

The real issue is discoverability. The fix is documentation and types:

1. **JSDoc**: Clarify that returning an object is the shortcut for `batch(() => { host.prop = value })`. Make explicit that side-effect-only handlers return `void` and that is always correct. Add an `@example` showing both forms.
2. **Type rename**: `EventHandler<P, Evt>` is accurate but opaque. Consider a comment in the type definition explaining the two return modes.
3. **No new API**: `update()` as a second function would create two overlapping APIs with no mechanical difference. Reject.

---

### 9e. Dependency resolution timeout

**Current behaviour:** If a queried custom element isn't defined within 200ms, a `DependencyTimeoutError` is logged to the console and effects proceed anyway — potentially in a degraded or broken state.

**Why it's surprising:** "Log and continue" makes the component appear to work while actually running effects against undefined dependencies. The error is easy to miss in production (console-only).

**Architect question:** Should a timed-out dependency emit the error through a more visible channel (e.g. a custom event on the host, or an `aria-errormessage` attribute in `DEV_MODE`)? Or should effects be blocked entirely when a required dependency times out, with an explicit opt-in to the "proceed anyway" behaviour?

**Decision: DEV_MODE warning (existing behaviour) is sufficient. Non-declared elements must not break the component.**

A single undefined custom element should never break an entire component. The "proceed anyway" behaviour is the correct default — it is what makes progressive enhancement viable. Blocking effects entirely would be a regression.

The existing behaviour (log `DependencyTimeoutError`, then run effects) is correct. What needs improvement is visibility in DEV_MODE:

- The warning already fires via `console.warn`. This is adequate for development.
- A custom event on the host (`host.dispatchEvent(new CustomEvent('dependency-timeout', ...))`) is over-engineered — it adds API surface and event handling complexity for a scenario that should not happen in production if the component is correctly assembled.
- An `aria-errormessage` attribute in DEV_MODE is inappropriate: ARIA attributes are semantic; injecting them as debug markers would pollute accessibility trees.

No change to the runtime behaviour. The DEV_MODE warning is adequate. Document the timeout value (200ms) and the degraded-but-functional outcome in JSDoc on `resolveDependencies`.

---

### 9f. Remove the `RESET` sentinel

**Status: Done.**

`resolveReactive()` now returns `undefined` on error. `updateElement` treats `undefined` as the restore-fallback signal. The `RESET` symbol and its export have been removed from `effects.ts`. The `types/src/effects.d.ts` declaration file was updated accordingly.
