# Non-Obvious Behaviors

Non-obvious behaviors in the le-truc source. These are the things most likely to cause confusion or incorrect changes. Authoritative sources: ARCHITECTURE.md, CONTEXT.md, REQUIREMENTS.md, ADR files in `adr/`, and AGENTS.md.

## Factory Form Opts Out of observedAttributes Entirely

`defineComponent` never registers `observedAttributes` — `attributeChangedCallback` support was dropped entirely in v2.0 (see ADR 0003).

Consequences:
- Parsers in `expose()` are called **once at connect time** — HTML authors can configure the component via attributes in server-rendered markup, but `attributeChangedCallback` never fires afterward
- The distinction is semantic: attributes are for server-side configuration; properties are for reactive client-side state
- There is no mechanism to make attributes reactive after connect — reactive state flows through the property interface only

## Parser Branding is Required for Reliable Detection

`isParser()` in `src/types.ts` checks only for `PARSER_BRAND`. Unbranded functions are NOT treated as parsers regardless of their signature.

**Always use `asParser()` to create custom parsers.** Parser signature: `(value: string | null | undefined) => T`. Fallbacks are static values captured in the factory closure.

In `DEV_MODE`, using an unbranded function that resembles a parser triggers `console.warn`.

## MethodProducer is Branded, Not Structurally Distinguished

`isMethodProducer()` in `src/types.ts` checks for `METHOD_BRAND` only. An unbranded `() => void` function is treated as a `MemoCallback` (wrapped in `createComputed`), not a method producer.

**Always wrap method producer initializers with `defineMethod()`.** The function IS the method — it is installed directly as `host[key] = fn`.

`provideContexts([...])` creates an `EffectDescriptor` and pushes it into the ambient collector (ADR 0018) — no `return` needed as of v2.3, though returning it still works (dual support, deprecated in v3.0).

## `watch()` Requires `createEffect` Internally

`watch()` (via `makeWatch` in `src/helpers/reactive.ts`) wraps `match()` inside `createEffect()`. This is why `watch()`'s descriptor is deferred — the `createEffect` only runs after dependency resolution, inside the `createScope` created in `connectedCallback`. Calling `match()` without `createEffect` would track dependencies synchronously and not re-run. `watch()` also pushes its descriptor into the factory's ambient collector (`pushDescriptor`, `src/internal.ts`) when called — this is separate from and unrelated to `createEffect`'s own owner-registration; both happen, for different reasons (collector = when the descriptor activates; `createEffect`'s owner = where its cleanup lives once activated).

## A Hand-Authored `EffectDescriptor` Needs `run()` (or an Internal `createEffect`/`createScope` Call) to Actually Clean Up

`activateResult()` (`src/helpers/reactive.ts`) discards the return value of every descriptor it calls during activation. `watch()`/`on()`/`pass()` are unaffected because they call `createEffect()`/`createScope()` *inside* their own descriptor body, which self-registers cleanup onto the active owner regardless of what the outer caller does with the return value. A raw hand-authored descriptor — `() => { setup(); return cleanup }`, with no internal `createEffect`/`createScope` call — has **no such registration**: if it's called via `activateResult` directly (i.e. `return`ed from the factory with no wrapping), its cleanup is silently dropped and never runs on disconnect. This was a real, previously-shipping bug in several example components (found during LT-010; see NOTES.md history). `run(descriptor)` fixes it by wrapping the raw descriptor in `createScope()` before pushing it — always register hand-authored descriptors via `run()`, not bare `return`, in new code.

## `all()` MutationObserver is Lazy

The observer in `src/helpers/dom.ts` only activates when the `Memo` is **read inside a reactive effect**. If no effect reads the Memo, mutations are not tracked. This is intentional (avoids unnecessary observers) but can look like a bug.

The observer watches only mutations implied by the CSS selector (class, ID, `[attr]` patterns) — not all mutations. Since `cause-effect` 0.18.4, the memo's `equals` check is fully respected: if an `innerHTML` mutation doesn't change which elements match the selector, downstream effects do not re-run.

## `reconcile()` Owns the Container; `each()` Does Not

`reconcile(container, template, source, bindItem)` (src/helpers/reactive.ts) is data-driven and owns the container's children — the opposite ownership of `each()`, which enhances DOM the component doesn't own. Non-obvious details (see ADR 0017):

- The source parameter is the **branded** union `List<T> | Collection<T>`, not a structural interface — `Store<T>` satisfies the shape but is deliberately excluded (its items are not homomorphic).
- First run **adopts** existing children by `data-key` and removes everything else, including unkeyed children (self-cleaning). `bindItem` runs for adopted elements too and must be idempotent against server-rendered content.
- Children with `data-unreconciled` are structurally invisible: never removed, never repositioned, no `bindItem`. But an element `reconcile()` itself placed that later gains the attribute (mid-drag pin) still **claims its key** — otherwise a re-run would clone a duplicate for it.
- Positioning is keyed-relative (after the previous keyed sibling), not absolute-index, so unmanaged elements never drift keyed positions.
- Internal element→key bookkeeping is a `WeakMap`; `data-key` on the DOM exists for SSR adoption and event delegation — complementary, not either/or.
- The driving effect reads `source.keys()` only; everything after is wrapped in `untrack()`, so signal reads inside `bindItem` do not become structural dependencies.
- Ownership follows `keyedScopes`: per-item scopes are `{ root: true }`, an outer `createScope` registers teardown-all on the component scope, and leavers are disposed before their elements are removed and before enterers mount.

## `pass()` Scope is Le Truc Components Only

`pass()` (`makePass` in `src/helpers/reactive.ts`) replaces the backing `Slot` signal of a child's property using `getSignals(target)` from `src/internal.ts`. It only works for Le Truc components whose properties are Slot-backed. For any other custom element or plain HTML element, use `bindProperty()` instead.

**For non-Le-Truc elements, use `watch()` + `bindProperty()` instead.**

The original signal is captured and restored when the parent disconnects, so the child regains its own independent state after detachment.

**The property-key (`'value'`) and bare-writable-signal short forms are deprecated (ADR 0012).** Both resolve to the parent's writable signal and grant the child unrestricted `.set()`; they warn in DEV_MODE and are removed in the next major. Use the thunk (`() => host.prop`, read-only) or descriptor (`{ get, set }`, mediated writable) forms. Read-only signals (`Memo`/`Task`) passed directly do not warn.

**Every entry in `props` is validated before any signal is swapped (ADR 0011).** If a passed prop doesn't exist on the target, can't be resolved to a signal, or isn't Slot-backed — which is exactly what happens when the target is a non-Le-Truc element, or the prop is read-only/computed — `pass()` throws `InvalidPassPropertyError` naming every failing prop, instead of silently no-op'ing. This is a deferred-activation throw (ADR 0007): it happens inside `connectedCallback`, after the calling factory has already returned, so it cannot be caught by the factory's own code — it surfaces as an uncaught error (`pageerror`), the same way `InvalidPropertyNameError` does.

## `safeSetAttribute` Throws on Unsafe Values — Never Silent

Two security checks in `src/bindings.ts` throw errors:
1. Attribute name starts with `on` (case-insensitive) — blocks event handler injection
2. URL value uses an unsafe protocol — blocks `javascript:`, `data:`, `vbscript:` etc. Allowed: `http:`, `https:`, `ftp:`, `mailto:`, `tel:`

`bindAttribute` uses `safeSetAttribute` by default. Pass `allowUnsafe: true` only when the value has been validated upstream.

## `undefined` from a Reactive Source Restores the Original DOM Value

When a reactive resolves to `undefined`, the component degrades gracefully to the pre-JS state. The `RESET` symbol no longer exists — `undefined` is the reset mechanism.

## Dependency Resolution Has a 200ms Timeout

If a child custom element queried by `first()` or `all()` in `src/helpers/dom.ts` is not defined within 200ms, a `DependencyTimeoutError` is logged and effects proceed anyway. Effects run even if dependencies are missing — they do not block indefinitely.

## `on()` Handler Return Value Updates Host

If an event handler in `src/helpers/events.ts` returns `{ prop: value }`, all returned entries are applied to `host` in a `batch()`. Returning `void` (or `undefined`) is a no-op — no host update occurs. The handler always receives `(event, element)` — second arg is the element, useful for Memo targets.

## Context Protocol is the Web Components Community Protocol

`provideContexts` / `requestContext` implement the [webcomponents-cg context spec](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md), not a custom protocol. `provideContexts([...])` registers an `EffectDescriptor` automatically (ADR 0018) — call it directly, `return` is not required; `requestContext(context, fallback)` returns a `Signal<T>` backed by a `Slot`, used directly in `expose()`. The Slot serves `fallback` until a provider answers; a provider that misses the initial synchronous dispatch is caught by two re-dispatches — once on a microtask and once after `CONTEXT_RETRY_DELAY` (~210 ms) — after which the fallback is permanent for that connection (ADR 0015). Providers are stable single sources of truth: removing one does not revert connected consumers to their fallback.

## `bindVisible` is the Inverse of `el.hidden`

`bindVisible(el)` sets `el.hidden = !value`. A value of `true` makes the element visible.

## `bindAttribute` Returns `SingleMatchHandlers`, Not a Function

Use as `watch('prop', bindAttribute(el, 'name'))` — `watch` accepts both a plain function and a `SingleMatchHandlers` object.

## `bindAttribute` Boolean Dispatch

When the reactive value is boolean, `toggleAttribute` is called — the attribute is added (without value) when `true` and removed when `false`. Do not pass boolean for attributes that require a string value.

## `bindStyle` Nil Path Removes Inline Style

When the reactive is nil, `el.style.removeProperty(prop)` is called, restoring whatever value the CSS cascade provides. Setting the reactive back to a string re-applies the inline style.

## Debug Mode

`DEV_MODE` is the only debug mode — build with `process.env.DEV_MODE=true` for enhanced errors and unbranded-parser warnings. There is no per-instance debug flag.

## Event-Driven Read-Only Props

Expose `state.get` (not the full `State`) to make a prop readable but not settable by consumers. Update the value in an `on()` handler. To watch the prop inside the factory, pass the signal directly: `watch(length, bindVisible(clearBtn))`.

## Testing a DEV_MODE-Gated Branch Requires `mock.module`, and a Snapshot

`DEV_MODE` (`src/util.ts`) is a module-level `const` captured at import time, so setting `process.env.DEV_MODE` from a test has no effect on already-loaded consumers (`helpers/context.ts`, `helpers/events.ts`, `helpers/dom.ts`, …). `bun:test`'s `mock.module('../util', factory)` does retroactively patch the live binding in already-imported consumers — but it mutates the module's namespace object **in place**. A captured `import * as ns from '../util'` reference is therefore not a stable snapshot: after the first `mock.module` call, `ns.DEV_MODE` reflects the mock, not the original. Restoring with `mock.module('../util', () => ns)` just re-feeds the already-mutated values, permanently corrupting `DEV_MODE` for the rest of the `bun test` process (confirmed: produced a real cross-file leak into unrelated tests). Fix: spread the namespace into a plain object (`const realUtil = { ...ns }`) once, before any mocking, and restore from that snapshot — never from the live namespace. Keep the whole mock→assert→restore sequence synchronous (no `await` in between); an `await` point lets `bun:test` interleave other files' tests while the mock is still active. See `src/tests/context.test.ts` and `src/tests/events.test.ts` for the pattern.
