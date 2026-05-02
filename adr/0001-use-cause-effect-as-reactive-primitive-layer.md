# ADR 0001: Use Cause & Effect as Reactive Primitive Layer

## Status

✅ Accepted

## Context

Le Truc needs a reactive primitive layer that provides specific signal types not available in other libraries: `Slot` (swappable backing signal), lazy `Memo` with `watched` callback, `Sensor` (event-stream-derived signal), `Task` (async), and `Scope` (owned effect lifecycle). The prior claim that the reactive engine could be swapped is no longer accurate.

## Decision

Use `@zeix/cause-effect` as the sole reactive primitive layer. The dependency is tight and intentional.

## Alternatives Considered

- **SolidJS signals** — Lacks Slot, Sensor, Task types; different lifecycle model
- **Vue reactivity** — Not designed for fine-grained reactivity; different API surface
- **Custom implementation** — Would duplicate effort and maintenance burden

## Consequences

**Good:**
- Provides exact primitives needed (Slot, Memo, Sensor, Task, Scope)
- Co-developed at Zeix AG, ensuring alignment
- Released 1.0 together with Le Truc

**Bad:**
- Tight coupling to `@zeix/cause-effect` (intentional, not a bug)
- Cannot easily swap reactive engines

## Related

- Requirements: [M1](REQUIREMENTS.md#m1-component-definition-via-a-single-function), [M2](REQUIREMENTS.md#m2-reactive-properties-backed-by-signals)
- Architecture: [The Component Lifecycle](ARCHITECTURE.md#the-component-lifecycle), [The Effect System](ARCHITECTURE.md#the-effect-system)
- Supersedes: None
