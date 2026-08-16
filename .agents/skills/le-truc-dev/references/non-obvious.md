# Non-Obvious Behaviors

Non-obvious behaviors in the le-truc source. These are the things most likely to cause confusion or incorrect changes. Authoritative sources: ARCHITECTURE.md, CONTEXT.md, REQUIREMENTS.md, ADR files in `adr/`, and AGENTS.md.

## Factory Form Opts Out of observedAttributes By Default

`defineComponent` never registers `observedAttributes`/`attributeChangedCallback` on its own — parsers in `expose()` run once at connect time (see ADR 0003). The `observedAttributes()` extension (`src/extensions/attributes.ts`, since v2.3) is the opt-in escape hatch: pass it in `defineComponent`'s third argument and it re-runs the retained `Parser` for named props on each attribute mutation after connect.

Consequences:
- Without the extension, HTML authors can configure the component via attributes in server-rendered markup, but `attributeChangedCallback` never fires afterward
- The distinction is semantic: attributes are for server-side configuration; properties are for reactive client-side state
- With the extension, only props whose initializer is a branded `Parser` are affected — other props stay connect-time-only

## Parser Branding is Required for Reliable Detection

`isParser()` in `src/types.ts` checks only for `PARSER_BRAND`. Unbranded functions are NOT treated as parsers regardless of their signature.

**Always use `asParser()` to create custom parsers.** Parser signature: `(value: string | null | undefined) => T`. Fallbacks are static values captured in the factory closure.

In `DEV_MODE`, using an unbranded function that resembles a parser triggers `console.warn`.

## MethodProducer is Branded, Not Structurally Distinguished

`isMethodProducer()` in `src/types.ts` checks for `METHOD_BRAND` only. An unbranded `() => void` function is treated as a `MemoCallback` (wrapped in `deriveSignal`), not a method producer.

**Always wrap method producer initializers with `defineMethod()`.** The function IS the method — it is installed directly as `host[key] = fn`.

`provideContexts([...])` creates an `EffectDescriptor` and pushes it into the ambient collector (ADR 0018) — no `return` needed as of v2.3, though returning it still works (dual support, deprecated in v3.0).

## `watch()` Requires `createEffect` Internally

`watch()` (via `makeWatch` in `src/helpers/reactive.ts`) wraps `match()` inside `createEffect()`. This is why `watch()`'s descriptor is deferred — the `createEffect` only runs after dependency resolution, inside the `createScope` created in `connectedCallback`. Calling `match()` without `createEffect` would track dependencies synchronously and not re-run. `watch()` also pushes its descriptor into the factory's ambient collector (`pushDescriptor`, `src/internal.ts`) when called — this is separate from and unrelated to `createEffect`'s own owner-registration; both happen, for different reasons (collector = when the descriptor activates; `createEffect`'s owner = where its cleanup lives once activated).

## A Hand-Authored `EffectDescriptor` Needs `watch(() => true, …)` (or an Internal `createEffect`/`createScope` Call) to Actually Clean Up

`activateResult()` (`src/helpers/reactive.ts`) discards the return value of every descriptor it calls during activation. `watch()`/`on()`/`pass()` are unaffected because they call `createEffect()`/`createScope()` *inside* their own descriptor body. That self-registers cleanup onto the active owner, regardless of what the outer caller does with the return value.

A raw hand-authored descriptor — `() => { setup(); return cleanup }`, with no internal `createEffect`/`createScope` call — has **no such registration**. If it's called via `activateResult` directly (i.e. `return`ed from the factory with no wrapping), its cleanup is silently dropped and never runs on disconnect. This was a real, previously-shipping bug in several example components (found during LT-010; see NOTES.md history). The fix wraps the raw descriptor in `watch(() => true, descriptor)`: `() => true` has no signal dependency so it runs once, and `watch()`'s internal `createEffect()` call self-registers the descriptor's returned cleanup. Always register hand-authored descriptors this way, not bare `return`, in new code.

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
- `bindItem`'s 4th parameter (and `each()`'s callback's 2nd) is `first`, from `bindFirst()` in `src/helpers/dom.ts` — `query()` pre-bound to `element`, allocated once per mount, not per structural re-run (see ADR 0021). It never participates in M8 dependency resolution: items added later can never block the host's own effects, since the host's one-time dependency wait happens once at connect, before `reconcile()`'s effect ever runs.

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

`query()`/`queryAll()` and the scoped `first` passed to `each()`/`bindItem` never participate in this — only host-level `first()`/`all()` collect dependencies (ADR 0021).

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

## Debug Mode Guards and the `debug()` Extension

DEV-gated code is guarded inline by `process.env.DEV_MODE === 'true'` at each use site — there is no `DEV_MODE` const, because this exact literal-comparison form is what Bun's minifier folds for dead-code elimination in production builds. Keep the env check first in `&&` chains. `debug()` (`src/extensions/debug.ts`) narrows `DEV_MODE` rather than adding a second mode: its `debug` property only exists when `DEV_MODE` is on, and every effect it drives re-checks the same guard at fire time.

`pulse()` schedules debug writes under a private per-element `WeakMap<Element, PulseState>` token (annotated `/*#__PURE__*/` so DCE doesn't strip it) instead of the element itself, to avoid colliding with `dangerouslyBindInnerHTML`'s `schedule()` key for the same element — any new per-element diagnostic scheduling needs its own key too. `onConnect` injects the debug stylesheet eagerly, not lazily from `pulse()`, and skips only the resting `*:state(debug)` outline if `attachInternals()` isn't available in the environment (older browsers, non-DOM test environments) — every other debug feature still works. `findDebuggableHost()`'s metaKey-toggle walk looks for a `debug` accessor (`'debug' in node`), not a dashed tag name, and crosses shadow boundaries via `parentElement ?? root.host`. `component.ts` statically imports `debug()` and injects it into every component's extensions when `DEV_MODE` is on — a deliberate exception (ADR 0022) to "never statically import a concrete extension module" (ADR 0019); don't make it opt-in or remove the static import.

## Event-Driven Read-Only Props

Expose `state.get` (not the full `State`) to make a prop readable but not settable by consumers. Update the value in an `on()` handler. To watch the prop inside the factory, pass the signal directly: `watch(length, bindVisible(clearBtn))`.

## `expose()` Accepts a `SlotDescriptor` (`{ get, set? }`) for a Mediated Read/Write Prop

`#setAccessor` in `src/component.ts` recognizes a plain `{ get, set? }` object — detected by `isSlotDescriptor()` in `src/util.ts` (a `get` function, no `Signal` brand `Symbol.toStringTag`) — and installs it directly as the property's backing `Slot`, exactly as `createSlot()` (`@zeix/cause-effect`) already accepts a `SlotDescriptor` in place of a `Signal`. This is the same mediated shape `pass()` accepts (ADR 0012), now usable in `expose()` too.

Use this instead of a pair of `watch()` calls syncing two signals by hand (one direction needs an equality guard to avoid re-triggering the other): `expose({ value: { get: () => tokens.get().join(', '), set: v => tokens.set(parse(v)) } })` replaces `watch(tokens, list => host.value = list.join(', '))` + `watch('value', v => { if (!same(parse(v), tokens.get())) tokens.set(parse(v)) })`. Omitting `set` produces a read-only prop; writing to it throws `ReadonlySignalError`, same as any read-only `Signal`.

`isSignal({ get, set })` is `false` (no brand) — this is what lets `#setAccessor` distinguish a descriptor from a static value that happens to be an arbitrary object. `formResetCallback`/`formAssociatedCheckbox()`'s reset path (`src/extensions/form.ts`) also checks `isSlotDescriptor()` before treating an initializer as a literal default to reassign — a descriptor has no "default", so reset is a no-op for it, same as for a `Signal` or callback initializer.

See `examples/form/tokenbox/form-tokenbox.ts` for a real usage.

## Testing a DEV-Gated Branch: Flip the Env Var, No Module Mocking

Since v2.3, DEV guards read `process.env.DEV_MODE` at call time (no import-time const), so a test exercises a DEV branch by setting `process.env.DEV_MODE = 'true'` around the call and restoring the previous value in a `finally` (see `withDevMode` in `src/tests/context.test.ts`, and the inline pattern in `events.test.ts` / `reactive.test.ts`). The historical `mock.module('../util', …)` + namespace-snapshot dance is gone — do not reintroduce it. One residual caveat: the env var is process-global, so while an `await` is pending inside a DEV-enabled window, guards in interleaved tests from other files also see it. That only produces extra `console.warn` calls; keep warn-counting assertions inside the same file (bun runs a file's tests sequentially) and this stays benign.
