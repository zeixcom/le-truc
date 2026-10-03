# Coordination between components

Use one mechanism per relationship. Docs: [data flow](https://zeixcom.github.io/le-truc/data-flow.html), [context](https://zeixcom.github.io/le-truc/context.html).

| Relationship | Mechanism |
|---|---|
| Parent drives a known Le Truc child's prop | `pass(child, { prop: () => host.x })` |
| Parent drives a non-Le-Truc element (native, Lit, Stencil, plain CE) | `watch(src, bindProperty(el, key))` |
| Parent drives a child prop the child also edits | `watch(…, bindProperty(child, 'value'))` down, plus a `change` listener reading `child.value` up |
| Parent reacts to anything that bubbles from inside | `on(host, 'type', …)` |
| Per-element effects on current and future descendants | `all(sel)` + `each()` |
| Ancestor shares state at unknown depth | `provideContexts([...])` / `requestContext(ctx, fallback)` |
| Parent needs a child to *act* (focus, clear) | a `defineMethod()` on the child, called by the parent |
| Siblings | Not supported. Lift the state to a common ancestor. |

Reaching into a child's DOM (`first('child-tag button')`, `child.querySelector(…)`) is an ownership violation even when it works. If the child's contract can't express what you need, extend the child: a writable prop, a derived prop, or a method.

## `pass()`

- **It works only on Le Truc children, and it replaces signals, not values.** It calls `slot.replace(signal)` on the child's backing Slot. A native element throws `InvalidCustomElementError`. A Lit, Stencil or plain custom element has no Slot, so it throws `InvalidPassPropertyError`. Both are contained, and nothing binds.
- **Only two forms are accepted**: a thunk (`() => host.label`, read-only from the child's side) or a `{ get, set }` descriptor (writes are mediated). The property-key short form (`{ value: 'value' }`) and bare signals, including bare read-only memos, were removed in v3.0. They fail validation, and nothing is swapped.
- **The target prop must be Slot-backed**, meaning the child exposed it from a mutable initializer (a value, a Parser, a mutable signal, or `{ get, set }`). A prop exposed as `state.get`, as `() => …`, or as `defineMethod()` has a plain getter, so `pass()` can't target it.
- **A getter-only pass makes the child's own writes throw** `ReadonlySignalError`. That includes the child's event handlers, its methods, and a form-associated child's `formResetCallback`. Use a thunk only when the child never writes the prop itself.
- A getter-only pass into a prop that feeds an internal derived display can **freeze that display** on its seed value, because the derivation keeps reading the old cell. Use the `watch` + `bindProperty` + commit-on-change shape instead.
- `{ get, set }` re-enters on the library's own internal writes. Form reset re-commits through `set`, so form children prefer commit-on-change.
- When the parent disconnects, the child's original signal comes back, and the child regains independent state.
- A `Cell<E[]>` target from `all()` passes to every element, each with its own lifecycle.

## Context

- Follows the Web Components CG context protocol. `requestContext(ctx, fallback)` returns a Slot-backed `Signal<T>` for use **inside `expose()`**. It serves `fallback` until a provider answers.
- **Retries**: when no ancestor answers at first, it re-dispatches once on a microtask and once after about 210 ms. That catches providers that upgrade later. After the last retry, the fallback is permanent for that connection, and dev mode warns.
- Context is requested **once per component lifetime**, at first connect. Reconnecting does not request it again.
- **Providers are stable sources of truth.** `provideContexts(['theme'])` provides the named **props of the provider's host**. Update those values. Don't add, remove or swap providers at runtime. A connected consumer keeps the last provided value even after the provider is removed, so a DOM move doesn't flicker. Give consumers a fallback that makes sense for a provider that is genuinely absent.
- **Put context keys in a side-effect-free module.** `createContext('theme')` keys must not be imported from the provider's component module, because importing that module defines the element.
- A hand-written provider checks `event.context`, never `instanceof ContextRequestEvent`. A host in another realm (an iframe, a build-time simulation) dispatches a plain `Event` that carries the same fields.
- `provideContexts()` answers string keys only.

## Events

- To communicate upward, dispatch a `CustomEvent` with `bubbles: true` from the child, and listen with `on(host, 'type', …)` in the ancestor. Return `{ prop: value }` from the handler to update the ancestor's host.
- A delegated `on(all('…'), type, …)` puts one listener on the host and hands the matched element to the handler. Non-bubbling events need `each()` + `on()`.
