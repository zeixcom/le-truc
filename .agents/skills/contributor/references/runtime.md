# Runtime (`src/`)

Pointers and constraints for the runtime library. `ARCHITECTURE.md` has the file map, the lifecycle, the effect system, queries, parsers and context. `types/index.d.ts` has the exported surface. This file keeps only what those documents do not say.

## Library boundary

`@zeix/cause-effect` owns every reactive primitive: signals, tracking, batching, ownership and `match()`. Le Truc owns the component model, DOM bindings, parsers, DOM queries, the context protocol, attribute security and the rAF scheduler. Le Truc re-exports the full cause-effect surface.

> A feature that needs no browser or DOM API belongs in cause-effect. A feature that touches the DOM or the Custom Elements API belongs here.

- The signal type set is complete. Before you propose a new type on either side, show that existing types cannot compose to cover the need.
- Changes are additive. A break is acceptable only when a platform change moves the best way to reach the existing goals.
- For signal-level questions, use `skills/cause-effect/`, and treat `node_modules/@zeix/cause-effect/src/` as authoritative.

## How the runtime uses cause-effect

- **Every `expose()`d prop is backed by a Slot.** `#setAccessor` installs the Slot as the property descriptor. As a result, reading `host.prop` in an effect tracks the prop, and `pass()` can `slot.replace()` the backing signal. The parent restores the original signal on disconnect.
- **`all()`** returns a `Cell<E[]>` from `createElementsMemo()`. A `watched` option makes its MutationObserver lazy. Element-identity `equals` skips re-runs while the matched set stays the same.
- **Ownership:** `connectedCallback` opens one `createScope()`, and `disconnectedCallback` disposes it. `watch()` wraps `match()` in `createEffect()`. `on()` and `pass()` nest their own scopes. `each()` wraps the per-element loop in an outer effect that tracks the Cell.
- **A returned object from an `on()` handler** is applied to `host` in one `batch()`.
- **Signal types must satisfy `T extends {}`**: no `null` or `undefined` in signal generics. Parsers return `T`, so use a fallback value.
- Every `createEffect` must be inside an owner. Nothing top-level, ever.

## Debugging checklist

Work through these in order when an effect misbehaves:

1. Was the helper called synchronously, during factory or `each()` execution? A call after an `await` throws `NoActiveCollectorError`.
2. If the descriptor is hand-authored, is it wrapped as `watch(() => true, d)`? Without the wrap, its cleanup is dropped.
3. Does `toSignal()` resolve the source you expect?
4. Does the `bind*` helper get the element you expect?
5. If it is a timing issue, check the dependency-resolution timeout and whether the `all()` observer has a reader yet.

When the bug is in the reactive graph itself, escalate it to cause-effect. Do not patch around it here.
