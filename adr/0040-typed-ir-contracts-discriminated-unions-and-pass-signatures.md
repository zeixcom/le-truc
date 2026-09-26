# ADR 0040: Typed IR Contracts — Discriminated Unions and Pass Signatures

## Status

✅ Accepted

## Context

The compiler review finds three IR types discriminating their variants on nullability instead of a tag: `ForIR.listSignal: string | null` splits two entirely different lowerings (server-data `each()` vs reactive `reconcile()`), the try node's nullable children split error- from async-boundary, and `SignalIR.init` means different things per `constructor` — forcing casts and truthiness dispatch across the analysis passes and both emitters. Four parallel `first()` collections and seven parallel `expose()` fields on `ComponentIR` describe single constructs as scattered shapes. The analysis passes' contracts — loops-before-harvest, byte-stable query order, a silently-absent compose registry disabling compose resolution — are prose, and their failure mode is a silently wrong Evaluation Tier, not an error. The empty arm adds `ForIR` surface, so the shape must be settled before it lands. [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) adds its two node shapes to the inventory this ADR records.

## Decision

The IR discriminates variants by tags, not nullability, and each analysis pass's contract is its signature. Every reshape lands byte-identical on goldens and parity — type work, not behavior.

**Every IR reshape lands before the first publish of `@zeix/le-truc-compiler`.** The four core types are exported from `contract.ts`, whose stability policy makes renames, removals and tightened shapes a major change after the first publish. Sub-designs 2 and 4, and the two deferred shapes of sub-designs 3 and 6, therefore gate that publish — otherwise each becomes a 4.0 change. Sub-design 5 changes internal signatures only and has no publish constraint.

1. **`ForIR` → `EachForIR | ReconcileForIR`.** A `kind` discriminant; fields live on the member that uses them. The plans map to per-member types, so a pass reading the wrong map is a type error. `emptyArm` rides the union base, produced by both front ends (the `.tsrx` `@empty`, and the `.tsx` length-check idiom per [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) s6); [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) s5 keeps `@empty` on the toggle path, out of the keyed arm space. **The arm's roots are shared, not moved:** they sit both in `emptyArm` and in the template tree as the loop output's following siblings, so selector resolution, id checks and prose checks cover them with no extra code, and the server emitter skips them in its plain walk through an identity set and renders them from the loop — the existing sharing convention, and the one implicit contract this ADR accepts rather than removes. A server-data `@for` carrying a `key` clause is a compile diagnostic — otherwise the key would be silently dropped.

2. **`SignalIR` → three members by family.** Declared (`createCell`/`createState`/`createList`/`createStore` — init is the initializer), Derived (`deriveCell`/`deriveList`/`deriveStore`/`createMemo` — init is the derive expression), Context (`requestContext` — carries the fallback node and its verbatim text; the null-everywhere-else fallback field dies). `constructor` stays as a field narrowed within each member, so exact-constructor dispatch (reactive `@for`'s `createList` requirement, for one) keeps working. The hand-rolled special-case sites become narrowings.

3. **The try node is not reshaped here.** Its target shape is recorded, not landed: [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) sub-design 4's keyed-arm boundary replaces the toggle machinery when the boundary migrates — IR reshape and emission flip together. Splitting `try` now would rewrite the ~20 walk sites that touch its children twice; the one surviving cast is documented as the scheduled survivor. The `<truc:try>` spelling ([ADR 0041](0041-truc-intrinsic-elements-for-compiler-consumed-constructs.md)) changes only the `.tsx` surface and lowers to today's node, landing before the boundary migration, which then reshapes the node under both front ends in one change.

4. **One `first()` record, two `expose()` shapes.** The four scattered reference collections consolidate into one `FirstRefDecl` (name, selector, required, reason, resolution stage, offset) in a name-keyed Map — the resolution stage is data, not a different shape. The expose fields consolidate into one optional statement record plus one per-prop ReadonlyMap; `RegistryEntry.exposedProps` is a projection and unchanged. The four setup arrays stay as they are: behavior-bearing emission contracts, not redundancy.

5. **Pass signatures carry the contracts.** The order-carrying accumulators (queries, used names, ambients, child tags, ref names, diagnostics — byte-stable query order is their documented invariant) become an explicitly typed `PassShared` environment. Each pass's productions become return values the next pass receives as required parameters — loops → plans, harvest(shared, loopPlans) → harvest plans, effects(shared, loopPlans, harvests) → effect plans — so harvest-before-loops is a compile error, and "harvest read an empty plans map" is unrepresentable. Compose resolution returns a typed resolved-or-skipped result so a missing compose registry must be acknowledged by the caller.

6. **The reactive-conditions inventory.** `ArmTemplate` (key + children) with the named arm keys of [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) s2; the conditional-over-signal node is a `conditional` `TemplateNode` variant (test + two arms). Both land as types with their consumers, never as unproduced variants ahead of their machinery.

## Alternatives Considered

- **Nullability plus type guards** (all three types): keeps the casts and truthiness dispatch the review flagged — a guard is the same special-casing with a better name.
- **Nine-member per-constructor `SignalIR` union**: more precise than any dispatch site found; three families cover every consumer, and per-constructor differences stay inside the member's `constructor` field.
- **Landing the keyed-arm try shape (or the conditional node) now, emission unchanged**: writes ~20 walk sites against a shape no front end produces and no emitter consumes yet — dead surface.
- **Phased context views or dev-mode assertions for the pass contracts**: views keep the empty-map case representable at a mistyped call site; assertions catch violations in tests only, while the production failure mode (wrong tier) stays silent.
- **Consolidating the four setup arrays**: they are behavior-bearing emission contracts; the redundancy note in their own doc is a naming problem, not a shape one.

## Consequences

**Good:**

- The casts and truthiness dispatch are removed, not relocated; the wrong-tier silent failure for loops-before-harvest becomes unrepresentable.
- The empty arm gets its reserved surface before implementation, so it lands without reshaping `ForIR` twice; the reactive-conditions chain consumes recorded shapes instead of designing mid-flight, keeping the boundary reshape single-churn.
- One new diagnostic (the stray key clause), its channel and Surfacing Tier ruled at design time per [ADR 0028](0028-tiered-error-surfacing.md).

**Bad / accepted tradeoffs:**

- Every `ForIR`/`SignalIR`/`first()`/`expose()` consumer changes — a wide, mechanical diff across the analysis passes and both emitters, verified byte-identical on goldens.
- The try node's nullability and its cast survive until the boundary migration, by design.
- The diagnostics threading (nearly two hundred push sites) is deliberately untouched: the mutable array is the source-order carrier, and restructuring it has no live failure mode to fix.

## Related

- Requirements: [Type safety & Reliability](../REQUIREMENTS.md#4-non-functional-requirements), §1
- Architecture: [Server Evaluation Tiers](../ARCHITECTURE.md#server-evaluation-tiers)
- Compiler contract: [LE_TRUC_COMPILER.md §4](../server/compiler/LE_TRUC_COMPILER.md) (amended by this ADR; renumbering §4 is forbidden — ADRs cite it)
- Review: [COMPILER_REVIEW](../COMPILER_REVIEW.md) §2.6–2.7, §3.17–20
- Related: [ADR 0017](0017-keyed-template-clone-reconciliation-for-lists.md) (the reconcile lowering), [ADR 0028](0028-tiered-error-surfacing.md) (the key-clause rule's lifecycle), [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) (dual surfaces), [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) (arm keys; the reactive-conditions shapes)
