# ADR 0035: The Simulation Seam — an SSG-Scoped Simulated Tier, a DOM-Free Realm Boundary, and a Substrate Package

## Status

✅ Accepted

## Context

[ADR 0029](0029-tiered-server-evaluation.md) routes each component to the cheapest mechanism that can answer its initial values; the **Simulated** tier is the expensive one, executing the generated client module against a jsdom realm ([ADR 0027](0027-server-simulation.md)). [COMPILER_REFLECTION.md](../COMPILER_REFLECTION.md) §1 named it the single biggest lever in the system: `server/compiler/sim/` is 1,687 lines, jsdom is a build dependency, and exactly two of 22 corpus components route Simulated (`form-listbox`, and `form-combobox` via compose-read; census 20/2/0).

Grilling that against the framework goal (LT-239, owner session 2026-09-19) found the reflection's cost framing incomplete in three ways, and found [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s5 resting on a premise the code does not support.

**The realm has two consumers, not two components.** ADR 0029 s7's equivalence audit (`server/tests/compiler/equivalence-audit.test.ts`) renders *every Folded-tier component* through the realm in CI and pins the per-component connect diff. It is the only standing check on the Folded tier's hydration boundary, and it caught a real instance of the dangerous class on first run (form-tokenbox's input removed at hydration, LT-185). Retiring the tier would not retire `sim/`, jsdom, or the ~4 s CI cost unless the audit went with it.

**Substrate pluggability has no candidate.** ADR 0027 already ran the evaluation the reflection's §5 defers — `scripts/substrate-evaluation.ts` exercises both substrates against the spike checklist, DOMPurify, a byte-diff of `form-colorgraph`, and a full-build perf measurement. linkedom has no custom elements; happy-dom **fails DOMPurify open**, passing `<script>`, `on*` and `javascript:` through untouched. That is not a harness detail under simulation: the realm executes the client module at connect, so a consumer's `sanitize` hook runs *inside the substrate*, and a substrate where the sanitizer fails open writes the hostile payload into served HTML.

**ADR 0034 s5's premise is not yet true.** Three couplings block it. `server/compiler/tier.ts` imports `./sim/patch-table` — the *classifier* reads the simulation's data to decide which components are Simulated and to source the census reason, so with no substrate package the compiler cannot classify, and "route Static and record `unavailable substrate`" presupposes the classifier still knows what *would* have been Simulated. `sim/report.ts` is not simulation at all but the build report — `tierCensus`, `translationCensus`, `formatCensus`, `CLASSIFIED_DIAGNOSTICS` — imported by `server/effects/i18n.ts`, `server/effects/tsrx.ts` and `scripts/check-tsrx.ts`, none of which simulate anything. And `SimulationRealm` exposes `JSDOM['window']`, which `sim/index.ts`'s own header already flags: a consumer who deliberately skips the optional dependency cannot typecheck the compiler.

## Decision

### 1. The Simulated tier is kept, and the audit is half the reason

The tier stays. Its justification is no longer only the two components it renders: `sim/` also supplies ADR 0029 s7's equivalence audit, which is the Folded tier's only hydration-boundary check. Deleting the tier and keeping the audit saves the routing code and the build pass (`server/effects/simulate.ts`, ~330 lines) and nothing else; deleting both removes a check whose value is evidenced, not assumed.

The reflection's falsifiable question — *"what is materially worse if the tier is deleted and form-combobox/form-listbox route Static?"* — is answered: those two components ship a skeleton instead of their options' initial state, **and** the other twenty lose the check that caught LT-185. The second half is the larger loss.

### 2. The Simulated tier is SSG-scoped for all of 3.x

The Folded tier survives template emission ([ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s3) by construction: it resolves prop-independent expressions and leaves server args as holes. **The Simulated tier cannot.** Its output is produced by executing the client module against concrete argument values and concrete parsed markup, and a value a program computed by running cannot be left as a hole. A simulated component's fold also depends on its parsed light-DOM content, which in a CMS is editorial content rather than its own props — the partial-readiness invariant (s4) does not hold for it.

So the tier's benefit is real for pioneer 1 (SSG) and structurally unavailable to pioneers 2 and 3. For a CMS consumer a Simulated-tier component emits a Static partial whether or not the tier exists. This is recorded as scope, not as a defect: **the Simulated tier is an SSG capability**, [M20](../REQUIREMENTS.md#m20-server-simulation-realm) is amended to say so, and template emission is never asked to carry it.

It still ships with 3.0 rather than deferring to a later 3.x, because pioneer 1 is an SSG project and is the release gate — the tier is on the showcase's path.

### 3. The seam: three de-tanglings

Before the tier can be optional in any form, three couplings are cut. This is the substantive engineering of this ADR.

1. **The build report leaves `sim/`.** The census and report channel — `tierCensus`, `translationCensus`, `formatCensus`, `Census`, `CensusEntry`, and the diagnostic channel's partitioning, matching and copy — moves compiler-side. It was never simulation; it is the build's reporting surface, and three non-simulating importers already depend on it.

   The **registry** of standing entries (`CLASSIFIED_DIAGNOSTICS`) stays behind, and the split runs between the channel and its data rather than through the module: *which* notices a substrate emits is a fact about that substrate — jsdom's unimplemented canvas is not linkedom's — so a registry shipped with the compiler would be wrong the moment sub-design 6's future substrate arrives. The driver publishes its entries as `SimulationProvider.classifications` and the compiler-side channel takes them as an argument.
2. **`patch-table.ts` splits by audience.** The classifier-facing half — what the realm cannot answer, and the reason vocabulary the census prints — moves compiler-side so `tier.ts` classifies with no substrate present. The applier-facing half — the per-runtime force/fill/stub entries — stays with the realm.
3. **The realm interface goes DOM-free.** `SimulationRealm` stops naming jsdom types. The seam is `(markup, component, locale, options) → (html, diagnostics)`: no `window`, no `Document`, no substrate type crosses it. This is also the precondition for sub-design 6 — a substrate cannot be swapped behind a type that names the substrate.

After the seam, classification, the census, and the whole no-substrate build path are substrate-free by construction rather than by care.

### 4. The seam is designed as a package boundary

The seam is specified as a **versioned, resolver-based package interface**, not an in-process module boundary, so that `@zeix/le-truc-simulation` can be split out in a later 3.x without a breaking change. Activation is then *installation*: the substrate package is present or it is not, with no configuration flag and no degradation path threaded through the compiler.

Two properties make that work. The resolver reaches the driver through a **specifier the typechecker does not follow**, so the compiler's own `tsc --noEmit` never walks the edge into the substrate — this, not the type surface alone, is what makes the opt-out typecheck. And the driver declares a `seamVersion` the resolver checks, with the two failure modes kept apart: **absence answers "no driver" and is a supported configuration; a version mismatch throws**, because a driver that is installed and wrong is a broken install, not an opt-out.

**The split does not happen at 3.0.** The seam lands at 3.0 and the realm continues to ship inside `@zeix/le-truc-compiler`, because the split's costs are all schedule costs at exactly the wrong moment: a third npm name, release process and changelog on a release already gated on two external projects (ADR 0034 s6); and permanent version lockstep, since the substrate package executes *generated client modules* whose two-phase load/render contract, `define()` recording, children-first compose ordering and emission shape all cross the boundary. Against that, the split's saving over an optional peer dependency is ~50 KB of JavaScript — jsdom is the weight, and an opted-out consumer never installs it either way.

Designing the seam as a package boundary now costs almost nothing; retrofitting one later is a breaking change. That asymmetry is the whole reason for the shape.

*(Note for whoever executes the split: jsdom must be a regular `dependency` of `@zeix/le-truc-simulation`. A devDependency is not installed for consumers.)*

### 5. ADR 0034 s5 is corrected: the optional peer dependency depends on the seam

[ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s5's decision stands — jsdom is an optional peer dependency, absence is a routing outcome with an `unavailable substrate` census reason, never a build failure. Its **premise** was wrong: the compiler as it stands cannot classify, report, or typecheck without the substrate, so the policy is unimplementable until sub-design 3 lands. The seam is therefore a **prerequisite of** the optional peer dependency, not a later refinement of it, and the two are sequenced accordingly in the release track.

### 6. Substrate pluggability waits for a substrate

No pluggability mechanism is built while there is nothing to plug in. What is recorded instead is the **acceptance criterion any future substrate must pass**: a consumer's `sanitize` hook must behave inside the candidate exactly as it does in a browser — concretely, DOMPurify must strip the ADR 0027 hostile payload. Speed is not a qualifying argument, which is the specific re-litigation this criterion exists to prevent.

`scripts/substrate-evaluation.ts` and `scripts/lib/substrate-probe.ts` stay as scripts: the harness that would prove a swap already exists and is the cheapest way to evaluate a future candidate.

## Alternatives Considered

- **Retire the tier; route the two components Static (LT-239 option c).** Rejected on sub-design 1: it either keeps `sim/`, jsdom and the CI cost anyway, or it also deletes the Folded tier's only hydration check, whose value is evidenced by LT-185. The saving was smaller than the reflection's framing implied.
- **Keep the tier as-is, rationale recorded, nothing else (option a).** Rejected: it leaves ADR 0034 s5 resting on a false premise and leaves jsdom types in the published compiler's `.d.ts`.
- **Build substrate pluggability now (option b's pluggability half).** Rejected: both evaluated candidates are disqualified — linkedom lacks custom elements, happy-dom fails the sanitizer criterion. A pluggability mechanism with no second implementation is a guess at an interface.
- **Split `@zeix/le-truc-simulation` at 3.0.** Rejected on timing, not on merit; see sub-design 4. The seam preserves the option at negligible cost.
- **An in-process seam with a config flag for activation.** Simpler, and sufficient for the optional peer dependency. Rejected because it forecloses installation-as-activation and makes a future second substrate a flag value rather than a package — and retrofitting the package boundary later is breaking.
- **Keep jsdom a hard dependency and drop the opt-out.** Rejected under [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight): a heavyweight dependency in every downstream install for a capability only SSG consumers can use.
- **Claim the Simulated tier as the CMS differentiator** (the framing LT-239 inherited). Rejected on sub-design 2: the mechanism cannot produce a template, so the claim would not survive pioneer 2.

## Consequences

### Good

- The no-substrate path becomes structurally sound rather than aspirational: classification, the census and typechecking stop depending on jsdom, so ADR 0034 s5's policy is implementable.
- The published compiler's types no longer name jsdom, so an opted-out consumer can typecheck.
- The census channel lands where it belongs. Three non-simulating importers stop reaching into `sim/` for the build report.
- A future substrate swap and a future package split are both reachable without a breaking change, and the criterion for admitting a substrate is written down before anyone argues speed again.
- The tier's scope is honest: an SSG capability, claimed where it works and not sold to the CMS pioneers.

### Bad

- **The seam is refactoring with no user-visible outcome**, scheduled inside a release track already gated on two external projects — the kind of work that gets deferred under pressure, and ADR 0034 s5 silently does not work if it is.
- Moving the census out of `sim/report.ts` touches `server/effects/i18n.ts`, `server/effects/tsrx.ts` and `scripts/check-tsrx.ts`; the translation census and the tier census share a module today for no reason other than history, and separating them risks churn in a file with a zero-unclassified baseline to preserve.
- A DOM-free realm interface loses type fidelity inside the driver, which currently benefits from jsdom's own `Document` type. The driver keeps it internally; only the seam is DOM-free.
- **[M20](../REQUIREMENTS.md#m20-server-simulation-realm) becomes a Must-Have that two of three target personas structurally cannot use.** The scoping is honest but the requirement's priority now reads oddly, and a later reviewer may reasonably re-open whether it belongs in Must Have.
- Designing a package boundary that is not yet a package means an interface with no second implementation and no consumer pressure on it — the same hazard sub-design 6 rejects for substrates, accepted here because the alternative is a breaking change later.
- The two corpus components remain the only evidence the tier works. Pioneer 1 is the first outside test, and it is also the release gate.

## Related

- Requirements: [§1](../REQUIREMENTS.md#1-problem-statement), [§5](../REQUIREMENTS.md#5-technical-constraints), [§6](../REQUIREMENTS.md#6-assumptions--dependencies), [M19](../REQUIREMENTS.md#m19-tiered-server-evaluation), [M20](../REQUIREMENTS.md#m20-server-simulation-realm), [M23](../REQUIREMENTS.md#m23-census-reporting-zero-warning-baseline), [M27](../REQUIREMENTS.md#m27-backend-neutral-template-emission), [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)
- Architecture: [ADR 0027](0027-server-simulation.md) s2 (the substrate choice and its criterion), [ADR 0029](0029-tiered-server-evaluation.md) s6 (the census), s7 (the equivalence audit), s8 (SSG scope), [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s3–s5
- Provenance: [COMPILER_REFLECTION.md](../COMPILER_REFLECTION.md) §1, §5; owner grilling session LT-239 (2026-09-19)
