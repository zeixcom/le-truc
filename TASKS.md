# Tasks

Prioritized from top (quick fixes, no API changes) to bottom (design decisions needed).

## 7. Add `Object.defineProperty` fallback to `pass()` for non-Le Truc components

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

---

## 8. Eliminate `function.length` detection for parsers

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
