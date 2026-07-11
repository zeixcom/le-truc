# ADR 0015: Late-Provider Retry in requestContext

## Status

✅ Accepted

## Context

[ADR 0008](0008-community-protocol-for-context.md) established the Community Protocol for Context as Le Truc's context mechanism. Its consumer-side helper, `requestContext(context, fallback)`, originally dispatched a single `ContextRequestEvent` synchronously during the consumer's factory run and then permanently locked in whatever it received: if no ancestor provider answered at that instant, the returned `Memo<T>` served the `fallback` forever.

A provider realistically misses that instant in non-buggy setups:

- The provider component's `customElements.define()` runs **after** the consumer's — module ordering in the same bundle, a code-split chunk, or a deferred script. The provider element exists in the DOM above the consumer, but it isn't upgraded yet, so its `context-request` listener isn't attached when the consumer dispatches.
- The provider is upgraded, but its own factory hasn't activated its `provideContexts` descriptor yet. Descriptors activate **after dependency resolution** ([ADR 0007](0007-effect-descriptors-with-deferred-activation.md)), which involves at minimum a `queueMicrotask` and possibly a 200 ms `customElements.whenDefined()` wait (`DEPENDENCY_TIMEOUT` in `src/helpers/dom.ts`). A parent provider that queries slow children attaches its listener *later* than a fast child consumer dispatches.

The failure was silent: the consumer rendered with the fallback and never recovered. This undermined [M10](../REQUIREMENTS.md#m10-context-protocol) and the progressive-enhancement story (components must degrade gracefully, then *recover*).

## Decision

Back the `requestContext` resolved value with a `Slot` — the same primitive `pass()` uses for overridable backing signals — and re-dispatch the context request up to two more times.

The returned `Signal<T>` is a `createSlot(createState(fallback))`: it initially delegates to a `State` holding the `fallback`. When a provider answers, its getter `() => host[context]` is wrapped in a `createMemo(getter)` (so reading the memo tracks the provider's underlying signal) and swapped in via `slot.replace()`. The `Slot`'s own computation reads the delegated signal inside a tracking context (`fn: () => delegated.get()` in the cause-effect implementation), so a single `slot.get()` tracks both the swap (late binding) and the provider's live value updates. Using `Slot` unifies the "maybe-overridable signal" story: `pass()` and `requestContext` are both cases where a property's backing signal may be replaced after creation, and now both use the same primitive.

The provider's callback delivers a getter function, not a `Signal`, so the `createMemo(getter)` is the adapter that turns that getter into a tracked signal the `Slot` can delegate to. This memo is internal to `requestContext` — consumers only see the `Signal<T>`.

The dispatch sequence:

1. **Synchronous** — during the factory run, as before.
2. **Microtask retry** — `queueMicrotask`, catches providers upgraded later in the same bundle whose `define()` calls run before the microtask drains. Skipped if already answered or the host disconnected.
3. **Timeout retry** — after `CONTEXT_RETRY_DELAY` (210 ms), deliberately exceeding `DEPENDENCY_TIMEOUT` (200 ms) so a provider whose own effect activation waited on `customElements.whenDefined()` has had time to attach its listener. Skipped if already answered or the host disconnected. If still unanswered at this point and `DEV_MODE` is on, a `console.warn` names the context key and host element.

An `answered` flag guards all retries: once a provider answers, no further dispatches occur. Providers call `e.stopImmediatePropagation()` before answering, so at most one provider answers per dispatch.

The timers are fire-and-forget with no scope-bound cleanup — `requestContext` runs at factory time, outside any reactive scope, and returns a `Signal` (not a descriptor), so there is nowhere to register a cancel. The `host.isConnected` guard is the substitute: a consumer disconnected before a retry does not dispatch from a detached node.

## Alternatives Considered

- **`State<{ get: () => T }>` container + `createMemo(() => resolved.get().get())`**: a reactive container holding the getter, read inside a `Memo` computation so the container swap and the provider's live signal are both tracked. Functionally equivalent, but the double `.get().get()` read is awkward, the wrapper object `{ get: getter }` exists only to give the getter a stable identity inside the `State`, and it introduces a second primitive (`State`-of-an-object) for a job `Slot` already does natively. Rejected in favor of `Slot`, which is purpose-built for "a signal whose backing signal can be swapped" and is already the established primitive for overridable signals in the codebase.

- **Full `subscribe: true` + `ContextRoot` buffering (à la `@lit/context`)**: the Community Protocol supports a `subscribe` flag on `ContextRequestEvent` and an unsubscribe callback, allowing providers to push multiple updates and consumers to receive a buffered context tree. Rejected as heavier than the actual failure warrants: it requires provider-side subscriber bookkeeping (tracking each consumer's callback, calling it on every value change, and honoring unsubscribe), and the failure window Le Truc needs to close is entirely a consequence of its own lifecycle (`customElements.whenDefined()`-based dependency resolution and deferred descriptor activation), not of arbitrary provider timing. The two-retry scheme covers the real windows with no provider-side changes.

- **Re-dispatch on every `connectedCallback`**: rejected because `connectedCallback` re-activates cached descriptors on reconnect but does **not** re-run the factory (`#initialized` flag in `src/component.ts`), so `requestContext` is not naturally re-invoked on reconnect. Making it so would change `expose()` semantics and risk duplicate property initialization. Resolving once per component lifetime, at first connect, is pre-existing and correct.

- **A single longer timeout instead of microtask + timeout**: the microtask retry catches the common case (co-bundled providers defined synchronously after the consumer) with zero perceptible delay, so the consumer recovers within a frame rather than after 210 ms. The timeout is the backstop for the genuinely async case.

- **`subscribe: true` + provider-side subscriber bookkeeping for disconnect retraction**: once a provider answers, the consumer's `Slot` delegates to the provider's getter for the lifetime of the connection — if the provider element is later removed from the DOM, the consumer keeps the provider's last value rather than reverting to `fallback`. The spec-native fix would set `subscribe: true` on the request, have `provideContexts` track each answered consumer's callback, and on its scope cleanup (provider `disconnectedCallback`) call each consumer's unsubscribe to reset `slot.replace(fallbackState)`. Rejected. Context providers are meant to be **stable single sources of truth** for values a consumer component cannot know on its own — they update the *values* they provide as circumstances change (user logs out, theme preference changes, device orientation flips), not entities to be swapped wholesale against another provider or none. Removing or swapping a context provider at runtime is an anti-pattern; if a provided value is no longer relevant, the provider should update the value, not be removed. Meanwhile reparenting a consumer within a provider (e.g. drag-and-drop reordering) is a common, valid operation that briefly disconnects and reconnects the consumer — the current "retain the value" behavior avoids flickering the consumer through the fallback on every DOM move, which would be the worse outcome. Implementing subscriber bookkeeping in `provideContexts` and the unsubscribe contract in `requestContext` would add real complexity to both helpers to handle an edge case that is itself to be avoided.

## Consequences

**Good:**
- Consumers recover from late-defined providers with no consumer code change — the `Slot` swaps its delegate from the fallback `State` to the provider's getter `Memo` reactively.
- `Slot` unifies the overridable-signal story with `pass()`: both are "a property whose backing signal may be replaced after creation."
- The common case (co-bundled provider, synchronous define after consumer) recovers within a microtask — imperceptible.
- The immediate-answer case dispatches exactly once (the `answered` flag short-circuits both retries), so there is no gratuitous event traffic.
- Existing one-shot reactivity for value changes is preserved: the provider's getter is read inside the delegated `Memo` computation, tracking the provider's signal.
- No provider-side changes required.

**Bad:**
- The public return type widens from `Memo<T>` to `Signal<T>`. This is source-compatible for all existing usage inside `expose()` (a `Slot` satisfies `Signal<T>`, and consumers only read the value), but a consumer that narrowed on `Memo`-specific members would need adjusting. No such usage exists in the codebase.
- Two fire-and-forget timers per `requestContext` call that never answers immediately, with no scope-bound cancellation. The `host.isConnected` guard is the only cleanup; a consumer that connects, dispatches, and disconnects before the microtask fires still schedules a microtask callback (which exits immediately via the guard).
- After ~210 ms with no provider, the fallback is permanent for that connection — recovery is time-bounded, not indefinite.
- A `DEV_MODE`-only `console.warn` fires for the no-provider case, which is additional (suppressed in production) console output.
- **Provider disconnect does not revert the consumer to fallback.** Once a provider answers, the consumer's `Slot` retains the provider's last value for the lifetime of the connection — nothing resets the delegate back to the fallback `State`. This is deliberate: removing or swapping a context provider at runtime is an anti-pattern (providers are stable single sources of truth that update *values*, not entities to be replaced), and the retain-the-value behavior is desirable for reparenting (drag-and-drop within a provider) where a brief disconnect should not flicker the consumer through the fallback. A consumer whose provider is genuinely gone should have a `fallback` that accounts for the provider's absence.

## Related

- Requirements: [M10](../REQUIREMENTS.md#m10-context-protocol)
- Architecture: [Context Protocol](../ARCHITECTURE.md#context-protocol)
- Builds on: [ADR-0008](0008-community-protocol-for-context.md), [ADR-0007](0007-effect-descriptors-with-deferred-activation.md)
- Supersedes: None
