# ADR 0002: Factory Form Over Builder Pattern

## Status

✅ Accepted

## Context

Need a component definition API that gives direct element access, eliminates the UI object indirection layer, and makes attributes drive state only at connect time. The factory form provides a closure that receives a `FactoryContext` with direct access to element queries and reactive helpers.

## Decision

Use single factory form `(name, factory)` for `defineComponent` instead of 4-param form or builder pattern.

## Alternatives Considered

- **4-param form** — More explicit but verbose; requires UI object indirection
- **Builder pattern** — More flexible but adds complexity and indirection

## Consequences

**Good:**
- Factory closure gives direct element access
- Simpler mental model (no UI object indirection layer)
- Attributes as initial config only (not reactive), clarifying the data flow

**Bad:**
- Less explicit than 4-param form for simple cases
- Builder pattern might be more familiar to some developers

## Related

- Requirements: [M1](REQUIREMENTS.md#m1-component-definition-via-a-single-function)
- Architecture: [The Factory Form — Specification](ARCHITECTURE.md#the-factory-form--specification)
- Supersedes: None
