# ADR 0020: Merge-Based Validity Composition and `delegateValidity()`

## Status

✅ Accepted

## Context

[GitHub issue #98](https://github.com/zeixcom/le-truc/issues/98) asked for a built-in way to relay a wrapped native control's *full* `ValidityState` onto a form-associated host's `internals` — not just collapse it into `customError`, the shape [ADR 0016](0016-element-internals-for-form-association-and-states.md) provides via `host.setCustomValidity()`. The motivating case is an "enhanced native input" component (e.g. a spinbutton-shaped control wrapping `<input type="number">`) that needs `valueMissing`, `rangeOverflow`, `rangeUnderflow`, `stepMismatch`, `badInput`, etc. individually visible on `host.validity`, while a parent component layers its own, separate `customError` on top for a cross-field constraint. ADR 0016 §7 already names typed validity flags via `internals.setValidity(flags, message, anchor)` as the documented escape hatch for this; issue #98 is a request to stop hand-rolling the flag-copying loop that escape hatch requires.

While designing the helper, a pre-existing gap surfaced in ADR 0016 §5's `managedSetCustomValidity` (the `host.setCustomValidity()` implementation): it calls `internals.setValidity(message ? { customError: true } : {}, message || undefined, anchor)`. Per the platform's `ElementInternals.setValidity()` semantics, any `ValidityStateFlags` key not present in the call is treated as `false` — the call **fully replaces** the flags object, it does not merge. A component that also sets typed flags elsewhere (e.g. `form-spinbutton`'s `internals.setValidity({ rangeOverflow, rangeUnderflow }, msg)`, see `examples/form/spinbutton/form-spinbutton.ts`) would have those flags silently wiped by any subsequent `host.setCustomValidity()` call from outside code, and vice versa. No existing test exercises this composition (`src/tests/form.test.ts`); this is a real but previously undiscovered gap in ADR 0016's implementation, not a documented trade-off of it. It does not match native platform behavior either: a native `<input>.setCustomValidity()` only ever touches `customError` — the browser keeps computing `valueMissing`/`rangeOverflow`/etc. from the control's own state underneath, untouched.

This ADR amends ADR 0016 §5 (the `setCustomValidity` implementation) to fix that composition gap, and extends §7 with a second exported helper for the relay pattern issue #98 asked for. It does not reopen or change ADR 0016 §1–4, §6, or §8.

Relevant requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function) (component definition), §4 Accessibility ("must not make it harder to achieve") — same requirements ADR 0016 traces to, since this amends that decision's implementation.

## Decision

Two changes to `src/extensions/form.ts`, both additive to ADR 0016's managed form-control convention — no change to the public host contract's shape or the `formAssociated()`/`formAssociatedCheckbox()` extension surface.

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
  // case neither exists — notably a disabled/readonly control relayed via
  // delegateValidity() on the *first* flag transition on a fresh internals,
  // where a native control's validationMessage is always '' regardless of
  // its live .validity flags (found during implementation — see Disclosed
  // limitation below).
  const message =
    ownMessage ||
    (anyTrue ? internals.validationMessage || FALLBACK_VALIDITY_MESSAGE : undefined)
  internals.setValidity(merged, message || undefined, anchor)
}
```

`managedSetCustomValidity` (ADR 0016 §5) is rewritten to call `mergeValidity(internals, { customError: !!message }, message, resolveAnchor(host))` instead of a raw, replacing `internals.setValidity(...)` call. `host.setCustomValidity()` now preserves any native/typed flags already set elsewhere on the same `internals` — matching native `<input>.setCustomValidity()` semantics instead of silently clearing unrelated constraint state.

### 2. `delegateValidity()` — new exported helper

```ts
delegateValidity(internals: ElementInternals, control: ValidatableControl, anchor: HTMLElement = control): void
```

Relays a wrapped native control's `ValidityState` — the nine UA-computed `ValidityStateFlags` keys (`valueMissing`, `typeMismatch`, `patternMismatch`, `tooLong`, `tooShort`, `rangeUnderflow`, `rangeOverflow`, `stepMismatch`, `badInput`) — plus its `validationMessage`, through `mergeValidity()`. Anchored to `control` itself by default (overridable), unlike `resolveAnchor()`'s descendant-search heuristic — the caller already holds the exact control.

**Deliberately excludes `control`'s own `customError` flag from the copied set** — a correction made during implementation to an earlier draft of this decision, which specified copying "every `ValidityStateFlags` key, including `customError`." That version does not compose: a wrapped native control's own `customError` is almost always `false`, and `mergeValidity()` only *preserves* a flag already set on `internals` when the incoming call omits the key entirely — an explicit `false` is a real override, not a gap to fall through. Copying `customError` verbatim would therefore silently clear any `customError` set on the same `internals` through `host.setCustomValidity()` (e.g. a parent layering its own cross-field constraint, or server-validation code reacting to `host.setCustomValidity()` from outside the component) on the very next `delegateValidity()` call — precisely the composition this ADR exists to fix, and precisely issue #98's own axis-spinbutton/gamut-picker scenario, where the wrapping component's own constraint state and a parent's separate `customError` must coexist. `customError` remains exclusively owned by the `setCustomValidity()` → `mergeValidity()` path; `delegateValidity()` only ever relays flags the control itself computes.

- A plain function taking `internals` directly, mirroring `managedSetCustomValidity`'s shape: not gated behind `formAssociated()`, usable by any component with `internals` from `FactoryContext`. Tree-shakes away for consumers who don't import it.
- Not reactive. Callers re-invoke it from `on(control, 'input'/'change', …)`, the same way `form-spinbutton` re-runs its own typed-flags `watch(...)`. This is consistent with ADR 0016's "no reactive abstraction layer" stance — `delegateValidity()` is a helper for the escape hatch, not a new lifecycle mechanism.

### Disclosed limitation: one message, not per-flag

`ElementInternals` stores exactly one `validationMessage` per component per `setValidity()` call — unlike a native control, where the browser recomputes `validationMessage` from a fixed priority order across all currently-true flags on every read. When flags from different sources are simultaneously true on the same `internals` (e.g. a delegated native flag and a separately-set `customError`), the displayed message is whichever call supplied a non-empty one most recently — not always the "highest priority" one by native semantics. A per-flag message registry that would reproduce exact native prioritization was considered and rejected as materially larger than what issue #98 asked for; `mergeValidity`'s fallback (reuse the current message when the incoming call doesn't supply one) avoids losing the message entirely, which is the failure mode that actually surfaced, without solving message prioritization in general.

**Found during implementation:** the two-tier fallback above (`ownMessage` → current `internals.validationMessage`) is not sufficient on its own. A native control barred from constraint validation — `disabled`, or `readonly` on `type="number"`/`text`/etc. — always reports `''` for its own `validationMessage`, even though its `.validity` flags are still computed live and can genuinely be `true`. `delegateValidity()` relaying such a control hits this on the *first* flag transition on a fresh `internals`: `ownMessage` is `''` (the control's own message) and `internals.validationMessage` is also `''` (nothing set yet), so the two-tier fallback resolved to `undefined` — tripping the exact throw this function exists to avoid. This is a real, not hypothetical, shape: "display value, buttons drive it" input components (`form-spinbutton` itself, before its own fix) commonly keep the wrapped native input `disabled`/`readonly`. `mergeValidity` now has a third tier, {@link FALLBACK_VALIDITY_MESSAGE} (`'Invalid value'`), for exactly this case — a generic, hardcoded string, deliberately not per-flag (that would be the same per-flag message registry rejected two paragraphs up, applied to a narrower trigger).

## Alternatives Considered

- **Leave `managedSetCustomValidity` replacing, document the gap as a known limitation.** Rejected. The interaction is exactly the shape `delegateValidity()` invites (relay native flags on one call path, set `customError` from another) — shipping the new helper without fixing the composition bug it immediately runs into would hand every adopter a foot-gun.
- **Per-flag message registry (store a message per `ValidityStateFlags` key, recompute `validationMessage` by native priority order on every `setValidity` call).** Rejected as out of scope. It would fully solve the message-prioritization gap but requires tracking state ADR 0016 never introduced, adds real complexity to a helper meant to remove boilerplate, and no concrete use case in the current examples or issue #98 needs it — the single-message fallback avoids the actual reported failure (a message silently dropping to empty).
- **Gate `delegateValidity()` behind `formAssociated()`/`formAssociatedCheckbox()` (e.g. as an extension method or a `FactoryContext` helper).** Rejected for the same reason ADR 0016 rejected `bindFormValue`/`bindValidity`-style wrappers (§ Alternatives Considered there): it would rename a low-level pattern instead of just removing its boilerplate, and would force every `formAssociated()` consumer to bundle it whether or not their component wraps a native control. A plain function taking `internals` directly keeps it tree-shakeable and usable outside the managed convention.

## Consequences

**Good:**

- Fixes a real, previously-undiscovered bug: `host.setCustomValidity()` no longer clobbers typed native flags set elsewhere on the same `internals` (or vice versa).
- `delegateValidity()` removes the repeated `VALIDITY_KEYS` copy-loop every "enhanced native input" component would otherwise hand-roll (per issue #98's own example).
- `delegateValidity()`'s `customError` exclusion means it composes cleanly with `setCustomValidity()` on the same `internals` — relaying a wrapped control's native flags never clobbers a `customError` set by other means, and vice versa.
- No change to the public host contract, the `formAssociated()`/`formAssociatedCheckbox()` extension surface, or bundle cost for consumers who don't import `delegateValidity`.

**Bad / trade-offs:**

- Message display across simultaneously-true flags from different sources is not perfectly native — see "Disclosed limitation" above. Accepted as a smaller, real gap rather than building the general solution speculatively.
- `mergeValidity`'s "reuse current message when this call has none" fallback means a caller cannot cleanly clear the *message* while leaving flags from another source true — but this matches the pre-existing constraint that any true flag requires a message at all (native `ElementInternals.setValidity()` throws otherwise), not a new one introduced here.
- The third fallback tier (`FALLBACK_VALIDITY_MESSAGE`) can surface a generic `'Invalid value'` to end users instead of a real description, specifically when relaying a `disabled`/`readonly` control's first true flag on a fresh `internals`. Accepted: the alternative is throwing, and the common case (a live, non-barred control, or a second-and-later flag transition) still gets a real message through tiers one or two.

**Compatibility:**

- Non-breaking. `managedSetCustomValidity`'s merge fix changes only previously-undefined/broken composition behavior — no test or documented contract relied on the replacing behavior. `delegateValidity()` is a new, optional export. Targets the next minor release.

## Related

- Requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), §4 (Accessibility)
- Amends: [ADR 0016](0016-element-internals-for-form-association-and-states.md) §5 (`setCustomValidity` implementation) and §7 (escape hatch); §1–4, §6, §8 unchanged
- Related: [ADR-0019](0019-extension-based-dependency-injection-for-definecomponent.md) — `formAssociated()`/`formAssociatedCheckbox()` extension mechanism `delegateValidity()` deliberately sits outside of
- Supersedes: None
