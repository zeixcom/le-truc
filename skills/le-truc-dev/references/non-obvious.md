<overview>
Non-obvious behaviors in the le-truc source. These are the things most likely to cause confusion or incorrect changes.
Distilled from CLAUDE.md — that file is authoritative; this file is a quick reference.
</overview>

## Factory form opts out of observedAttributes entirely

`defineComponent` sets `static observedAttributes = []` unconditionally. This is a deliberate trade-off, not an oversight.

Consequences:
- Parsers in `expose()` are called **once at connect time** — HTML authors can configure the component via attributes in server-rendered markup, but `attributeChangedCallback` never fires afterward.
- The distinction is semantic: attributes are for server-side configuration; properties are for reactive client-side state.
- There is no mechanism to make attributes reactive after connect — reactive state flows through the property interface only.

The `FactoryContext` and `FactoryResult` types (both exported from `src/component.ts`) are the TypeScript surface for this pattern.

## Parser branding is required for reliable detection

`isParser()` checks only for `PARSER_BRAND`. Unbranded functions are NOT treated as parsers regardless of their signature.

**Always use `asParser()` to create custom parsers.** Parser signature: `(value: string | null | undefined) => T`.

In `DEV_MODE`, using an unbranded function that resembles a parser triggers `console.warn`.

## MethodProducer is branded, not structurally distinguished

`isMethodProducer()` checks for `METHOD_BRAND` only. An unbranded `() => void` function is treated as a `MemoCallback` (wrapped in `createComputed`), not a method producer.

**Always wrap method producer initializers with `asMethod()`.** The function IS the method — it is installed directly as `host[key] = fn`.

## `watch()` requires `createEffect` internally

`watch()` (via `makeWatch`) wraps `match()` inside `createEffect()`. This is why `watch()` returns an `EffectDescriptor` — the `createEffect` only runs after dependency resolution, inside the `createScope` created in `connectedCallback`. Calling `match()` without `createEffect` would track dependencies synchronously and not re-run.

## `all()` MutationObserver is lazy

The observer only activates when the `Memo` is **read inside a reactive effect**. If no effect reads the Memo, mutations are not tracked. This is intentional (avoids unnecessary observers) but can look like a bug.

The observer watches only mutations implied by the CSS selector (class, ID, `[attr]` patterns) — not all mutations. An `innerHTML` mutation that does not change which elements match the selector does not invalidate the Memo (since cause-effect 0.18.4, the `equals` check is fully respected).

## `pass()` scope is Le Truc components only

`pass()` replaces the backing `Slot` signal of a child's property using `getSignals(target)`. For non-Le-Truc elements (Lit, Stencil, FAST, plain custom elements), `getSignals` returns nothing useful — the swap has no effect.

**For non-Le-Truc elements, use `watch()` + `bindProperty()` instead.**

## `safeSetAttribute` throws on unsafe values — never silent

Two security checks throw errors (logged at `LOG_ERROR`):
1. Attribute name starts with `on` (case-insensitive) — blocks event handler injection
2. URL value uses an unsafe protocol — blocks `javascript:`, `data:`, etc. Allowed: `http:`, `https:`, `ftp:`, `mailto:`, `tel:`

`bindAttribute` uses `safeSetAttribute` by default. Pass `allowUnsafe: true` only when the value has been validated upstream.

## `undefined` from a reader restores the original DOM value

When a reactive resolves to `undefined`, the component degrades gracefully to the pre-JS state. The `RESET` symbol no longer exists — `undefined` is the reset mechanism.

## Dependency resolution has a 200ms timeout

If a child custom element queried by `first()` or `all()` is not defined within 200ms, a `DependencyTimeoutError` is logged and effects proceed anyway. Effects run even if dependencies are missing — they do not block indefinitely.

## `on()` handler return value updates host

If an event handler returns `{ prop: value }`, all returned entries are applied to `host` in a `batch()`. Returning `void` (or `undefined`) is a no-op — no host update occurs. The handler always receives `(event, element)` — second arg is the element, useful for Memo targets.

## Debug mode

- Per-instance: `host.debug = true` — verbose per-effect logging for that instance
- Project-wide: build with `process.env.DEV_MODE=true` — enhanced errors, unbranded parser warnings
