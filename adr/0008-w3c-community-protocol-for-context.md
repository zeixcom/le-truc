# ADR 0008: W3C Community Protocol for Context

## Status

✅ Accepted

## Context

Need ancestor-to-descendant reactive value sharing without prop drilling or direct component coupling. A standard protocol ensures interoperability with other Web Components libraries and provides a clear, documented pattern for context sharing.

## Decision

Implement the [W3C Community Protocol for Context](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md) for dependency injection between components.

### Provider side

`provideContexts([...])` is a `FactoryContext` helper that returns an `EffectDescriptor`. It installs a `context-request` event listener via `createScope`. When a matching request arrives, it stops propagation and provides a getter `() => host[context]` to the callback. The listener is removed on `disconnectedCallback` via the effect cleanup.

### Consumer side

`requestContext(context, fallback)` is a `FactoryContext` helper that returns a `Memo<T>`. It dispatches a `ContextRequestEvent` that bubbles up the DOM during `connectedCallback`. If an ancestor provider intercepts it, the consumer receives a getter and wraps it in a `createMemo()`, creating a live reactive binding. If no provider responds, it falls back to the provided default value.

## Alternatives Considered

- **Custom context protocol** — Would not interoperate with other Web Components libraries
- **Prop drilling** — Verbose; requires explicit passing through all intermediate components
- **Direct component coupling** — Tight coupling; breaks component reusability
- **Global state** — Not scoped to component hierarchy; harder to reason about

## Consequences

**Good:**
- Standard-based approach (W3C Community Protocol)
- No prop drilling for shared state
- No direct component coupling
- Works with any Web Components library implementing the protocol
- Reactive: context changes propagate automatically

**Bad:**
- Requires browser support for `ContextRequestEvent` (evergreen browsers only)
- Slight overhead for event dispatch and listener setup

## Related

- Requirements: [M10](REQUIREMENTS.md#m10-context-protocol)
- Architecture: [The Context Protocol](ARCHITECTURE.md#the-context-protocol)
- Supersedes: None
