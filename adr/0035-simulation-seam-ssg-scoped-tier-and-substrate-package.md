# ADR 0035: The Simulation Seam — an SSG-Scoped Simulated Tier, a DOM-Free Realm Boundary, and a Substrate Package

## Status

✅ Accepted — amends [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s5.

## Context

[ADR 0029](0029-tiered-server-evaluation.md) routes each component to the cheapest mechanism that can answer its initial values; the **Simulated** tier is the expensive one, executing the generated client module against a jsdom realm ([ADR 0027](0027-server-simulation.md)). It is the single biggest cost lever: `sim/` is large, jsdom is a build dependency, and only two corpus components route Simulated. Measured against the framework goal, that cost framing is incomplete in three ways. **The realm has two consumers, not two components**: the equivalence audit renders *every Folded-tier component* through it in CI and pins the connect diff — the Folded tier's only handoff check, which caught a real instance of the dangerous class on first run. **Substrate pluggability has no candidate**: linkedom lacks custom elements; happy-dom **fails DOMPurify open** — the client module runs at connect inside the substrate, so a consumer's `sanitize` hook runs there, and one failing open writes hostile payloads into served HTML. **And [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s5's premise was not yet true**: the classifier reads the simulation's patch table, the build report lives in `sim/`, the realm's published types name jsdom — with no substrate, the compiler could not classify, report, or typecheck.

## Decision

1. **The Simulated tier is kept — the audit is half the reason.** Deleting the tier but keeping its audit saves the routing code and the build pass and nothing else; deleting both removes an evidenced check. The falsifiable question — *what is materially worse if the tier is deleted and its two components route Static?* — answers: those two ship skeletons instead of their options' initial state, **and** every other component loses the handoff check. The second half is the larger loss.

2. **The Simulated tier is SSG-scoped for all of 3.x.** The Folded tier survives template emission ([ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s3) by construction — folds independent of server args, server args as holes. The Simulated tier cannot: its output is computed by *executing* against concrete args and markup, and a value a program produced by running cannot be a hole; its fold also reads parsed light-DOM, which in a CMS is editorial content, not the component's own server args — the partial-readiness invariant does not hold. The benefit is real for the SSG pioneer, structurally unavailable to the CMS pioneers: for them a Simulated component emits a Static partial either way. Scope, not defect: an SSG capability, never carried by template emission, and shipped at 3.0 because the SSG pioneer is the release gate.

3. **The seam: three de-tanglings** — the substantive engineering of this ADR. (1) **The build report leaves `sim/`**: the census channel was never simulation, and non-simulating modules already import it. The registry of *which* notices a substrate emits stays with the driver — jsdom's classifications are not linkedom's — published as provider classifications the compiler-side channel takes as an argument. (2) **The patch table splits by audience**: the classifier-facing half moves compiler-side, so the tier classifier runs with no substrate present; the applier-facing half stays with the realm. (3) **The realm interface goes DOM-free**: `(markup, component, locale, options) → (html, diagnostics)` — no substrate type crosses it, the precondition for sub-design 6. After the seam, classification, the census, and the no-substrate path are substrate-free by construction.

4. **The seam is designed as a package boundary.** Versioned and resolver-based, so `@zeix/le-truc-simulation` can split out in a later 3.x without breaking; activation is *installation* — present or absent, no flag. Two properties make it work: the resolver reaches the driver through a **specifier the typechecker does not follow** (the compiler's own `tsc --noEmit` never walks the edge); and the driver declares a `seamVersion` with failure modes kept apart — **absence is a supported configuration; a version mismatch throws**, an installed-but-wrong driver being a broken install, not an opt-out. **The split does not happen at 3.0**: its costs are schedule costs at the wrong moment — a third npm name, release process, version lockstep with the generated-module contract — against ~50 KB saved; jsdom is the weight, and an opted-out consumer never installs it either way. Designing the boundary now costs almost nothing; retrofitting is breaking. jsdom must be a regular `dependency` of the split package; a devDependency is not installed for consumers.

5. **ADR 0034 s5 is corrected: the optional peer dependency depends on the seam.** The decision stands — jsdom optional, absence a routing outcome, never a build failure. The premise was wrong: unimplementable until sub-design 3 lands. The seam is a **prerequisite**, sequenced accordingly.

6. **Substrate pluggability waits for a substrate.** No pluggability mechanism while there is nothing to plug in. Recorded instead is the **acceptance criterion**: a consumer's `sanitize` hook must behave inside the candidate exactly as in a browser — DOMPurify must strip the hostile payload. Speed is not a qualifying argument — the re-litigation this criterion exists to prevent. The evaluation scripts stay as the harness.

## Alternatives Considered

- **Retire the tier; route its two components Static**: keeps `sim/`, jsdom and the CI cost anyway, or deletes the Folded tier's only handoff check — the saving was smaller than framed.
- **Keep the tier as-is, rationale recorded, nothing else**: leaves 0034 s5 on a false premise and jsdom types in the published `.d.ts`.
- **Build substrate pluggability now**: both candidates are disqualified — a mechanism with no second implementation is a guess at an interface.
- **Split `@zeix/le-truc-simulation` at 3.0**: rejected on timing, not merit; sub-design 4 preserves the option at negligible cost.
- **An in-process seam with a config flag**: forecloses installation-as-activation and makes a future second substrate a flag value — retrofitting the package boundary is breaking.
- **Keep jsdom a hard dependency, drop the opt-out**: heavyweight in every install for a capability only SSG consumers can use ([M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)).
- **Claim the Simulated tier as the CMS differentiator**: the mechanism cannot produce a template — the claim would not survive pioneer 2.

## Consequences

**Good:**

- The no-substrate path becomes structurally sound: classification, the census and typechecking stop depending on jsdom, making 0034 s5's policy implementable; the published types name no jsdom.
- The census channel lands home; substrate swap and package split stay reachable without breaking; the criterion is written before anyone argues speed again.
- The tier's scope is honest: an SSG capability, claimed where it works and not sold to the CMS pioneers.

**Bad / accepted tradeoffs:**

- The seam is refactoring with no user-visible outcome, inside a release gated on two external projects — the work that gets deferred under pressure, and 0034 s5 silently fails if it is.
- Moving the census churns three importers guarding a zero-unclassified baseline.
- The DOM-free seam loses type fidelity at the boundary; the driver keeps jsdom's types internally.
- The tier requirement is a Must-Have two of three personas cannot use — a later reviewer may re-open its priority.
- A package boundary with no second implementation — the hazard sub-design 6 rejects for substrates, accepted because retrofitting is breaking.
- The two corpus components remain the only evidence the tier works; the SSG pioneer is the first outside test and also the release gate.

## Related

- Requirements: [§5](../REQUIREMENTS.md#5-technical-constraints), [M20](../REQUIREMENTS.md#m20-server-simulation-realm), [M23](../REQUIREMENTS.md#m23-census-reporting-zero-warning-baseline), [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)
- Architecture: [Server Evaluation Tiers](../ARCHITECTURE.md#server-evaluation-tiers)
- Related: [ADR 0027](0027-server-simulation.md) s2 (the substrate criterion), [ADR 0029](0029-tiered-server-evaluation.md) s6/s7 (census; audit), [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s3–s5
