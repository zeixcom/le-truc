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
