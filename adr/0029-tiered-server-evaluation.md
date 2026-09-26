# ADR 0029: Tiered Server Evaluation — Route Each Component to the Cheapest Phase That Can Answer

## Status

✅ Accepted

## Context

[ADR 0027](0027-server-simulation.md) made Server Simulation the unconditional mechanism for initial HTML, on a correctness argument that still holds — but it lacked cost data. Simulation measures ~1.1 ms per component occurrence and ~3.9 s per docs build, and much of it buys nothing. The corpus's largest cost driver reads only layout geometry (jsdom returns silent zeros) and emits exclusively through `ElementInternals` (not serialized, so its output renders nothing). Most unresolved reads sit in client-only positions that never reach served bytes.

## Decision

**Server evaluation is tiered.** Each component is statically routed at compile time to the cheapest phase that can answer its unresolved expressions: **Folded** (the value harness, no jsdom), **Simulated** (the skeleton, then the Simulation Realm, ADR 0027), or **Static** (skeleton only; the client corrects omissions). Static is numbered below Folded deliberately: it resolves *less*. It is routed, not a failed proof's accident. The tier list lives in [ARCHITECTURE.md "Server Evaluation Tiers"](../ARCHITECTURE.md#server-evaluation-tiers); sub-design numbers are stable — other ADRs cite them.

1. **Unresolvability is per expression; tier is a routing decision about a component.** An expression is *unresolvable* when no server phase can produce its value. Either its reads route through realm-stubbed APIs, or its input is not a server fact (the wall clock, the RNG, a runtime-default locale). The stub-posture table, `server/compiler/sim/patch-table.ts`, is the authority; a newly supported capability re-routes automatically. Unresolvable expressions are omitted in **every** tier. The build's jsdom would only bake the build machine's `Date.now()` into served HTML permanently; blank is more honest than confidently stale ([ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s3). Folded only on proof — **any doubt routes downward**: a false Simulated costs ~1.1 ms; a false Folded ships wrong HTML. The classifier is the fold analysis (evaluability plus harvest) inverted.

2. **Static classification; no runtime fallback.** A render-time fallback could only fire where the classifier is unsound. The fix is the classifier.

3. **Composition contaminates on reads, not on containment.** A parent that merely embeds a Simulated child stays in its tier and splices the child's rendered markup. Contamination requires the parent to *read* the child — a `first()` on a compose site or a `truc:pass` into it. It is computed as a compose-graph fixpoint.

4. **One emit path, one skeleton, a tier flag.** Every component emits a server render module; the skeleton is the realm's input. For Simulated and Static, the flag drops the setup re-declaration the markup does not depend on, transitively. It drops by dependency, not layer (a folded signal splices into the markup). Folded keeps it in full. **The emitted markup is byte-identical across tiers** — routing down never changes what a no-JS reader sees.

5. **Diagnostic reclassification.** The server-evaluation guards become routing signals: no harvestable render site, non-severe no-server-renderable-value, the server-evaluation setup-shape members, and a setup const reading a `first()` ref. Two setup-shape members keep their own codes: conditional-signal-constructor (an ADR 0024 s12 format rule) and deferred-collector (a client-side bug). The severe no-server-renderable-value guard survives per expression: a `none` site on a submittable control is a bug in any tier. The Parser double-render warning is untouched. The impure-ambient refusal becomes unresolvability (sub-design 1), because the answer only exists in the browser. The `Intl` rule splits by locale provenance: server-known folds, DOM-read is realm-answerable, runtime-default is unresolvable. [ADR 0030](0030-internationalization-as-build-time-server-data.md) makes server-known the norm. Per-code rulings live in the diagnostics catalog (`server/compiler/diagnostics.ts`).

6. **Routing signals are a tier census, not warnings.** The build report gains a **tier census**: per component, its tier and routed reason. The compile-warning baseline keeps its **zero target**. The census is its own regression signal: a silent Folded → Simulated move is a build-cost regression. One reason is **unavailable substrate**. With jsdom absent (an optional peer, [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md)), a Simulated-routed component routes Static and the census records it — never a build failure.

7. **Two mechanisms, kept honest by an equivalence audit.** Tiering reinstates ADR 0027's named hazard — two mechanisms answering one question — with a test. CI renders every **Folded**-tier component through the realm and pins the recorded connect diff; a changed diff is a review trigger naming the component. Realm-vs-phase-1 byte identity is structurally void (sub-design 4's invariant stands): Folded-tier signals seed from a DOM harvest, deriving the realm's state from the served bytes. The audit guards the **server-to-client handoff**: client connect-time writes that overwrite or remove server-rendered state, a silent failure class. It is the Folded tier's only standing check there. It costs a full CI pass, paid by CI, not the build.

8. **Scope: SSG now; per-request anticipated, not designed.** No per-request SSR runtime is committed; the compiler and driver stay build-time tooling. What travels off SSG in 3.0 is **emitted templates** (ADR 0034): folds independent of server args, with server args as holes. The **Simulated tier is SSG-scoped for 3.x**, because a value a program produced by running cannot be left as a hole. CMS consumers get a Static partial for such components ([ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md)). A per-request path stays unblocked.

## Alternatives Considered

- **Two tiers (fold fails → simulate)**: routes the largest cost driver into a realm that returns zeros and drops its internals-only output — the outcome tiering prevents.
- **Unconditional simulation (ADR 0027 as written)**: correct, but pays in full for components that need nothing or can receive nothing, and forecloses per-request.
- **Fix the driver instead**: layout is unfixable at jsdom; sub-design 1 re-routes when a capability lands.
- **Containment-based contamination**: with page chrome in the compose graph it collapses to "almost everything is Simulated".
- **Routing impure-ambient to the realm, or at component granularity**: the realm ships a stale value for the page's life; component granularity discards what the realm could resolve — unresolvability is per expression.
- **Retiring the setup-shape and setup-const-ref guards outright**: two setup-shape members are a format rule and a client-side bug check; nothing here supersedes them.
- **Routing guards as warnings**: a routing decision in an author-fixable channel destroys the zero-target signal; the census is the fitting channel.

## Consequences

**Good:**

- The build stops paying for answers it cannot use — the largest single cost reduction available.
- The warning baseline recovers zero, and build cost gets its own regression signal.
- Simulation semantics are untouched where they apply; stub posture and tier assignment are the same data.

**Bad / accepted tradeoffs:**

- Serialization-time suppression must sequence after the fixed-point gate's second connect — wrong ordering yields spurious gate failures.
- Two mechanisms coexist permanently; the audit is a standing CI obligation, unconditional pass included.
- The Static tier is a served-HTML quality regression where it lands — "the best answer some phase can compute" is weaker than the promise.
- The classifier is sound, not complete: some components pay simulation they did not need — the asymmetry's deliberate cost.
- The `tier` result is product surface — it decides build cost and ships wrong HTML if wrong in the Folded direction — so it needs golden coverage.

## Related

- Requirements §1, §5, §7 — the compiler and driver stay build-time tooling; architecture: [Server Evaluation Tiers](../ARCHITECTURE.md#server-evaluation-tiers), [LE_TRUC_COMPILER.md](../server/compiler/LE_TRUC_COMPILER.md)
- Amends: [ADR 0027](0027-server-simulation.md) (s1, s7: simulation for the Simulated tier only; the evaluability gate repurposed, not retired); [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (sub-designs 2 and 3)
- Related: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md), [ADR 0026](0026-aria-reflection-via-elementinternals-and-bindaria.md), [ADR 0028](0028-tiered-error-surfacing.md), [ADR 0030](0030-internationalization-as-build-time-server-data.md), [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md), [ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md)
