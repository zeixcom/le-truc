# ADR 0012: Deprecate Unrestricted-Write Short Forms in pass()

## Status

✅ Accepted

Implemented in 2.2.0: the DEV_MODE deprecation warning ships in `src/helpers/reactive.ts` (`swapSlots`), JSDoc on `pass()` and `PassedProps` documents the deprecation, all examples are migrated to thunk/descriptor forms, and the CHANGELOG 2.2.0 Deprecated entry records it (merged as PR #57). Removal of the short forms is scheduled for the next major.

## Context

`pass(target, props)` swaps a child component's Slot-backed signal for one supplied by the parent (see [ADR-0004](0004-slot-based-signal-swapping-for-inter-component-binding.md)). Today each entry in `props` accepts four input forms: a **property key** (`'value'`) and a **bare writable signal** (`someState`) both resolve to the parent's writable signal and grant the child unrestricted `.set()` access; the **thunk** (`() => host.value`) and **descriptor** (`{ get, set }`) forms keep the parent in control of writes. The first two are the "short forms."

The Slot machinery (ADR-0004) and eager validation (ADR-0011) make the short forms *safe* — only Le Truc components participate, every swap is validated before commit. The problem is not safety but **ownership**: a child that receives a short-form binding can drive a state transition in its owner by calling `.set()` directly on the shared signal, with no interception. The owner cannot validate, clamp, veto, log, or persist the transition because it never passes through the owner's code. The descriptor form already solves this — `child.value = x` stays the same interface; behind it the assignment becomes an update *request* to the parent.

This is grounded in four canonical design principles: the short form couples the child to the parent's current representation and removes the parent's ability to control its own transitions (Liskov, Parnas); it lets transitions originate from unbounded external `.set()` sites with no chokepoint (Dijkstra); and it makes the parent's invariants undefendable, since a bypass exists by construction (Hoare). The descriptor form is representation-independent, hides the parent's update policy, funnels all writes through one entry point, and makes invariants provable.

Relevant requirements: [M11](../REQUIREMENTS.md#m11-signal-injection-between-components-via-pass) (signal injection via `pass()`), [S3](../REQUIREMENTS.md#s3-development-mode-with-enhanced-diagnostics) (DEV_MODE diagnostics), §4 (type safety).

## Decision

**Deprecate** the property-key and bare-writable-signal short forms of `pass()` in the next minor release; **remove** them in the next major. **Keep** the thunk (`() => host.value`, read-only) and descriptor (`{ get, set }`, mediated writable) forms.

When `pass()` receives a writable signal for a prop — a property key resolving to a writable host signal, or a bare writable signal — emit a DEV_MODE warning, following the existing diagnostic pattern (`src/helpers/context.ts:165`, `src/helpers/dom.ts:366`, `src/helpers/events.ts:215`):

> `pass() received a writable signal for '<prop>'. Use () => host.<prop> for read-only access, or { get, set } to mediate writes.`

Read-only signals (`Memo`/`Task`) passed directly do not warn. Document the deprecation in JSDoc on `pass()` and `PassedProps`. The migration is behavior-preserving — `pass(child, { value: parentSignal })` becomes `pass(child, { value: { get: parentSignal.get, set: parentSignal.set } })` — so today users lose nothing; tomorrow they gain one point at which to validate, clamp, or veto.

## Alternatives Considered

- **Keep the short forms.** Rejected — the descriptor form is a behavioral superset with zero-cost migration, and the short forms are the one API surface where Le Truc fails to enforce owner control that its other ADRs assert everywhere.
- **Hard error immediately (next minor).** Rejected — would break working code over a coupling problem, not a correctness bug. Warning-first, removal in the next major is the standard deprecation discipline.
- **Deprecate the key form but keep the bare-signal form.** Rejected — both resolve (`toSignal`, `src/helpers/reactive.ts:152-171`) to the parent's writable signal with the same unrestricted `.set()`. Treating them differently would be arbitrary.
- **Auto-wrap any bare signal into a read-only view by default.** Rejected — it silently changes behavior (a child that previously wrote through the binding loses writes) and hides the ownership decision rather than surfacing it.

## Consequences

**Good:** restores single-owner control of transitions; the parent can again validate, clamp, veto, batch, log, or persist external writes through one setter. Representation independence and provable invariants are regained; the parent's update policy becomes a local decision. Coherence with the rest of the API — no surface remains where a parent's raw writable signal is the "convenient" path.

**Bad / trade-offs:** migration cost for consumers using the short form, mitigated by a behavior-preserving codemod and a release cycle between warning and removal. Minor ergonomic loss for genuine dumb-pass-through cases — but if the parent truly doesn't own the state, the child should own the signal and the parent should read it. Two releases of dual support until the major removal.

**Compatibility:** M11 is unchanged in spirit — `pass()` still injects a live reactive binding; only the accepted authoring notations narrow. §4 (type safety) is improved, since the deprecated forms are the ones most likely to mask a representation change as a silent runtime behavior shift.

## Related

- Requirements: [M11](../REQUIREMENTS.md#m11-signal-injection-between-components-via-pass), [S3](../REQUIREMENTS.md#s3-development-mode-with-enhanced-diagnostics), §4 (type safety)
- Architecture: [Inter-Component Signal Sharing (Pass)](../ARCHITECTURE.md#inter-component-signal-sharing-pass)
- Refines: [ADR-0004](0004-slot-based-signal-swapping-for-inter-component-binding.md) — narrows the accepted input forms of `pass()`; the Slot-swap mechanism itself is unchanged
- Related: [ADR-0011](0011-throw-on-pass-binding-failure.md) — same complete-or-fail discipline; this ADR narrows what is considered a *valid* binding
- Supersedes: None
