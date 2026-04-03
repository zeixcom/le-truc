<overview>
Non-obvious behaviors in the le-truc source. These are the things most likely to cause confusion or incorrect changes.
Distilled from CLAUDE.md — that file is authoritative; this file is a quick reference.
</overview>

## Factory form opts out of observedAttributes entirely

The 2-param factory form sets `static observedAttributes = []` unconditionally. The factory result's `props` map is evaluated per-instance at connect time — after `customElements.define()` has already run — so it is structurally impossible to derive `observedAttributes` from it. This is a deliberate trade-off, not an oversight.

Consequences:
- Parsers in the factory `props` map are called **once at connect time** — HTML authors can configure the component via attributes in server-rendered markup, but `attributeChangedCallback` never fires afterward.
- The distinction is semantic: attributes are for server-side configuration; properties are for reactive client-side state. Both forms support the initial attribute read.
- If attribute changes on a live document must drive reactive updates, use the 4-param form.

The `ComponentFactory` and `ComponentFactoryResult` types (both exported from `src/component.ts`) are the TypeScript surface for this pattern.

## Parser branding is required for reliable detection

`isParser()` checks for `PARSER_BRAND` first. Unbranded functions fall back to `fn.length >= 2`, which is **unreliable**:

- Default parameters reduce `fn.length`: `(ui, value = '') => …` has `length === 1`
- Rest parameters reduce `fn.length`: `(ui, ...args) => …` has `length === 1`
- Destructuring does not reduce length but can cause confusion

**Always use `asParser()` to create custom parsers.** In `DEV_MODE`, using an unbranded function triggers `console.warn`.

## MethodProducer is branded, not structurally distinguished

`isMethodProducer()` checks for `METHOD_BRAND` only. An unbranded `(ui) => void` function is treated as a Reader (initialised at connect time), not a method producer.

**Always wrap method producer initializers with `asMethod()`.** Example: `clearMethod`, `add`, `delete` in `module-list`.

`provideContexts()` is an `Effect`, not a method producer. Use it in `setup` as `host: provideContexts([...])`, not in `props`.

## `all()` MutationObserver is lazy

The observer only activates when the `Memo` is **read inside a reactive effect**. If no effect reads the Memo, mutations are not tracked. This is intentional (avoids unnecessary observers) but can look like a bug.

The observer watches only mutations implied by the CSS selector (class, ID, `[attr]` patterns) — not all mutations. An `innerHTML` mutation that does not change which elements match the selector does not invalidate the Memo (since cause-effect 0.18.4, the `equals` check is fully respected).

## `pass()` scope is Le Truc components only

`pass()` replaces the backing `Slot` signal of a child's property using `getSignals(target)`. For non-Le-Truc elements (Lit, Stencil, FAST, plain custom elements), `getSignals` returns nothing useful — the swap has no effect.

**For non-Le-Truc elements, always use `setProperty()`.** Installing a reactive getter via `Object.defineProperty` (which is what `pass()` does internally) bypasses external frameworks' change-detection.

## `setAttribute` throws on unsafe values — never silent

Two security checks throw errors (logged at `LOG_ERROR`):
1. Attribute name starts with `on` (case-insensitive) — blocks event handler injection
2. URL value uses an unsafe protocol — blocks `javascript:`, `data:`, etc. Allowed: `http:`, `https:`, `ftp:`, `mailto:`, `tel:`

Violations are never silently swallowed. If `setAttribute` appears not to work, check the console for these errors first.

## `undefined` from a reader restores the original DOM value

When a reactive resolves to `undefined` (reader error, missing property, etc.), `updateElement` restores the DOM value captured at setup time — not blank/null. This is correct behavior: the component degrades gracefully to the pre-JS state rather than wiping content.

The `RESET` symbol no longer exists. `undefined` is the reset mechanism.

## Dependency resolution has a 200ms timeout

If a child custom element queried by `first()` or `all()` is not defined within 200ms, a `DependencyTimeoutError` is logged and effects proceed anyway. Effects run even if dependencies are missing — they do not block indefinitely.

## `toggleAttribute` and `setAttribute` default to the effect name

```typescript
toggleAttribute('loading')     // reads host.loading
setAttribute('aria-label')     // reads host['aria-label']
```

The second argument (reactive) may be omitted when the attribute name matches the property name. This means `toggleAttribute('aria-expanded', 'open')` is different: it reads `host.open`, not `host['aria-expanded']`.

## `on()` handler return value updates host

If an event handler returns `{ prop: value }`, all returned entries are applied to `host` in a `batch()`. Returning `void` (or `undefined`) is a no-op — no host update occurs.

## Debug mode

- Per-instance: `host.debug = true` — verbose per-effect logging for that instance
- Project-wide: build with `process.env.DEV_MODE=true` — enhanced errors, unbranded parser warnings
