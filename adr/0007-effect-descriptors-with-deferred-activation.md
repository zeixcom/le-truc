# ADR 0007: Effect Descriptors with Deferred Activation

## Status

✅ Accepted

## Context

v1.0 timing guarantee must be preserved: effects must activate only after dependency resolution (child custom elements are defined). `pass()` needs the target component's signals to exist, which are created in the target's `connectedCallback`, which requires `customElements.define()` to have run. If effects activated immediately when called in the factory body, `pass()` would find an empty signal map and silently fail.

## Decision

`watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` return **effect descriptors** — thunks `() => MaybeCleanup` that are activated after dependency resolution, not immediately when called in the factory body.

The factory function returns a flat `FactoryResult` array of these effect descriptors. After dependency resolution, each descriptor is activated inside a `createScope()`.

## Alternatives Considered

- **Immediate activation** — Would break `pass()` and any effect depending on child components
- **`pass`-specific deferral** — Would require dual-behavior helpers, adding complexity

## Consequences

**Good:**
- Preserves v1.0 timing guarantee
- Effects activate only after child custom elements are defined
- From user's perspective, this is transparent — they call `watch(...)`, get back an opaque value, put it in the return array
- Engine handles activation timing automatically

**Bad:**
- More complex internal implementation (thunks + deferred activation)
- Slight delay in effect activation (waits for dependency resolution)

## Related

- Requirements: [M8](REQUIREMENTS.md#m8-dependency-resolution-for-nested-custom-elements)
- Architecture: [connectedCallback — initialization](ARCHITECTURE.md#connectedcallback--initialization), [The Effect System](ARCHITECTURE.md#the-effect-system)
- Supersedes: None
