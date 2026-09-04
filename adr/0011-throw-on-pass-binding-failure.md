# ADR 0011: Throw on `pass()` Binding Failure Instead of Warning

## Status

🗑️ Superseded by [ADR 0028](0028-tiered-error-surfacing.md)

## Context

`pass(target, props)` swaps Slot-backed signals between a parent and a target component (see [ADR 0004](0004-slot-based-signal-swapping-for-inter-component-binding.md)). `swapSlots` already threw `InvalidCustomElementError` / `InvalidReactivesError` for two structural preconditions: the target isn't a custom element, or `props` isn't a record. Three more failure modes existed only as silent or `DEV_MODE`-gated warnings:

1. A prop name in `PassedProps` doesn't exist on the target at all.
2. `toSignal()` can't resolve the passed value to a signal.
3. The target prop exists but isn't Slot-backed.

(3) is the common case in practice. It happens whenever the target is a non-Le-Truc custom element (Lit, FAST, vanilla Web Components) or a read-only/computed Le Truc property. `isCustomElement()` only checks that the tag name contains a hyphen, so a `<my-lit-widget>` passes that check; `getSignals()` (`src/internal.ts`) then lazily creates an *empty* signals record for any element Le Truc's own `connectedCallback` never touched, so the target always lands in "not Slot-backed." Read-only/computed properties are never Slot-wrapped in the first place (ADR 0004). Audit finding A14 flagged this as easy to misuse silently — and an Architect review that initially decided to keep the warning was overturned on reconsideration (see Alternatives).

## Decision

Every entry in a `PassedProps` map is a declared intent to bind a live signal — there is no valid reason to list a prop that can never be bound. `swapSlots` now validates every entry before mutating any state (eager two-phase validate-then-commit, the same shape as the `all()` selector validation in [ADR 0006](0006-lazy-mutationobserver-for-all-collections.md)) and throws a single `InvalidPassPropertyError` naming every prop that can't be bound and why, if any entry fails. No partial swap occurs on failure — either every prop in the call binds, or none do.

`pass()`'s deferred-activation timing ([ADR 0007](0007-effect-descriptors-with-deferred-activation.md)) means this throw cannot be caught by the calling factory's own code: `pass()` returns a thunk immediately, and the throw only happens later when Le Truc's own `connectedCallback` machinery activates it, after the factory has already returned. It surfaces the same way `InvalidPropertyNameError` does elsewhere in the codebase — as an uncaught `connectedCallback` exception, visible via the `pageerror` event, not a recoverable exception. This is intentional: a `pass()` binding failure means an assumption about component composition is wrong and must be fixed before production, not a recoverable runtime condition.

For `Memo<Element[]>` targets, the same per-target throw applies with no special per-element isolation: matched elements are homogeneous (same custom element type; only the count varies as items enter/leave the live collection), so if one element's binding fails, the others fail identically.

## Alternatives Considered

- **Keep the `DEV_MODE` warning, no throw** (the original A14 mitigation): Rejected on reconsideration. There is no legitimate case where listing a prop that can never be bound is intentional; warn-only made the failure too easy to miss in practice.
- **Add a programmatic `onError` recovery hook on `pass()`**: Rejected. Deferred activation means the throw happens inside Le Truc's own `connectedCallback` machinery, after the calling factory has already returned — there is no runtime context the parent could meaningfully recover into. The failure is a development-time signal, not a recoverable condition.
- **Per-element isolation for `Memo` targets** (validate/throw independently per element, aggregate failures across the collection): Rejected as unnecessary complexity. `all()`-matched targets passed to a single `pass()` call are homogeneous by construction (same selector implies same element type), so one element's binding failure reliably predicts the others'.

## Consequences

**Good:**
- Consistent failure model across all five `swapSlots` precondition checks (was 2 throw, 3 silent/warn)
- Closes a real interop gap: passing to a Lit/FAST/vanilla custom element, or to a read-only Le Truc prop, now fails loudly and immediately instead of silently doing nothing
- Atomic per target: a multi-prop `pass()` call either fully binds or doesn't bind at all, never partial state

**Bad:**
- Breaking change for any existing consumer whose code relied on (or merely tolerated) the previous silent failure
- One more public error class to document (`InvalidPassPropertyError`)

## Related

- Requirements: [M11](../REQUIREMENTS.md#m11-signal-injection-between-components-via-pass), [S2](../REQUIREMENTS.md#s2-required-element-error-messages-are-actionable)
- Architecture: [Inter-Component Signal Sharing (Pass)](../ARCHITECTURE.md#inter-component-signal-sharing-pass)
- Related ADRs: [ADR 0004](0004-slot-based-signal-swapping-for-inter-component-binding.md) (Slot-based signal swapping), [ADR 0007](0007-effect-descriptors-with-deferred-activation.md) (deferred activation — explains why this can't be caught by the caller)
- Supersedes: None
- Superseded by: [ADR 0028](0028-tiered-error-surfacing.md)
