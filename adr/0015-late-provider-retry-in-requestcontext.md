# ADR 0015: Late-Provider Retry in requestContext

## Status

✅ Accepted

## Context

[ADR 0008](0008-community-protocol-for-context.md) established the Community Protocol for Context as Le Truc's context mechanism. Its consumer-side helper, `requestContext(context, fallback)`, originally dispatched a single `ContextRequestEvent` synchronously during the consumer's factory run and permanently locked in the result: if no ancestor provider answered at that instant, the consumer served the `fallback` forever.

A provider realistically misses that instant in non-buggy setups:

- The provider's `customElements.define()` runs **after** the consumer's — module ordering in one bundle, a code-split chunk, or a deferred script. The provider element sits above the consumer but isn't upgraded yet, so its `context-request` listener isn't attached.
- The provider is upgraded, but its `provideContexts` effect hasn't activated yet. Effects activate **after dependency resolution** ([ADR 0007](0007-effect-descriptors-with-deferred-activation.md)), which takes at least a microtask and possibly the full dependency-resolution timeout (`DEPENDENCY_TIMEOUT`). A provider that queries slow children attaches its listener *later* than a fast child consumer dispatches.

The failure was silent: the consumer rendered with the fallback and never recovered. This undermined [M10](../REQUIREMENTS.md#m10-context-protocol) and the progressive-enhancement story (components must degrade gracefully, then *recover*).

## Decision

Back the value `requestContext` returns with a `Slot` — the same primitive `pass()` uses for overridable backing signals — and re-dispatch the request up to two more times.

The returned `Signal<T>` initially delegates to the `fallback`. When a provider answers, the Slot's delegate is replaced by a signal derived from the provider's getter, so reading the consumer's value tracks both the late swap and the provider's live value updates. `pass()` and `requestContext` are then both cases of one story: a property whose backing signal may be replaced after creation.

The dispatch sequence:

1. **Synchronous** — during the factory run, as before.
2. **Microtask retry** — catches providers defined later in the same bundle.
3. **Timeout retry** — after `CONTEXT_RETRY_DELAY`, which must strictly exceed `DEPENDENCY_TIMEOUT` so a provider whose own activation waited on `customElements.whenDefined()` has attached its listener. If still unanswered, a `DEV_MODE`-only warning names the context key and host element.

Once a provider answers, no further dispatches occur, and at most one provider answers per dispatch (providers stop immediate propagation). A retry is skipped if the host has disconnected. The retries are fire-and-forget: `requestContext` runs at factory time outside any reactive scope and returns a signal, not an effect, so there is nowhere to register a cancel; the connected-host check is the substitute.

Resolution happens once per component lifetime, at first connect. After the final retry the fallback is permanent for that connection.

Once a provider answers, the consumer keeps the provider's value for the lifetime of the connection: removing the provider does **not** revert the consumer to `fallback`. Providers are stable single sources of truth — they update the *values* they provide (user logs out, theme changes), they are not entities to be removed or swapped at runtime. Consumers should give a `fallback` that makes sense for a genuinely absent provider.

The mechanics live in `src/helpers/context.ts` (`makeRequestContext`); the timing constants in `src/internal.ts`.

## Alternatives Considered

- **A reactive container holding the getter, read inside a derived signal**: functionally equivalent, but needs an awkward double read, a wrapper object that exists only to give the getter a stable identity, and a second primitive for a job `Slot` already does natively as the established overridable-signal primitive.

- **Full `subscribe: true` + `ContextRoot` buffering (à la `@lit/context`)**: heavier than the failure warrants. It requires provider-side subscriber bookkeeping (tracking each consumer's callback, calling it on every change, honoring unsubscribe), while the window Le Truc must close comes entirely from its own lifecycle — `whenDefined()`-based dependency resolution and deferred effect activation — not arbitrary provider timing. Two retries cover the real windows with no provider-side changes.

- **Re-dispatch on every `connectedCallback`**: reconnect re-activates cached effects but does not re-run the factory, so `requestContext` is not naturally re-invoked; making it so would change `expose()` semantics and risk duplicate property initialization. Resolving once per lifetime is pre-existing and correct.

- **A single longer timeout instead of microtask + timeout**: the microtask retry recovers the common case (a co-bundled provider defined just after the consumer) within a frame instead of after the timeout. The timeout is the backstop for the genuinely async case.

- **`subscribe: true` + unsubscribe on provider disconnect, reverting consumers to fallback**: removing or swapping a provider at runtime is an anti-pattern — a provider whose value no longer applies should update the value, not disappear. Reparenting a consumer within a provider (e.g. drag-and-drop) is common and valid and briefly disconnects the consumer; retaining the value avoids flickering it through the fallback on every DOM move, the worse outcome. Subscriber bookkeeping in `provideContexts` and an unsubscribe contract in `requestContext` would add real complexity to both helpers for an edge case that is itself to be avoided.

## Consequences

**Good:**
- Consumers recover from late-defined providers with no consumer code change.
- `Slot` unifies the overridable-signal story with `pass()`.
- The common case (co-bundled provider) recovers within a microtask — imperceptible.
- The immediate-answer case dispatches exactly once, so there is no gratuitous event traffic.
- The provider's live value updates keep flowing to the consumer after it answers.
- No provider-side changes required.

**Bad / accepted tradeoffs:**
- The public return type widens from `Memo<T>` to `Signal<T>`. Source-compatible for usage inside `expose()`, but a consumer narrowing on `Memo`-specific members would need adjusting.
- Up to two fire-and-forget retries per `requestContext` call that is not answered immediately, with no scoped cancellation; a consumer disconnected before a retry still schedules it, and it exits immediately.
- Recovery is time-bounded, not indefinite: after the final retry with no provider, the fallback is permanent for that connection.
- A `DEV_MODE`-only warning fires for the no-provider case (suppressed in production).
- Provider disconnect does not revert the consumer to fallback. Deliberate: it follows from providers being stable single sources of truth and prevents flicker during reparenting; a consumer whose provider is genuinely gone relies on a `fallback` that accounts for its absence.

## Related

- Requirements: [M10](../REQUIREMENTS.md#m10-context-protocol)
- Architecture: [Context Protocol](../ARCHITECTURE.md#context-protocol)
- Builds on: [ADR 0008](0008-community-protocol-for-context.md), [ADR 0007](0007-effect-descriptors-with-deferred-activation.md)
- Supersedes: None
