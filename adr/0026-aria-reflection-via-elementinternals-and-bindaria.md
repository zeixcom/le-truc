# ADR 0026: ARIA Reflection via ElementInternals and `bindAria()`

## Status

✅ Accepted (2026-08-31).

## Context

[ADR 0016](0016-element-internals-for-form-association-and-states.md) withheld ARIA reflection (`internals.role`, `internals.aria*`) and advised explicit `aria-*` attributes, naming three blockers: axe-core could not see internals-set semantics (so broken nesting went unflagged), Chromium did not map `internals.aria*` into the accessibility tree, and the spec gap [w3c/aria #2663](https://github.com/w3c/aria/issues/2663). By August 2026 all three are lifted, with qualifications ([issue #121](https://github.com/zeixcom/le-truc/issues/121), [PoC findings](archive/0026-poc-findings.md)): reflection works in every evergreen engine except Chromium's missing `ariaOwnsElements`; axe-core ≥ 4.13 honors only `internals.role`, in some rules, and only via the [ElementInternals declaration community protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/element-internals-declaration.md); tools still cannot read internals-set semantics.

Two platform facts shape the design. **Internals values are default semantics**: a host `role`/`aria-*` attribute overrides them, so the consumer cannot be locked out. **Visibility differs by target**: an ARIA IDL write on an `Element` mirrors into the attribute; on `ElementInternals` it creates no attribute and matches no selector. Meanwhile authors hand-roll coercion and ID plumbing, with no null-guarded reactive path to internals.

Requirements: [M1](../REQUIREMENTS.md#m1-component-definition-via-a-single-function), [M3](../REQUIREMENTS.md#m3-attribute--property-initialisation-via-parsers), [M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects), §4 (Accessibility, Browser support, Performance).

## Decision

Lift ADR 0016's advisory and replace its "ARIA reflection: available but not promoted" section. ARIA reflection via `ElementInternals` is a **recommended, first-class channel** alongside content attributes, governed by a two-channel policy, served by one binding helper (`bindAria()`), and made tooling-visible by implementing the declaration protocol for every component. Additive; `bindAttribute`/`bindProperty` keep their roles.

### 1. Two-channel policy

Content attributes are the consumer-facing override; reflection is the component-owned default.

| Concern | Channel |
|---|---|
| Initial state in server-rendered HTML | `aria-*` attribute, read by parsers ([ADR 0003](0003-attributes-drive-state-at-connect-time-only.md)); reflection is runtime-only |
| Consumer overrides component semantics | attribute; the platform guarantees it wins |
| Component-owned host semantics (`role`, `aria-expanded`, `aria-valuenow`, …) | `internals.aria*` via `bindAria()` |
| Component-internal relationships | element references via `bindAria()`, no ID plumbing |
| Relationships the consumer authors | attribute (IDREF); the component only reads it |
| State CSS must select on | attributes; `:state()` stays the styling hook ([ADR 0016](0016-element-internals-for-form-association-and-states.md) §8) |

**No-mixing rule**: component code never writes both channels for the same property on the same element. ARIA state on inner native elements (`option.ariaSelected = 'true'`) is unchanged: native reflection keeps it CSS- and axe-visible.

**Stale-attribute rule, handled by the library.** A pre-existing host attribute permanently shadows the same property's reflection, silently voiding every later write, so `bindAria()` removes it: *the server-rendered attribute is the initial value; from then on the component owns the property via internals.* It fires **once per property, at the first value-bearing `ok()`** (a `nil` or `null` removes nothing), **only for `ElementInternals` targets**, and **after parsers consumed the attribute** at connect (ADR 0003, [ADR 0007](0007-effect-descriptors-with-deferred-activation.md)). So only the server echo is cleared; a consumer setting the attribute after connect still wins. Its omission would fail silently and totally, which is what a helper must absorb. It is a no-op for internals the library did not create.

### 2. `bindAria()` binding helper

One helper in `src/bindings.ts`: `watch('expanded', bindAria(internals, 'ariaExpanded'))`.

- **Target** `ARIAMixin | null | undefined`: `Element` and `ElementInternals` both implement it, so one signature covers host reflection and inner elements. **Name** `keyof ARIAMixin & string`: the platform names, nothing hidden.
- **Return** `SingleMatchHandlers`, for `watch`'s `nil` path: boolean → `'true'`/`'false'` (never an empty string); number → decimal string; string or element references pass through; `null`/`undefined` and `nil` clear the reflection, restoring attribute authority. `null` is a runtime contract, not a typed one: `T extends {}` keeps it out of `AriaValue`, yet a resolved `null` reaches `ok()` and is guarded.
- **Map form** per [ADR 0023](0023-map-form-overloads-for-bind-helpers.md): `bindAria(internals, ['ariaValueNow', 'ariaValueText'])`. The declared names are the complete set owned; an absent or nullish entry clears its property, `nil` clears all. Several ARIA properties from one value is common.
- **Debug attribution** ([ADR 0022](0022-debug-extension-for-visual-and-console-instrumentation.md)): `Element` targets register; `ElementInternals` targets carry no host reference and are skipped, as with `bindState`.

**Capability fallback.** The target is probed once, at bind time, and binds the strongest channel it supports: (1) a full `ARIAMixin` target gets reflection plus the stale-attribute rule; (2) internals without a working reflection surface (the simulation realm's skeletal jsdom internals, an engine without `attachInternals()`) binds the host's **content attribute** with the same coercion, the stale-attribute rule off because the attribute is the live channel, and element-reference properties as no-ops since they have no attribute form without ID plumbing; (3) a null target is a no-op. The reason is serialization: reflection never serializes, so a realm asserting through it would delete the server-rendered value and serialize nothing ([ADR 0027](0027-server-simulation.md)). It is a capability tier, not a failure: no diagnostic, no Surfacing Tier. `bindState()` gets the same probe (no `states` surface → no-op, extending ADR 0016 §8). Internals null on the context stay unrescued: a form-associated component whose internals the library degraded (ADR 0027) keeps `bindAria(null, …)` a no-op; the mitigation is authored markup.

Static ARIA (`internals.role = 'slider'`, one-time reference wiring) stays **imperative in the factory body**, per ADR 0016's grounds against wrapping single statements; reactive bindings have real mapping to hide.

### 3. ElementInternals declaration protocol, implemented once

The `Truc` constructor, where `attachInternals()` is already called (ADR 0016 §1), registers successful internals in the protocol's registry, `globalThis._elementInternals`. Every component is then axe-visible with zero opt-in, production included. Internals is **not** exposed as a public host property: the protocol rejects public accessors and declares the registry tooling-only. It is a stopgap, removable without API impact once native introspection ships. Only `aria-allowed-attr` and `aria-prohibited-attr` act on an internals-only role: the nesting rules select on the `[role]` attribute before role computation.

### 4. `ariaOwnsElements`: withheld

Not used or promoted: Chromium lacks it, and `aria-owns` semantics are problematic in themselves. Revisit when Chromium ships it.

### 5. Examples migrate where reflection is strictly better

Internal relationships move to element references; reactive host state nothing selects on moves to `bindAria()`. Attribute ARIA stays where selectors consume it and where the consumer authors the relationship. **Migration is bounded by testability**: a property moves only when reflection is strictly better *and* its semantics can still be asserted (the Chromium accessibility-tree tier or manual AT). Structural roles stay on attributes.

## Alternatives Considered

- **Advisory lift only (no helper)**: per-site coercion and null guards, the boilerplate binding helpers exist to remove. Rejected.
- **Reuse or extend `bindProperty(internals, …)`**: no null guard, no boolean coercion, no `nil` path; extending it hides ARIA semantics in a general helper. Rejected.
- **Declarative reflection map or `expose()`-integrated reflection**: conflates the public prop surface ([ADR 0002](0002-factory-form-over-builder-pattern.md)) with component-owned defaults. Rejected.
- **An `ariaReflection()` extension** auto-reflecting `aria*` props: implicit writes, surprising reads, and [ADR 0019](0019-extension-based-dependency-injection-for-definecomponent.md) extensions are class-level configuration. Rejected.
- **Reflection-first (deprecate attribute ARIA)**: breaks the server-authored channel (M3), CSS selection, `getAttribute()` code, and the consumer override. Rejected.
- **Stale-attribute removal as author responsibility**, since the platform cannot tell an SSR echo from an override: under ADR 0003 the distinction is temporal, so one-time removal is safe, and an optional mandatory line fails silently. Rejected.
- **Public `host.internals` property**: the protocol rejects it for cross-library name collisions. Rejected.

## Consequences

**Good:**

- Live host `role`/`aria-*` that no framework rewriting attributes can clobber; element references end ID plumbing and duplicate/missing IDs.
- Every component is axe-visible (≥ 4.13) without opt-in; attributes invalid for an internals-set role are flagged again.
- Served HTML keeps `role`/`aria-*` initial values where no reflection surface exists, so server evaluation and no-JS do not regress (ADR 0027).

**Bad / accepted tradeoffs:**

- **ADR 0016's nesting trap is not recovered** (§3): structural/composite roles (`list`, `listbox`, `menu`, `table` and their children) stay on attributes or native elements; internals reflection is for host widget and state semantics. Revisit when axe drops the `[role]` selector gates.
- **axe coverage is partial**: `internals.role` only, two rules, via a Draft stopgap protocol.
- **Internals state is invisible to CSS, `getAttribute()`, DOM-emulation tests, and Playwright's role queries**; accessibility-tree ground truth is Chromium-only in CI, cross-engine confidence needs manual AT. This bounds §5.
- **Element-reference gotchas**: `ariaErrorMessageElements` is inert until `aria-invalid` is set; assigning `aria*Elements` empties the mirrored attribute instead of removing it.
- **A page-visible global** registry, as the protocol prescribes. **Cost**: `bindAria` sits in the minimal entry but tree-shakes; one WeakMap set per instance, one probe per binding.
- **Served HTML depends on the substrate's internals capability**; per-substrate simulated goldens (ADR 0027) pin it, and a substrate swap re-baselines by design.

## Related

- Amends: [ADR 0016](0016-element-internals-for-form-association-and-states.md), replacing its "ARIA reflection: available but not promoted" section; its §1–8 unchanged
- Related: [ADR 0027](0027-server-simulation.md), [ADR 0029](0029-tiered-server-evaluation.md): the capability fallback scopes the realm's internals posture (only form-associated components degraded) and the tier classifier (ARIA expressions realm-answerable; `internals.states` and form members not). Also ADR 0003, 0022, 0023
- Key files: `src/bindings.ts`, `src/internal.ts`, `docs-src/pages/accessibility.md`
- External: [axe-core element-internals docs](https://github.com/dequelabs/axe-core/blob/develop/doc/element-internals.md) · [MDN ARIAMixin](https://developer.mozilla.org/en-US/docs/Web/API/ARIAMixin)
- Supersedes: None
