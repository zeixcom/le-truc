# ADR 0020: Merge-Based Validity Composition and `relayValidity()`

## Status

✅ Accepted

## Context

[GitHub issue #98](https://github.com/zeixcom/le-truc/issues/98) asked for a built-in way to relay a wrapped native control's *full* `ValidityState` onto a form-associated host's `internals` — not just collapse it into `customError`, the shape [ADR 0016](0016-element-internals-for-form-association-and-states.md) provides via `host.setCustomValidity()`. The motivating case is an "enhanced native input" component (e.g. a spinbutton-shaped control wrapping `<input type="number">`) that needs `valueMissing`, `rangeOverflow`, `rangeUnderflow`, `stepMismatch`, `badInput`, etc. individually visible on `host.validity`, while a parent component layers its own, separate `customError` on top for a cross-field constraint. ADR 0016 §7 already names typed validity flags via `internals.setValidity(flags, message, anchor)` as the documented escape hatch for this; issue #98 is a request to stop hand-rolling the flag-copying loop that escape hatch requires.

While designing the helper, a pre-existing gap surfaced in ADR 0016 §5's `managedSetCustomValidity` (the `host.setCustomValidity()` implementation): it calls `internals.setValidity(message ? { customError: true } : {}, message || undefined, anchor)`. Per the platform's `ElementInternals.setValidity()` semantics, any `ValidityStateFlags` key not present in the call is treated as `false` — the call **fully replaces** the flags object, it does not merge. A component that also sets typed flags elsewhere (e.g. `form-spinbutton`'s `internals.setValidity({ rangeOverflow, rangeUnderflow }, msg)`, see `examples/form/spinbutton/form-spinbutton.ts`) would have those flags silently wiped by any subsequent `host.setCustomValidity()` call from outside code, and vice versa. No existing test exercises this composition (`src/tests/form.test.ts`); this is a real but previously undiscovered gap in ADR 0016's implementation, not a documented trade-off of it. It does not match native platform behavior either: a native `<input>.setCustomValidity()` only ever touches `customError` — the browser keeps computing `valueMissing`/`rangeOverflow`/etc. from the control's own state underneath, untouched.

This ADR amends ADR 0016 §5 (the `setCustomValidity` implementation) to fix that composition gap, and extends §7 with a second exported helper for the relay pattern issue #98 asked for. It does not reopen or change ADR 0016 §1–4, §6, or §8.

Relevant requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function) (component definition), §4 Accessibility ("must not make it harder to achieve") — same requirements ADR 0016 traces to, since this amends that decision's implementation.

## Decision

Two changes to `src/extensions/form.ts`, both additive to ADR 0016's managed form-control convention — no change to the public host contract's shape or the `formAssociated()`/`formAssociatedCheckbox()` extension surface. The two changes use opposite composition strategies — one merges, one replaces — because they sit on opposite sides of the same boundary: `setCustomValidity()` is an *external overlay*, called by code that doesn't know what constraints the component already asserted on the same `internals`, so it must preserve them. `relayValidity()` relays a control's *own, complete, authoritative* state, so anything it doesn't currently assert genuinely isn't true anymore.

### 1. `mergeValidity()` — internal primitive, merge instead of replace

```ts
const FALLBACK_VALIDITY_MESSAGE = 'Invalid value'

const mergeValidity = (
  internals: ElementInternals,
  flags: Partial<ValidityStateFlags>,
  ownMessage: string | undefined,
  anchor: HTMLElement,
): void => {
  const merged = { ...snapshotFlags(internals.validity), ...flags }
  const anyTrue = Object.values(merged).some(Boolean)
  // setValidity throws if any flag is true and message is omitted, and
  // ElementInternals has no per-flag message storage. Three fallback tiers:
  // this call's own message → whatever message is already current (a
  // previous flag this call didn't touch) → a generic placeholder, for the
  // case neither exists.
  const message =
    ownMessage ||
    (anyTrue ? internals.validationMessage || FALLBACK_VALIDITY_MESSAGE : undefined)
  internals.setValidity(merged, message || undefined, anchor)
}
```

`managedSetCustomValidity` (ADR 0016 §5) is rewritten to call `mergeValidity(internals, { customError: !!message }, message, resolveAnchor(host))` instead of a raw, replacing `internals.setValidity(...)` call. `host.setCustomValidity()` now preserves any native/typed flags already set elsewhere on the same `internals` — matching native `<input>.setCustomValidity()` semantics instead of silently clearing unrelated constraint state.

`mergeValidity()`'s merge-preserve semantics apply to exactly this one call site. `setCustomValidity()` doesn't know what constraints the component has already asserted on the same `internals` (via `relayValidity()` or typed flags), so it must not wipe them.

### 2. `relayValidity()` — new exported helper

```ts
relayValidity(internals: ElementInternals | null, control: ValidatableControl, anchor: HTMLElement = control): void
```

Relays a wrapped native control's `ValidityState` — **every** `ValidityStateFlags` key, including the control's own `customError` — onto `internals`, plus its `validationMessage`, via a direct `internals.setValidity(flags, message, anchor)` call: a full replace, not a merge through `mergeValidity()`. Anchored to `control` itself by default (overridable), unlike the host-contract's descendant-search anchor heuristic — the caller already holds the exact control.

The control's own `customError` is included, not excluded, because `relayValidity()` relays a wrapped control's *complete, authoritative* `ValidityState` on every call — there is no reason a stale `customError` a parent set on a previous cross-field check should outlive the child's own next validation pass. A parent's cross-field check necessarily runs *after* the child has updated its own state in the same reactive cycle (it has to read the child's current value/validity to decide), so if the constraint still holds, the parent re-asserts its `customError` on its own next run regardless of what `relayValidity()` did in between. A merge-and-exclude design here would only be solving a composition conflict that never actually arises on the real call sequence, at the cost of a real workaround: an earlier draft of `form-spinbutton.ts` had to call `host.setCustomValidity('')` immediately after every `relayValidity()` call to clear the stale flag a merge would otherwise have preserved.

- A plain function taking `internals` directly: not gated behind `formAssociated()`, usable by any component with `internals` from `FactoryContext`. Tree-shakes away for consumers who don't import it.
- Not reactive. Callers re-invoke it from `on(control, 'input'/'change', …)`, the same way `form-spinbutton` re-runs its own typed-flags `watch(...)`. This is consistent with ADR 0016's "no reactive abstraction layer" stance — `relayValidity()` is a helper for the escape hatch, not a new lifecycle mechanism.

Net effect: **`relayValidity()` = full replace** (the control's live state is the whole truth about itself); **`setCustomValidity()` = merge/preserve** (an external overlay that must not stomp on state it doesn't own).

### Disclosed limitation: one message, not per-flag

`ElementInternals` stores exactly one `validationMessage` per component per `setValidity()` call — unlike a native control, where the browser recomputes `validationMessage` from a fixed priority order across all currently-true flags on every read. This limitation applies within a call to `setCustomValidity()`, where `mergeValidity()`'s fallback (reuse the current message when the incoming call doesn't supply one) avoids losing a message entirely without solving message prioritization in general. It doesn't arise on `relayValidity()`'s side, since a full replace has no prior state to merge a message with or lose.

**Found during implementation:** `relayValidity()`'s own two-tier fallback (`control.validationMessage` → `FALLBACK_VALIDITY_MESSAGE`) is necessary because a native control barred from constraint validation — `disabled`, or `readonly` on `type="number"`/`text`/etc. — always reports `''` for its own `validationMessage`, even though its `.validity` flags are still computed live and can genuinely be `true`. `relayValidity()` relaying such a control hits this on the *first* flag transition on a fresh `internals`, where no prior message exists to fall back to. This is a real, not hypothetical, shape: "display value, buttons drive it" input components (`form-spinbutton` itself, before its own fix) commonly keep the wrapped native input `disabled`/`readonly`. `FALLBACK_VALIDITY_MESSAGE` (`'Invalid value'`) exists for exactly this case — a generic, hardcoded string, deliberately not per-flag.

## Alternatives Considered

- **Leave `managedSetCustomValidity` replacing, document the gap as a known limitation.** Rejected. The interaction is exactly the shape `relayValidity()` invites (relay native flags on one call path, set `customError` from another) — shipping the new helper without fixing the composition bug it immediately runs into would hand every adopter a foot-gun.
- **Per-flag message registry (store a message per `ValidityStateFlags` key, recompute `validationMessage` by native priority order on every `setValidity` call).** Rejected as out of scope. It would fully solve the message-prioritization gap but requires tracking state ADR 0016 never introduced, adds real complexity to a helper meant to remove boilerplate, and no concrete use case in the current examples or issue #98 needs it — the single-message fallback avoids the actual reported failure (a message silently dropping to empty).
- **Gate `relayValidity()` behind `formAssociated()`/`formAssociatedCheckbox()` (e.g. as an extension method or a `FactoryContext` helper).** Rejected for the same reason ADR 0016 rejected `bindFormValue`/`bindValidity`-style wrappers (§ Alternatives Considered there): it would rename a low-level pattern instead of just removing its boilerplate, and would force every `formAssociated()` consumer to bundle it whether or not their component wraps a native control. A plain function taking `internals` directly keeps it tree-shakeable and usable outside the managed convention.
- **Have `relayValidity()` merge via `mergeValidity()`, excluding `control`'s own `customError`.** Rejected — see the reasoning under "`relayValidity()`" above. It solves a composition conflict that never actually arises on the real call sequence, while forcing every "enhanced native input" component to hand-roll a `host.setCustomValidity('')` workaround to clear the stale flag the merge would otherwise preserve.

## Consequences

**Good:**

- Fixes a real, previously-undiscovered bug: `host.setCustomValidity()` no longer clobbers typed native flags set elsewhere on the same `internals` (or vice versa).
- `relayValidity()` removes the repeated `VALIDITY_KEYS` copy-loop every "enhanced native input" component would otherwise hand-roll (per issue #98's own example).
- `relayValidity()` is a plain, obviously-correct full replace — no merge semantics to reason about, no workaround needed at call sites.
- No change to the public host contract, the `formAssociated()`/`formAssociatedCheckbox()` extension surface, or bundle cost for consumers who don't import `relayValidity`.

**Bad / trade-offs:**

- Message display across simultaneously-true flags on the `setCustomValidity()` overlay path is not perfectly native — see "Disclosed limitation" above. Accepted as a smaller, real gap rather than building the general solution speculatively.
- `mergeValidity`'s "reuse current message when this call has none" fallback means a caller cannot cleanly clear the *message* while leaving flags from another source true — but this matches the pre-existing constraint that any true flag requires a message at all (native `ElementInternals.setValidity()` throws otherwise), not a new one introduced here.
- `FALLBACK_VALIDITY_MESSAGE` can surface a generic `'Invalid value'` to end users instead of a real description, specifically when relaying a `disabled`/`readonly` control's first true flag on a fresh `internals`. Accepted: the alternative is throwing, and the common case (a live, non-barred control, or a second-and-later flag transition) still gets a real message.
- A parent's `customError` is visibly cleared, then re-asserted, on every `relayValidity()` call from the child — a brief flicker is possible if anything reads `validity`/`validationMessage` between the two writes within the same synchronous cycle. Accepted: `watch()` effects in this library run synchronously, so in practice the parent's re-assertion happens before any observer sees the intermediate state, for any composition following the documented "own state first, then cross-field check" ordering.

**Compatibility:**

- Non-breaking. `managedSetCustomValidity`'s merge fix changes only previously-undefined/broken composition behavior — no test or documented contract relied on the replacing behavior. `relayValidity()` is a new, optional export. Targets the next minor release.

## Related

- Requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), §4 (Accessibility)
- Amends: [ADR 0016](0016-element-internals-for-form-association-and-states.md) §5 (`setCustomValidity` implementation) and §7 (escape hatch); §1–4, §6, §8 unchanged
- Related: [ADR-0019](0019-extension-based-dependency-injection-for-definecomponent.md) — `formAssociated()`/`formAssociatedCheckbox()` extension mechanism `relayValidity()` deliberately sits outside of
- Supersedes: None
