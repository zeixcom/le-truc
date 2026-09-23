# ADR 0040: Typed IR Contracts — Discriminated Unions and Pass Signatures

## Status

🔄 Proposed (owner rulings 2026-09-21, LT-235 grilling; implementation tasks LT-286–LT-289)

## Context

[COMPILER_REVIEW §2.6–2.7](../COMPILER_REVIEW.md) finds three IR types discriminating
their variants on nullability instead of a tag: `ForIR.listSignal: string | null` splits
two entirely different lowerings (server-data `each()` vs reactive `reconcile()`),
`try.pendingChildren: TemplateNode[] | null` splits error- from async-boundary, and
`SignalIR.init` means different things per `constructor` — forcing casts and truthiness
dispatch across the analysis passes and both emitters. Four parallel `first()` collections
and seven parallel `expose()` fields on `ComponentIR` describe single constructs as
scattered shapes. The analysis passes' contracts — loops-before-harvest, byte-stable query
order, `composeRegistry === undefined` silently disabling compose resolution — are prose,
and their failure mode is a silent wrong *tier*, not an error. LT-212's `@empty` arm adds
`ForIR` surface, so the shape must be settled before that work lands; [ADR
0037](0037-reactive-conditions-via-template-cloned-arms.md)'s rider adds its two node
shapes to the inventory this ADR records.

## Decision

The IR discriminates variants by tags, not nullability, and each analysis pass's contract
is its signature. Every task under this ADR lands byte-identical on goldens and parity —
wave-4 type work changes types, not behavior (COMPILER_REVIEW §3 items 17–20).

### 1. `ForIR` → `EachForIR | ReconcileForIR`

A `kind: 'each' | 'reconcile'` discriminant; fields live on the member that uses them
(`hoisted`/`indexName`/`iterableText` each-only; `keyName`/`keyText` reconcile-only). The
plan maps tighten to `Map<EachForIR, ForClientPlan>` and `Map<ReconcileForIR,
ReconcilePlan>`, so a pass reading the wrong map is a type error. `emptyArm: TemplateNode[]
| null` rides the union base — the reserved surface for LT-212's `@empty` arm, produced by
the `.tsrx` front end; whether `.tsx` produces it is LT-212's dual-surface ruling under
[ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) s6, and ADR 0037 s5 keeps
`@empty` on the toggle path, out of the keyed arm space. A server-data `@for` carrying a
`key` clause — silently collected and dropped today — becomes a compile diagnostic
(channel: compiler; tier 1 Prevented; next free LTC code; Tech Writer reviews the copy,
mirroring the `.tsx` surface's existing "the key clause is a reactive-List concern"
message).

### 2. `SignalIR` → three members by family

`DeclaredSignalIR` (`createCell`/`createState`/`createList`/`createStore` — init is the
initializer), `DerivedSignalIR` (`deriveCell`/`deriveList`/`deriveStore`/`createMemo` —
init is the derive expression), `ContextSignalIR` (`requestContext` — carries the fallback
node and its verbatim text; the `null`-everywhere-else `fallbackText` field dies).
`constructor` stays as a field narrowed within each member, so exact-constructor dispatch
(reactive `@for`'s `createList` requirement, for one) keeps working. The six hand-rolled
special-case sites become narrowings.

### 3. `try` is not reshaped here

Its target shape is recorded, not landed: [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md)
sub-design 4's keyed-arm boundary (arms `ok`/`nil`/`err` as `ArmTemplate`s, sub-design 6
below) replaces the toggle machinery with LT-276 — IR reshape and emission flip together.
Splitting `try` now would rewrite the ~20 walk sites that touch `pendingChildren` twice;
the cast at `analysis/effects.ts` survives until LT-276, documented as the scheduled
survivor.

### 4. One `first()` record, two `expose()` shapes

`refReasons`/`unmatchedOptionalRefs`/`deferredComposeRefs`/`optionalRefs` consolidate into
one `FirstRefDecl` (name, selector, required, reason, resolution stage, offset) in a
name-keyed Map — the resolution stage is data, not a different shape. `exposeText`/
`exposeRange`/`exposeArgNode`/`exposeAmbients` consolidate into `expose: ExposeStmt |
null`; `exposeProps`/`exposeKinds`/`parserExposeProps` consolidate into one per-prop
ReadonlyMap. `RegistryEntry.exposedProps` is a projection and unchanged. The
`setup`/`plainSetup`/`clientSetup`/`signals` arrays stay as they are: behavior-bearing
emission contracts, not redundancy.

### 5. Pass signatures carry the contracts

The order-carrying accumulators (queries, usedNames, ambient, childTags, refNames,
diagnostics — byte-stable query order is their documented invariant) become an explicitly
typed `PassShared` environment. Each pass's productions become return values the next pass
receives as required parameters — `runLoops(shared) → LoopPlans`,
`runHarvest(shared, loopPlans) → HarvestPlans`, `runEffects(shared, loopPlans, harvests) →
EffectPlans` — so harvest-before-loops is a compile error in `analyzeClient`, and "harvest
read an empty `forPlans` map" is unrepresentable. `resolveComposeRefs` returns a typed
`{ mode: 'resolved' | 'skipped' }` so a missing `composeRegistry` must be acknowledged by
the caller; `ambiguousComposeNodes` stays the already-reported channel, carried on the
resolved result.

### 6. The ADR 0037 inventory

`ArmTemplate = { key: ArmKey, children: TemplateNode[] }` with
`ArmKey = 'then' | 'else' | 'ok' | 'nil' | 'err' | 'case:<literal>'` — the named keys of
ADR 0037 s2. LT-274's conditional-over-signal node is a `kind: 'conditional'`
`TemplateNode` variant (test + two arms). Both land as types with their consumers — LT-274
and LT-276 — never as unproduced variants ahead of their machinery.

## Alternatives Considered

- **Nullability plus type guards** (all three types): keeps the casts and truthiness
  dispatch the review flagged — a guard is the same special-casing with a better name.
- **Nine-member per-constructor `SignalIR` union**: more precise than any dispatch site
  found; three families cover every consumer, and per-constructor differences stay inside
  a member's `constructor` field.
- **Landing the keyed-arm `try` shape (or the conditional node) now, emission unchanged**:
  writes ~20 walk sites against a shape no front end produces and no emitter consumes yet —
  the dead-surface critique COMPILER_REVIEW §2.10 makes, one iteration early.
- **Phased context views or DEV_MODE assertions for the pass contracts**: views keep the
  empty-map case representable at a mistyped call site; assertions catch violations in
  tests only, while the production failure mode (wrong tier) stays silent.
- **Consolidating the four setup arrays**: rejected — they are behavior-bearing emission
  contracts; the redundancy note in their own doc is a naming problem, not a shape one.

## Consequences

**Good:**

- The casts and truthiness dispatch §2.6 lists are removed, not relocated; the wrong-tier
  silent failure for loops-before-harvest becomes unrepresentable.
- LT-212 gets its reserved `emptyArm` surface before implementation, so the arm lands
  without reshaping `ForIR` twice.
- The ADR 0037 chain (LT-274/LT-276) consumes recorded shapes instead of designing
  mid-flight; the boundary reshape stays single-churn.
- One new diagnostic (the stray `key` clause), channel and tier ruled at design time per
  [ADR 0028](0028-tiered-error-surfacing.md).

**Bad / accepted tradeoffs:**

- Every `ForIR`/`SignalIR`/`first()`/`expose()` consumer changes — a wide, mechanical diff
  across the analysis passes and both emitters, verified byte-identical on goldens.
- `try`'s nullability and the `pendingChildren` cast survive one more iteration by design.
- §2.7's diagnostics threading (198 push sites) is deliberately untouched: the mutable
  array is the source-order carrier, and restructuring it has no live failure mode to fix.

## Related

- Requirements: [Type safety & Reliability](../REQUIREMENTS.md#4-non-functional-requirements), §1
- Architecture: [Server Evaluation Tiers](../ARCHITECTURE.md#server-evaluation-tiers)
- Compiler contract: [LE_TRUC_COMPILER.md §4](../server/compiler/LE_TRUC_COMPILER.md) (amended by this ADR; renumbering §4 is forbidden — ADRs cite it)
- Review: [COMPILER_REVIEW §2.6–2.7, §3.17–20](../COMPILER_REVIEW.md)
- Related ADRs: [ADR 0017](0017-keyed-template-clone-reconciliation-for-lists.md) (the reconcile lowering), [ADR 0028](0028-tiered-error-surfacing.md) (the key-clause rule's lifecycle), [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) (dual surfaces), [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) (arm keys; the rider)
- Tasks: LT-286 (ForIR union + key-clause diagnostic; gates LT-212), LT-287 (SignalIR union), LT-288 (first()/expose() consolidation), LT-289 (typed pass contracts); consumers: LT-212, LT-274, LT-276
