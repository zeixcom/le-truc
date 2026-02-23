# Tasks

Prioritized from top (quick fixes, no API changes) to bottom (design decisions needed).

### 7. `pass()` Slot-backed cleanup fix

**Status: Done.**

- `pass()` now captures `slot.current()` before replacing and restores it on cleanup, removing a latent bug when a child is detached/reattached without its parent.
- A `Object.defineProperty` fallback for non-Le Truc custom elements was also added (Path B), but this is being removed in Task 11 — see below.

---

### 8. Parser/Reader/MethodProducer disambiguation

**Status: Done.**

- `PARSER_BRAND` and `METHOD_BRAND` symbols added to `src/parsers.ts`
- `isParser()` now checks `PARSER_BRAND` first; falls back to `fn.length >= 2` with a DEV_MODE `console.warn` to prompt migration
- All built-in parsers (`asInteger`, `asNumber`, `asBoolean`, `asJSON`, `asString`, `asEnum`) are branded via `asParser()` in their factory functions
- `asParser()` and `asMethod()` exported as new public API for custom parsers/method-producers
- `isMethodProducer()` exported for brand checking
- `provideContexts()` now uses `asMethod()` to brand its returned function
- `component.ts` `createSignal()` dispatch order is now explicit: Parser → MethodProducer → Reader → static/Signal
- MethodProducer cleanup functions are now properly composed with the effect cleanup in `disconnectedCallback`

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

**Status: Done.**

The `EventHandler` type now has a JSDoc comment explaining both return modes. The `on()` JSDoc was updated to document both modes explicitly, with `@example` blocks showing side-effect-only handlers and the property-update shortcut. No API changes.

---

### 9e. Dependency resolution timeout

**Status: Done.**

The `resolveDependencies` JSDoc now documents the 200ms timeout, the degraded-but-functional outcome, and the rationale (progressive enhancement). No runtime behaviour changes — the existing DEV_MODE warning via `console.warn` is adequate.

---

### 9f. Remove the `RESET` sentinel

**Status: Done.**

`resolveReactive()` now returns `undefined` on error. `updateElement` treats `undefined` as the restore-fallback signal. The `RESET` symbol and its export have been removed from `effects.ts`. The `types/src/effects.d.ts` declaration file was updated accordingly.

---

### 10. `runEffects` cleanup fix — architecture decision

**Status: Done. No further implementation work needed.**

**Decision**: `on()` and `pass()` own their `createScope` internally. `runEffects` calls effect functions directly.

**Rationale**: This follows the same pattern as `updateElement`-based effects, which call `createEffect()` internally. `on()` and `pass()` wrap their body in `createScope()` so their cleanup is registered with the ambient owner without the caller needing to know. This is symmetric with how `createEffect` self-registers. The alternative — wrapping in `runEffects` — placed framework-internal knowledge (which effects return plain cleanups vs. self-register) at the wrong abstraction layer.

---

### 11. Remove `pass()` Path B (`Object.defineProperty` fallback for non-Le Truc elements)

**Status: Proposed.**

**Background**: Task 7 added a fallback path to `pass()` for non-Le Truc custom elements: when no Slot exists for a property, `pass()` installs a reactive getter via `Object.defineProperty`. This approach is fundamentally broken for framework-managed components (Lit, Stencil, FAST, etc.): those frameworks detect change by intercepting the *setter* (or via `requestUpdate()`), not by polling the getter. Installing a getter-only descriptor means the framework never sees a set and never re-renders. The binding appears correct in tests (property reads return the reactive value) but the child component's own render/effects are never triggered.

The idiomatic approach for non-Le Truc elements is `setProperty()`, which calls `el[key] = value` through the public setter on every reactive change — always correct for any element regardless of its internal framework.

**Changes**:

- `src/effects/pass.ts`: Remove Path B entirely (descriptor inspection, `Object.defineProperty`, restore cleanup). If no Slot exists for a property on the target, emit a DEV_MODE `console.warn` directing the user to `setProperty()`, then skip. Remove the `[reactive, callback]` two-way binding array form from `PassedProp` — this was only meaningful for Path B.
- `src/errors.ts`: `InvalidCustomElementError` stays; `pass()` still validates its target is a custom element.
- `examples/module-catalog/module-catalog.ts`: Remove `vanillaButton` target and the unsafe cast.
- `examples/module-catalog/module-catalog.html`: Remove the `<vanilla-button>` test fixture.
- `examples/module-catalog/module-catalog.spec.ts`: Remove the `pass() Object.defineProperty fallback` test suite.
- `examples/main.ts`: Remove the `vanilla-button` registration.
- `docs-src/api/functions/pass.md`: Remove Path B description; add guidance directing non-Le Truc targets to `setProperty()`.

**Two-way binding (`[reactive, callback]`)**: The array form `[reactive, setter]` was introduced solely for the Path B `Object.defineProperty` setter. With Path B removed, there is no meaningful two-way channel — Le Truc Slot-backed children already expose their own writable `set` via the Slot descriptor, so a parent can just read from the child via a Reader. Remove `PassedProp` array variant and the `isArray` branch in `pass()`.
