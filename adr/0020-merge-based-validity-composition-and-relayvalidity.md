# ADR 0020: Merge-Based Validity Composition and `relayValidity()`

## Status

✅ Accepted

## Context

[GitHub issue #98](https://github.com/zeixcom/le-truc/issues/98) asked for a built-in way to relay a wrapped native control's *full* `ValidityState` onto a form-associated host's `internals`, instead of collapsing it into `customError` via `host.setCustomValidity()` as [ADR 0016](0016-element-internals-for-form-association-and-states.md) provides. The motivating case is an "enhanced native input" (e.g. a spinbutton wrapping `<input type="number">`) that needs `valueMissing`, `rangeOverflow`, `stepMismatch`, `badInput` and the rest individually visible on `host.validity`, while a parent layers its own `customError` on top for a cross-field constraint. ADR 0016 §7 already names `internals.setValidity(flags, message, anchor)` as the escape hatch; the issue asks to stop hand-rolling the flag-copying loop it requires.

Designing the helper exposed a gap in ADR 0016 §5's managed `host.setCustomValidity()`. `ElementInternals.setValidity()` treats every flag absent from the call as `false`: it **replaces** the flags, it does not merge. The managed implementation passed only `customError`, so any `host.setCustomValidity()` call from outside code silently wiped typed flags the component had set elsewhere on the same `internals`, and vice versa. This was an undiscovered defect, not a documented tradeoff, and it diverges from the platform: a native `<input>.setCustomValidity()` touches only `customError`, and the browser keeps computing the other flags underneath.

This ADR amends ADR 0016 §5 to fix the composition gap and extends §7 with a helper for the relay pattern. ADR 0016 §1–4, §6 and §8 are unchanged.

Relevant requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function) and §4 Accessibility ("must not make it harder to achieve"), the same ones ADR 0016 traces to.

## Decision

Two additive changes to the managed form-control convention in `src/extensions/form.ts`. Neither changes the shape of the public host contract or the `formAssociated()`/`formAssociatedCheckbox()` extension surface.

The two use opposite composition strategies because they sit on opposite sides of one boundary. `setCustomValidity()` is an *external overlay*, called by code that does not know what constraints the component already asserted, so it must preserve them. `relayValidity()` relays a control's *own, complete, authoritative* state, so anything it does not currently assert is no longer true.

### 1. `host.setCustomValidity()` merges instead of replacing

The managed `host.setCustomValidity(message)` sets only `customError` and keeps every other flag already present on `internals`, matching native `<input>.setCustomValidity()`. This merge applies to this one call site only.

Because `setValidity()` throws when a flag is true and no message is given, and `ElementInternals` has no per-flag message storage, the message falls back in three tiers: the call's own message, then the message already current (from a flag this call did not touch), then a generic placeholder (`'Invalid value'`) when neither exists.

### 2. `relayValidity(internals, control, anchor = control)` — new exported helper

Relays **every** `ValidityStateFlags` key of a wrapped native control, including the control's own `customError`, onto `internals`, together with its `validationMessage`, as a full replace rather than a merge. It anchors to `control` by default (overridable), since the caller already holds the exact control; the host contract's descendant-search anchor heuristic does not apply.

The control's `customError` is included because each call relays its complete state, so a stale `customError` from a parent's earlier cross-field check should not outlive the child's next validation pass. A parent's cross-field check necessarily runs *after* the child updates its own state in the same reactive cycle (it reads the child's current value to decide), so if the constraint still holds the parent re-asserts its `customError` on its own next run.

- A plain function taking `internals` directly: not gated behind a form extension, usable by any component with `internals`, and tree-shaken away when not imported.
- Not reactive. Callers re-invoke it from `on(control, 'input'/'change', …)`. This keeps ADR 0016's "no reactive abstraction layer" stance: a helper for the escape hatch, not a new lifecycle mechanism.
- When the control reports an empty `validationMessage` despite a true flag, it falls back to the same generic placeholder. A native control barred from constraint validation (`disabled`, or `readonly` on text-like types) always reports `''` while its flags are still computed live, and "display value, buttons drive it" components commonly keep the wrapped input in that state.

### Limitation: one message, not per-flag

`ElementInternals` stores one `validationMessage` per `setValidity()` call, whereas a native control recomputes it from a fixed priority order across all true flags on every read. On the `setCustomValidity()` path the reuse-current-message fallback avoids losing a message entirely but does not solve message prioritization. The `relayValidity()` path has no prior state to merge with, so it does not arise there.

## Alternatives Considered

- **Keep `setCustomValidity()` replacing and document the gap**: `relayValidity()` invites exactly this composition (native flags on one path, `customError` from another), so shipping it without the fix would hand every adopter a foot-gun.
- **Per-flag message registry, recomputing `validationMessage` by native priority order**: out of scope. It fully solves prioritization but requires state ADR 0016 never introduced and adds real complexity to a helper meant to remove boilerplate; no concrete case needs it, and the single-message fallback avoids the reported failure (a message silently dropping to empty).
- **Gate `relayValidity()` behind the form extensions** (as an extension method or `FactoryContext` helper): rejected for the reason ADR 0016 rejected `bindFormValue`/`bindValidity`-style wrappers. It would rename a low-level pattern instead of removing its boilerplate, and force every form-extension consumer to bundle it.
- **Have `relayValidity()` merge, excluding the control's own `customError`**: solves a composition conflict that never arises on the real call sequence, and forces every enhanced-input component to call `host.setCustomValidity('')` after each relay to clear the stale flag the merge would preserve.

## Consequences

**Good:**

- `host.setCustomValidity()` no longer clobbers typed flags set elsewhere on the same `internals`, or vice versa.
- `relayValidity()` removes the flag-copy loop every enhanced-input component would otherwise hand-roll.
- `relayValidity()` is a plain full replace: no merge semantics to reason about, no workaround at call sites.
- No change to the public host contract, the form-extension surface, or bundle cost for consumers who do not import `relayValidity`.

**Bad / accepted tradeoffs:**

- Message display across simultaneously true flags on the `setCustomValidity()` path is not fully native (see Limitation). Accepted rather than building the general solution speculatively.
- The reuse-current-message fallback means a caller cannot clear the *message* while flags from another source stay true. This matches the platform rule that any true flag requires a message; it is not a new constraint.
- The generic `'Invalid value'` placeholder can reach end users, chiefly when relaying a `disabled`/`readonly` control's first true flag on fresh `internals`. Accepted: the alternative is throwing, and live controls and later transitions still get a real message.
- A parent's `customError` is cleared and then re-asserted on every relay from the child, so anything reading `validity` between the two writes sees the intermediate state. Accepted: `watch()` effects run synchronously, so with the documented "own state first, then cross-field check" ordering the re-assertion lands before any observer reads.
- Non-breaking: the merge changes only behavior that was previously broken and that no contract relied on; `relayValidity()` is a new, optional export.

## Related

- Requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), §4 (Accessibility)
- Amends: [ADR 0016](0016-element-internals-for-form-association-and-states.md) §5 (`setCustomValidity` implementation) and §7 (escape hatch); §1–4, §6, §8 unchanged
- Related: [ADR 0019](0019-extension-based-dependency-injection-for-definecomponent.md) — the form-extension mechanism `relayValidity()` deliberately sits outside of
- Supersedes: None
