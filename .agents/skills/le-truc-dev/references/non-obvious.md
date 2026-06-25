# Non-Obvious Behaviors

Non-obvious behaviors in the le-truc source. These are the things most likely to cause confusion or incorrect changes. Authoritative sources: ARCHITECTURE.md, CONTEXT.md, REQUIREMENTS.md, ADR files in `adr/`, and AGENTS.md.

## Factory Form Opts Out of observedAttributes Entirely

`defineComponent` sets `static observedAttributes = []` unconditionally in `src/component.ts`. This is a deliberate trade-off (see ADR 0003).

Consequences:
- Parsers in `expose()` are called **once at connect time** — HTML authors can configure the component via attributes in server-rendered markup, but `attributeChangedCallback` never fires afterward
- The distinction is semantic: attributes are for server-side configuration; properties are for reactive client-side state
- There is no mechanism to make attributes reactive after connect — reactive state flows through the property interface only

## Parser Branding is Required for Reliable Detection

`isParser()` in `src/component.ts` checks only for `PARSER_BRAND`. Unbranded functions are NOT treated as parsers regardless of their signature.

**Always use `asParser()` to create custom parsers.** Parser signature: `(value: string | null | undefined) => T`. Fallbacks are static values captured in the factory closure — not reader functions.

In `DEV_MODE`, using an unbranded function that resembles a parser triggers `console.warn`.

## MethodProducer is Branded, Not Structurally Distinguished

`isMethodProducer()` in `src/component.ts` checks for `METHOD_BRAND` only. An unbranded `() => void` function is treated as a `MemoCallback` (wrapped in `createComputed`), not a method producer.

**Always wrap method producer initializers with `defineMethod()`.** The function IS the method — it is installed directly as `host[key] = fn`.

`provideContexts([...])` returns an `EffectDescriptor` — include it in the return array.

## `watch()` Requires `createEffect` Internally

`watch()` (via `makeWatch` in `src/effects.ts`) wraps `match()` inside `createEffect()`. This is why `watch()` returns an `EffectDescriptor` — the `createEffect` only runs after dependency resolution, inside the `createScope` created in `connectedCallback`. Calling `match()` without `createEffect` would track dependencies synchronously and not re-run.

## `all()` MutationObserver is Lazy

The observer in `src/ui.ts` only activates when the `Memo` is **read inside a reactive effect**. If no effect reads the Memo, mutations are not tracked. This is intentional (avoids unnecessary observers) but can look like a bug.

The observer watches only mutations implied by the CSS selector (class, ID, `[attr]` patterns) — not all mutations. Since `cause-effect` 0.18.4, the memo's `equals` check is fully respected: if an `innerHTML` mutation doesn't change which elements match the selector, downstream effects do not re-run.

## `pass()` Scope is Le Truc Components Only

`pass()` (`makePass` in `src/helpers/reactive.ts`) replaces the backing `Slot` signal of a child's property using `getSignals(target)` from `src/internal.ts`. It only works for Le Truc components whose properties are Slot-backed. For any other custom element or plain HTML element, use `bindProperty()` instead.

**For non-Le-Truc elements, use `watch()` + `bindProperty()` instead.**

The original signal is captured and restored when the parent disconnects, so the child regains its own independent state after detachment.

**Every entry in `props` is validated before any signal is swapped (ADR 0011).** If a passed prop doesn't exist on the target, can't be resolved to a signal, or isn't Slot-backed — which is exactly what happens when the target is a non-Le-Truc element, or the prop is read-only/computed — `pass()` throws `InvalidPassPropertyError` naming every failing prop, instead of silently no-op'ing. This is a deferred-activation throw (ADR 0007): it happens inside `connectedCallback`, after the calling factory has already returned, so it cannot be caught by the factory's own code — it surfaces as an uncaught error (`pageerror`), the same way `InvalidPropertyNameError` does.

## `safeSetAttribute` Throws on Unsafe Values — Never Silent

Two security checks in `src/bindings.ts` throw errors:
1. Attribute name starts with `on` (case-insensitive) — blocks event handler injection
2. URL value uses an unsafe protocol — blocks `javascript:`, `data:`, `vbscript:` etc. Allowed: `http:`, `https:`, `ftp:`, `mailto:`, `tel:`

`bindAttribute` uses `safeSetAttribute` by default. Pass `allowUnsafe: true` only when the value has been validated upstream.

## `undefined` from a Reader Restores the Original DOM Value

When a reactive resolves to `undefined`, the component degrades gracefully to the pre-JS state. The `RESET` symbol no longer exists — `undefined` is the reset mechanism.

## Dependency Resolution Has a 200ms Timeout

If a child custom element queried by `first()` or `all()` in `src/ui.ts` is not defined within 200ms, a `DependencyTimeoutError` is logged and effects proceed anyway. Effects run even if dependencies are missing — they do not block indefinitely.

## `on()` Handler Return Value Updates Host

If an event handler in `src/events.ts` returns `{ prop: value }`, all returned entries are applied to `host` in a `batch()`. Returning `void` (or `undefined`) is a no-op — no host update occurs. The handler always receives `(event, element)` — second arg is the element, useful for Memo targets.

## Context Protocol is the Web Components Community Protocol

`provideContexts` / `requestContext` implement the [webcomponents-cg context spec](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md), not a custom protocol. `provideContexts([...])` returns an `EffectDescriptor` used in the return array; `requestContext(context, fallback)` returns a `Memo<T>` used directly in `expose()`.

## `bindVisible` is the Inverse of `el.hidden`

`bindVisible(el)` sets `el.hidden = !value`. A value of `true` makes the element visible.

## `bindAttribute` Returns `SingleMatchHandlers`, Not a Function

Use as `watch('prop', bindAttribute(el, 'name'))` — `watch` accepts both a plain function and a `SingleMatchHandlers` object.

## `bindAttribute` Boolean Dispatch

When the reactive value is boolean, `toggleAttribute` is called — the attribute is added (without value) when `true` and removed when `false`. Do not pass boolean for attributes that require a string value.

## `bindStyle` Nil Path Removes Inline Style

When the reactive is nil, `el.style.removeProperty(prop)` is called, restoring whatever value the CSS cascade provides. Setting the reactive back to a string re-applies the inline style.

## Debug Mode

- Per-instance: `host.debug = true` — verbose per-effect logging for that instance
- Project-wide: build with `process.env.DEV_MODE=true` — enhanced errors, unbranded parser warnings

## Event-Driven Read-Only Props

Expose `state.get` (not the full `State`) to make a prop readable but not settable by consumers. Update the value in an `on()` handler. To watch the prop inside the factory, pass the signal directly: `watch(length, bindVisible(clearBtn))`.

## Testing a DEV_MODE-Gated Branch Requires `mock.module`, and a Snapshot

`DEV_MODE` (`src/util.ts`) is a module-level `const` captured at import time, so setting `process.env.DEV_MODE` from a test has no effect on already-loaded consumers (`context.ts`, `events.ts`, `dom.ts`, …). `bun:test`'s `mock.module('../util', factory)` does retroactively patch the live binding in already-imported consumers — but it mutates the module's namespace object **in place**. A captured `import * as ns from '../util'` reference is therefore not a stable snapshot: after the first `mock.module` call, `ns.DEV_MODE` reflects the mock, not the original. Restoring with `mock.module('../util', () => ns)` just re-feeds the already-mutated values, permanently corrupting `DEV_MODE` for the rest of the `bun test` process (confirmed: produced a real cross-file leak into unrelated tests). Fix: spread the namespace into a plain object (`const realUtil = { ...ns }`) once, before any mocking, and restore from that snapshot — never from the live namespace. Keep the whole mock→assert→restore sequence synchronous (no `await` in between); an `await` point lets `bun:test` interleave other files' tests while the mock is still active. See `src/tests/context.test.ts` and `src/tests/events.test.ts` for the pattern.
