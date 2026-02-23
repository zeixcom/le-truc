# Tasks

Prioritized from top (quick fixes, no API changes) to bottom (design decisions needed).

### 7. `pass()` fallback for non-Le Truc components

**Status: Done.**

- **Slot path**: `pass()` now captures `slot.current()` before replacing and restores it on cleanup, removing a latent bug when a child is detached/reattached without its parent.
- **Fallback path**: when no Slot exists for a property, `pass()` checks `Object.getOwnPropertyDescriptor()` (own and prototype). If configurable, installs a reactive getter (and optional setter for `[reactive, callback]` two-way binding) via `Object.defineProperty` on the instance. Restores the original descriptor on cleanup.
- **Non-configurable**: logs a DEV_MODE `console.warn` and skips the property.
- **Scope**: custom elements only (already validated by `isCustomElement()`).
- `pass()` now always returns a cleanup function when at least one binding was installed.

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

The `createScope(() => fn(host, target))` wrapper in `runEffects` is the correct and final solution.

**Decision**: Keep the `createScope` wrapper in `runEffects`. Do not move scope ownership into `on()` or `pass()`.

**Rationale**: The alternative — having `on()` and `pass()` self-register with the ambient owner using `registerCleanup(activeOwner, cleanup)` — requires importing `registerCleanup` and `activeOwner` from `@zeix/cause-effect`. These are exported from the internal `src/graph` module but intentionally absent from the public `index.ts`. Using them would couple Le Truc to private implementation details that can change without a semver bump. The uniform `createScope` wrapper at the call site in `runEffects` is the correct abstraction boundary: `runEffects` already owns the component's top-level scope, and wrapping each effect in a child scope is a natural extension of that ownership. The extra scope node for `updateElement`-based effects (which already self-register via `createEffect`) is structurally harmless — `createEffect` registers with the child scope as its owner, not with both scopes.

**Invariant established**: Every effect function in the effects map runs inside its own child `createScope`. Cleanup always propagates correctly on component disconnect, regardless of whether the effect calls `createEffect` internally or returns a plain cleanup function.
