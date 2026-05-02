# ADR 0004: Slot-Based Signal Swapping for Inter-Component Binding

## Status

✅ Accepted

## Context

Need a way for parent components to inject their own reactive signal directly into a child component's property slot, creating a live reactive binding where the child has no knowledge of the parent. Direct property assignment or Proxy-based approaches don't provide the indirection needed for signal swapping without redefining property descriptors.

## Decision

Use `createSlot` from `@zeix/cause-effect` wrapping mutable signals to enable `pass()` zero-overhead binding. The Slot's `get`/`set` are used as the property descriptor on the component instance, which is what makes `host.count` reactive. `pass()` calls `slot.replace(newSignal)` to inject a parent signal into a child component without redefining the property descriptor.

## Alternatives Considered

- **Direct property assignment** — Cannot swap signals without redefining property descriptor; no indirection layer
- **Proxy-based signal swapping** — Adds overhead; more complex to implement and reason about

## Consequences

**Good:**
- Enables `pass()` zero-overhead binding (eliminates intermediate `createEffect` and property-assignment overhead)
- Consistent signal identity across component lifecycle
- Parent and child share exact same underlying signal node
- Cleanup restores original signal when parent disconnects

**Bad:**
- Adds indirection layer (Slot) between property and signal
- Scope is Le Truc components only; for non-Le Truc custom elements, must use `setProperty()` instead

## Related

- Requirements: [M11](REQUIREMENTS.md#m11-signal-injection-between-components-via-pass)
- Architecture: [#setAccessor — signal creation](ARCHITECTURE.md#setaccessor--signal-creation), [`pass()` — inter-component binding](ARCHITECTURE.md#pass--inter-component-binding)
- Supersedes: None
