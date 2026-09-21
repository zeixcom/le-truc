# ADR 0037: Reactive Conditions — Conditional Arms as Template-Cloned Branches

## Status

🔄 Proposed (owner ruling 2026-09-21; implementation tasks LT-274/LT-275/LT-276)

## Context

`validateCondition` (`server/compiler/lower-shared.ts`) denies signal reads in every
control-flow condition on both surfaces — `@if`/`@switch` tests and `.tsx` ternary/`&&`
tests alike — with LTC005, whose own message names the reason: "the DOM keeps the initially
rendered branch, so a signal condition would silently stop matching." Client-side
conditional rendering is outside the model.

The denial is containment of a real trap, but the trap is a property of *toggled* semantics
(one branch's DOM exists; a flipping condition has nothing to switch to), not of the syntax.
Upstream, the two signals-based host profiles that render at least once on the client treat
conditions over signals as legal (Octane, render-scope re-run) or idiomatic (Solid,
create/dispose control flow) — identical authored syntax carries three different contracts
across profiles, which is the confusion the TSRX upstream questions in
`server/compiler/HOST_PROFILE.md` ("Branch DOM lifetime") demand each profile declare its
way out of. Keeping the denial makes Le Truc the profile whose contract only the compiler
knows. Owner ruling 2026-09-21: legalize the syntax and give it Le Truc semantics.

## Decision

Conditions over signals are legal on both surfaces, and their arms are **template-cloned
branches** — created from an inert `<template>` when the condition turns true, disposed when
it turns false (the `@for`/`reconcile()` precedent, ADR [0017](0017-keyed-template-clone-reconciliation-for-lists.md)) — not simultaneously rendered arms toggled via `hidden`.

### 1. Legality and lowering

A condition that reads a signal (`@if`/`@else` — `@else` optional per the TSRX grammar —
`.tsx` ternary/`&&`, IIFE switch, `@switch`/`@case`) lowers to: each arm extracted to an
inert `<template>`; the server folds the condition's **initial** value through the existing
fold rules (every tier) and renders only the winner live beside the inert templates; the
client lowers to `reconcile()` over a reactive **current-arm-key source** — a new branded
source form beside `MutableList`/`DerivedList`: a `Signal<string | null>` whose key set is
the one current arm or none. Forcing conditionals through `createList`'s per-item machinery
would buy dead weight; the key-signal form is `reconcile()`'s only runtime addition.

**Static (server-known) conditions are unchanged.** The Folded tier still renders the single
winner and omits the rest — no templates, no client construct — so byte-identity across
tiers and the corpus's zero-warning baseline are untouched.

### 2. Arm keys are named, compile-time constants

Keys come from the construct's own vocabulary: `then`/`else` (ternary, `@if`/`@else`),
`case:<literal>` (`@switch`/`@case` — case values must be literals; a dynamic case value is
a compile diagnostic, no fallback), `ok`/`nil`/`err` (the boundary, sub-design 4). Both the
server emit and the generated client derive the same constant, which is what makes adoption
work: the first reconcile run recognizes the server-rendered winner by key membership
(ADR 0017's contract). Named keys stay correct under partial deploys — a cached CDN page's
HTML and a fresh client bundle agree on the mapping even after an arm's *content* is edited,
because identity is structural, not derived from content. Rejected: content hashes (an arm
edit changes the hash, so every cached page adoption-misses and flash-reclones) and bare
integers (fragile under arm reordering, opaque in the DOM) — an arm set is a compile-time
structural fact, not data; when identity is static, name it.

### 3. Arm content owns its effects

Per-arm mounts run under ADR [0014](0014-keyed-per-element-scopes-for-memo-collections.md)'s
keyedScopes discipline with collector parity: `watch()`/`on()`/`pass()` are usable inside an
arm, mounts are created on enter and disposed on leave (teardown-before-setup). The existing
`guarded` emission (single-branch `@if`, effects under an existence guard) generalizes to
per-arm mounts. Arms never re-render their content — a re-entry clones the server-baked
template again; the only live writes are the boundary's value/error text (sub-design 4).

### 4. The boundary switches to the same mechanism

`@try`/`@pending`/`@catch` arms become templates plus adopted winner, keyed `ok`/`nil`/`err`.
This retires machinery that exists only because both arms are live simultaneously: the
fieldset wrappers `emit-server.ts` places at every arm root, the client's `hidden` +
`disabled` sweep, and the LT-086 `.parentElement` addressing (the fieldset existed to make
disabling cheap; `hidden`/`display:none` excludes nothing from form submission). The ok
arm's resolved-value text and the err arm's bound catch-param text move into the per-arm
mount. LT-211's no-stale-arm ruling and the reactive `isPending` idiom are untouched;
boundary flips are rare by that ruling, so re-clone cost is negligible.

### 5. Scope rules

- Reactive conditions inside a `reconcile()` container are **banned** until LT-186's
  unkeyed-sibling rule exists (diagnostic; channel compiler, tier 1 Prevented).
- Arm templates inherit `@for`'s extracted-template container hygiene (the
  `data-unreconciled`/template-exemption answer); pinned at implementation, not new machinery.
- `@for`'s `@empty` arm stays on the toggle path — it shares the item container's `data-key`
  namespace, and joining the keyed space buys nothing (LT-212 scope).
- A condition whose initial value is unresolvable in every tier (ADR
  [0029](0029-tiered-server-evaluation.md) sub-design 1) has no server-pickable winner: no
  arm renders live, and the established authored-mitigation rule applies — the author
  supplies the default; the compiler does not guess.

## Alternatives Considered

- **Toggled arms (the boundary precedent generalized)**: rejected. Both arms live
  simultaneously resurrects the duplicate-`id`/duplicate-`name`/double-submit class the
  boundary emitter already fights with fieldsets and `disabled` sweeps; never-shown arms'
  nested components upgrade eagerly at connect; and the client semantics would *diverge*
  from Solid/Octane's create/dispose for the one construct being legalized. Toggled remains
  available where state-preserving arms are wanted: `hidden={() => …}` thunks, and the
  boundary until LT-276 migrates it.
- **Keeping LTC005's denial**: rejected — upstream pressure (identical syntax legal or
  idiomatic in the other signals hosts) plus the HOST_PROFILE declaration demand make
  silent divergence the expensive outcome; the diagnostic's own message concedes the trap is
  in the old semantics, not the syntax.
- **Content-hash or integer-suffix keys**: rejected — sub-design 2.
- **A heuristic choosing toggled vs cloned per arm**: rejected — one lowering with fixed
  semantics; the project's precedent is "what you write decides your tier, not whether you
  get an error," explicit over clever.

## Consequences

**Good:**

- The sanctioned subset gains client-side conditional rendering with one small runtime
  addition (the arm-key source form); `reconcile()` itself is already exported, so the
  M14 bundle budget impact is bounded and checked in LT-274.
- Duplicate-identity hazards (ids, form names, `for`/`aria` references, double submission)
  are structurally impossible for conditional arms; the boundary sheds its fieldset machinery.
- This host's branch-DOM-lifetime answer converges with Solid's (create/dispose) while the
  two-artifacts, no-state-shipped posture is untouched — the upstream declaration story
  gains an answer instead of an exception.
- `@else` already exists in the TSRX grammar — no upstream ask.

**Bad / accepted tradeoffs:**

- Le Truc now creates DOM from conditions as well as from lists — ADR 0017's "bounded
  exception" widens (amended there).
- Uncommitted input state inside an arm is destroyed on flip. Matches Solid/Octane
  semantics; preservation remains available via toggle-shaped constructs.
- Adoption is the historically bug-prone seam (LT-185). The equivalence audit's
  connect-diff classes grow (initial arm state is a new designed class), and the boundary
  migration churns every boundary-using component's goldens.
- LTC005's condition arm retires and new codes arrive — the ADR 0028 error-message
  lifecycle runs, Tech Writer owns final copy.

## Related

- Requirements: [M5](../REQUIREMENTS.md#m5-fine-grained-dom-effects), [M6](../REQUIREMENTS.md#m6-automatic-dependency-tracking), [M14](../REQUIREMENTS.md#m14-tree-shakeable-exports), §1, §4
- Architecture: [List Reconciliation](../ARCHITECTURE.md#list-reconciliation), [Authoring Surfaces](../ARCHITECTURE.md#authoring-surfaces), [Server Evaluation Tiers](../ARCHITECTURE.md#server-evaluation-tiers)
- Amends: [ADR 0017](0017-keyed-template-clone-reconciliation-for-lists.md) (the DOM-creation exception widens to conditions; the arm-key source form), [ADR 0029](0029-tiered-server-evaluation.md) (arm extraction + initial arm state in the fold and the audit), [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (template extraction gains arm templates), [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) (parity covers reactive conditions), [ADR 0030](0030-internationalization-as-build-time-server-data.md) (`t` inside an extracted arm body is a build-time constant, per the LT-215 template-baking precedent), [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) (template emission carries a reactive condition as a backend conditional or hidden-by-expression)
- Related ADRs: [ADR 0014](0014-keyed-per-element-scopes-for-memo-collections.md) (arm-mount ownership), [ADR 0028](0028-tiered-error-surfacing.md) (diagnostic lifecycle), [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (the client corrects at connect, arms included)
- Tasks: LT-274 (conditions, both surfaces), LT-275 (diagnostics lifecycle), LT-276 (boundary switch)
