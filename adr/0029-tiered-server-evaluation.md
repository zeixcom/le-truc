# ADR 0029: Tiered Server Evaluation — Route Each Component to the Cheapest Phase That Can Answer

## Status

✅ Accepted

## Context

ADR [0027](0027-server-simulation.md) decided that the server renders initial HTML by executing the generated client module against jsdom, and that the evaluability gate, the fold routes, and eventually the generated render functions all retire in favor of that one mechanism. That decision was made on correctness grounds and it holds on correctness grounds: simulation answers questions the fold grammar structurally cannot, and one executing mechanism cannot drift against itself.

What ADR 0027 did not have when it was written is cost data at corpus scale. Stage 1 landed, `sim/` runs over the whole corpus in tests, and the measurement is: **pre-play averages ~1.1 ms per component occurrence**, and a full SSG pass over the docs site's ~3,700 component occurrences adds ~3.9 s to the build. That is tolerable for a static build. It is not a cost that should be paid *unconditionally*, and it is not a cost anyone would want to pay per request if Le Truc's build-time compilation ever grows a per-request sibling.

Two further facts, both measured against the migrated corpus rather than assumed, decide the shape of the fix:

1. **Most components genuinely need something phase 1 cannot supply.** Under the strictest possible phase-1 definition — server args and template lowering only — exactly 2 of 22 migrated components qualify. Relaxing to the two things phase 1 already does soundly today (signal initializers closing over server args, evaluated in `runtime.ts`'s value harness; `host.<prop>` reads of Parser-exposed props, whose root attribute the server itself rendered) brings that to roughly 6 of 22. Fifteen of 22 use `first()`, which is irreducibly a DOM question. So a cheap path exists, but it is the minority path.

2. **A significant set of components cannot be answered by phase 2 either, and they are the expensive ones.** `module-scrollarea` — 2,091 occurrences, the single largest cost driver in the corpus — reads `host.scrollLeft`/`scrollTop`/`scrollWidth`/`offsetWidth`/`scrollHeight`/`offsetHeight` and emits *exclusively* through `bindState(internals, …)`. ADR 0027's own accepted tradeoffs make both of those unanswerable by design: jsdom layout reads return silent zeros, and sub-design 2 normalizes `attachInternals()` to throw so every component takes the library's graceful-degradation branch, which means internals-only output "renders as nothing in the served HTML — permanently." Simulating `module-scrollarea` therefore costs ~2.3 s of build time to compute nothing. It is not alone: `card-mediaqueries` (`matchMedia`), `form-colorgraph` (`getBoundingClientRect`), `form-textbox` and `form-spinbutton` (`internals.states`), and the unmigrated `module-carousel`/`ticker`/`splitview`/`dialog`/`section-menu` are all in the same position.

A binary "phase 1 cannot resolve it, therefore simulate it" classifier gets the biggest cost driver in the corpus exactly wrong.

## Decision

**Server evaluation is tiered.** Each component is statically routed, at compile time, to the cheapest phase that can actually answer its unresolved expressions. There are three tiers:

| Tier | Name | Mechanism | Phase 1 total? | Realm can answer the rest? |
| --- | --- | --- | --- | --- |
| **1** | *Folded* | Template lowering + `runtime.ts` value harness. No jsdom. | yes | — |
| **2** | *Simulated* | Phase-1 skeleton, then pre-play in the jsdom realm (ADR 0027). | no | yes |
| **0** | *Static* | Phase-1 skeleton only; unresolved expressions are omitted and the client corrects at connect. | no | no |

Cutting across the tiers is a second, expression-level fact — some expressions have no server answer in *any* tier, and are omitted everywhere (sub-design 1).

Tier 0 is numbered below tier 1 deliberately: it resolves *less* than tier 1, not more. It is the honest name for what today's compiler already does when the fold gives up — except that today it is an accident of a failed proof, and here it is a routed decision with a recorded reason.

### 1. Unresolvability is a property of an expression; tier is a routing decision about a component

These are two different facts and conflating them produces wrong answers in both directions, so they are defined separately.

**An expression is *unresolvable* when no server phase can produce its value.** Two limbs:

- **(a) The API is stubbed.** Every read routes through something `sim/patch-table.ts` declares the realm cannot answer: layout geometry (jsdom has no layout engine), `attachInternals()` (normalized to throw), the absent-API stubs (`ResizeObserver`, `matchMedia`, `IntersectionObserver`, `requestAnimationFrame`), the closed network globals.
- **(b) The input is not a server-side fact at all.** The value is a function of *the moment the page is viewed* or of the build machine's own ambient state rather than of anything the server knows: the wall clock (`Date.now()`, `new Date()`), the RNG (`Math.random()`), a locale that falls back to the runtime default. This is `evaluability.ts`'s existing `containsImpureAmbient` set, and its judgment was always right — see sub-design 7.

**An unresolvable expression is omitted in every tier**, tier 2 included. The realm must not fold one: executing `Date.now()` in the build's jsdom does not approximate the browser's answer, it bakes the build machine's clock into the served HTML permanently. `evaluability.ts`'s own comment says exactly this. Blank is more honest than confidently stale, and ADR 0024 sub-design 3's mitigation for the no-JS case is authored static markup — the author supplies the default, the compiler does not guess.

**A component's tier is then a routing decision about which mechanism to run**, and the predicate is not "can phase 1 resolve everything" but **"is phase 2 worth running":**

| | phase 1 resolves everything | something unresolved, realm can answer it | something unresolved, all of it unresolvable |
| --- | --- | --- | --- |
| **tier** | 1 | 2 | 0 |

- The **first test** reuses `evaluability.ts` and `analysis/harvest.ts` unchanged in mechanism and inverted in polarity. Every site that today triggers a refusal — `TSRX004` (no harvestable render site), `TSRX034` (no server-renderable value for a semantically-loaded attribute), the server-evaluation members of `TSRX013`, `TSRX043` (a setup const reading a `first()` ref) — is a site phase 1 cannot resolve, and that is now a *routing signal*, not an author error.
- The **second test** is the unresolvability property above. Tier 0 is the degenerate case: every unresolved expression is unresolvable, so no mechanism needs to run at all.

Making the stub table load-bearing for limb (a) has a second benefit: when the driver later gains a real capability (ADR 0026's `ElementInternals` shim, say), removing that row from the patch table automatically re-routes the affected expressions from unresolvable to realm-answerable, and their components from tier 0 to tier 2. The stub posture and the tier assignment cannot drift, because they are the same data. Limb (b) has no such escape hatch by construction — no driver capability can tell the build machine what time it will be when the page is read.

**Why the two facts must stay separate: `module-ticker`.** It calls `Math.random()` and is also heavily `first()`-based (template, table, tbody, toggle button). Classifying the *component* as tier 0 would omit everything the realm could have resolved; classifying it as tier 2 and letting the realm run would bake a random walk's seed into the page. It is tier 2 **with one suppressed expression** — which only exists as an outcome because unresolvability is per-expression.

**Implementation constraint this imposes on tier 2.** The generated client module is the shipped artifact, so the realm cannot decline to install a binding. Suppression is therefore a serialization-time step: the compiler records each unresolvable expression's target site, and the driver reverts those sites after the connect passes and before serializing. It must run *after* the fixed-point gate's second connect (ADR 0027 sub-design 8), not between the passes, or the gate compares a suppressed tree against an unsuppressed one and reports a spurious failure.

### 2. Classification is conservative and static; there is no runtime fallback

Tiering is decided at compile time, from the same analysis the compiler already runs. There is no phase-1-to-phase-2 fallback at render time, and none is needed: a fallback would mean phase 1 discovering at render time that it cannot answer, which is exactly what the static analysis already proves ahead of time.

The soundness posture is asymmetric and stated explicitly, because the two failure directions are not comparable: **a component is tier 1 only when phase 1 is provably total; any doubt routes downward.** A false tier-2 costs ~1.1 ms. A false tier-1 ships wrong HTML with no diagnostic. The classifier is therefore sound, not complete, and the completeness gap is a build-time cost, never a correctness one.

### 3. Composition contaminates on reads, not on containment

A tier-1 or tier-0 parent that merely *embeds* a tier-2 child stays in its own tier and splices the child's already-rendered markup — the compose graph renders children before parents (ADR 0027 sub-design 2), so the child's string exists by the time the parent needs it.

Contamination happens only when the parent **reads** the child: a `first()` addressing a compose site, or a `truc:pass={{ }}` into it. Only then does phase 1 lack an answer that the child's markup alone supplies. Containment-based contamination was rejected: with page-chrome components in the compose graph (`module-scrollarea` at 2,091 occurrences, `module-codeblock` at 299), a transitive-containment rule drags nearly the whole corpus into the realm and reproduces the unconditional cost this ADR exists to avoid.

The read-based rule is a fixpoint over the compose graph, computed in the registry-aware second pass where `analysis/compose-refs.ts` already resolves compose-site references.

### 4. One emit path, one skeleton, a tier flag

`emit-server.ts` keeps emitting a render module for every component, in every tier. The realm needs phase-1 markup to parse in the first place (`sim/realm.ts` parses the SSR'd markup before replaying definitions), so the skeleton is not an alternative to simulation — it is its input. Tier-1 components' emit path is unchanged.

What the tier flag changes is one thing: **a tier-2 or tier-0 module does not re-declare `@{ }` setup verbatim.** The verbatim re-declaration exists so the value harness can compute signal initial values, and it is exactly the construct that `TSRX013` and `TSRX043` were invented to protect. A tier-2 module emits the static-plus-server-arg skeleton and leaves the rest to the realm; a tier-0 module emits the same skeleton and leaves the rest to the client. Only tier 1 re-declares setup, and by construction a component that re-declares setup is one whose setup the harness can evaluate totally.

This is why those diagnostics can stop being errors without anything going unguarded: the shape they refused is now the shape that routes away from the harness that could not run it.

### 5. Diagnostic reclassification

| Code | Today | Under tiering |
| --- | --- | --- |
| `TSRX004` (no harvestable site) | error | **Tier-2 routing signal.** Leaves the diagnostic channel entirely. |
| `TSRX034` (no server-renderable value), non-severe | warning | **Routing signal.** Leaves the diagnostic channel. |
| `TSRX034`, **severe** (`disabled`/`checked` on a real submittable control) | error | **Survives, scoped to tier 0.** On tiers 1 and 2 the value is resolved and the diagnostic is noise. On tier 0 nothing resolves it, and its own copy is right that a submittable control rendering the wrong `disabled`/`checked` is a correctness bug, not a flash. Re-grounded in the classifier rather than in the retired fold. |
| `TSRX013` → `clientOnlySetupConst`, `clientOnlySignalCompute` | error | **Tier-2 routing signals.** Both refuse a setup the value harness cannot run; tier 2 runs it for real, in jsdom, where `host` and `internals` resolve. |
| `TSRX013` → `conditionalSignalConstructor` | error | **Unchanged, and gets its own code.** It enforces ADR 0024 sub-design 12's format rule (a signal is a single unconditional call to a recognized constructor, so harvest planning has one shape to plan for). Nothing in tiering supersedes that rule. |
| `TSRX013` → `deferredCollectorCall` | error | **Unchanged, and gets its own code.** It is a *client-side* bug — `NoActiveCollectorError` at connect, contained per ADR [0028](0028-tiered-error-surfacing.md), effect silently never activates. It is tier-independent and retiring it would delete a real check. |
| `TSRX043` (setup const reads a ref) | error | **Tier-2 routing signal.** |
| `TSRX039` (Parser-prop double render) | warning | **Unchanged.** A data-ownership rule (which channel owns a value), not a fold-provability rule. Tiering does not answer it. |
| `TSRX005` | already dissolved (LT-153) | unaffected. |

**`TSRX013` must be split before any of it retires.** Four unrelated factories currently share the code, and only two of them are server-evaluation guards. Splitting is a prerequisite of the reclassification, not a follow-up to it.

**The impure-ambient refusal is not on this table, because it does not become a routing signal.** It becomes the unresolvability property of sub-design 1 limb (b): the expression is omitted in whatever tier its component lands in, and no diagnostic is raised. This is the case that most clearly stops being an author error — an author writing `Date.now()` in a thunk has not made a mistake, they have written something whose answer only exists in the browser.

LT-142's `Intl` fold rule splits along the same seam, and the split is the useful part. An `Intl` call whose locale resolves to a **server-known value** (a literal, a server arg) is resolvable and keeps a component tier-1-eligible. One whose locale is read from the **DOM** (`getLocale(el)`, `host.lang`) is resolvable *by the realm* — a tier-2 routing signal, not unresolvable, because the realm executes that read against a real simulated element. Only a locale falling back to the **runtime default** is unresolvable under limb (b), since that default is the build machine's own setting. `basic-pluralize` is the corpus anchor for the middle case and stays tier 2. **[Updated by [ADR 0030](0030-internationalization-as-build-time-server-data.md):** once locale arrives as build-time server data through the reserved `i18n` parameter, the locale is server-known by construction, so `Intl` folds and `basic-pluralize` becomes tier-1 eligible — its six standing `TSRX034` warnings dissolve. Limb (b)'s runtime-default-locale case then stops firing for compiled components entirely; it survives only for a component that reads a locale from neither the record nor the DOM.**

One over-refusal to revisit while implementing, flagged rather than decided here: `evaluability.ts` treats `Date` as unconditionally impure, but `new Date(year, month, day)` over parsed server args (the `basic-blogmeta` shape, and LT-095's dependency) reads no viewing-moment fact. Limb (b)'s criterion — *is the input the viewing moment* — would admit it. The caveat is that the local-timezone constructor and formatter both read the build machine's timezone, so the round-trip is stable only if both ends agree. **[Resolved by [ADR 0030](0030-internationalization-as-build-time-server-data.md) s2:** the reserved `i18n` record supplies an explicit `timeZone`, which removes the build-machine reading from the formatter; for a date-only value the robust form is `Date.UTC(y, m - 1, d)` formatted with `timeZone: 'UTC'`, which reads no ambient state at all and never shifts the day. `basic-blogmeta` then folds to tier 1.]**

### 6. Routing signals are a tier census, not warnings

The diagnostics leaving the channel do not become quieter warnings; they become a **tier census** in the build report: per component, its tier and the reason it was routed there. This is the same channel LT-163 built for realm diagnostics (`sim/report.ts`), carrying a second kind of record.

The consequence for the regression signal matters more than the reclassification itself: **the compile-warning baseline's target stays zero.** It was never really a claim about tiering; it was a claim about author-fixable problems, and once routing signals stop being warnings, the remaining warnings (`TSRX039` and its family) are all genuinely author-fixable again. The tier census is a separate, non-zero, expected-to-grow record with its own regression story — a component silently moving from tier 1 to tier 2 is a build-cost regression worth seeing, and it is now visible without pretending it is a warning.

This supersedes the framing that the baseline's target "is no longer zero." It is zero; the eight standing warnings' successors are simply not warnings.

### 7. Two mechanisms, kept honest by an equivalence audit

ADR 0027 rejected retaining the determinism gate alongside simulation, on the grounds that *"two mechanisms answering the same question is exactly the hazard the original gate's own design existed to prevent."* Tiering reinstates two mechanisms — the value harness and the realm — differing per component. That objection is not dismissed here; it is answered with a test rather than an argument.

**Rule: CI runs phase 2 over tier-1 components as well and requires byte-identical output to their phase-1 render.** At ~1.1 ms per occurrence the whole corpus is ~4 s, which is affordable once per CI run and is not paid by the build. A divergence is a build error against that component, and it means either the classifier admitted something it should not have (a false tier-1) or the two mechanisms disagree on a shape that needs reconciling.

The audit had one known disagreement, and following it to its conclusion is what produced sub-design 1's expression-level framing: `evaluability.ts`'s `IMPURE_AMBIENT_ROOTS` refuses `Date.now()`, while ADR 0027 sub-design 6 deliberately folds it to the build machine's answer. The instructive part is that **neither mechanism can actually resolve it** — tier 1 refuses, tier 2 approximates with a value that is not an approximation at all but a stale reading, cached into the served HTML for the life of the page. Making them agree by picking one would have meant blessing the wrong answer.

So the disagreement is not resolved, it is **dissolved**: impure-ambient expressions are unresolvable in every tier and are omitted in every tier, and the client tells the truth at connect. The determinism gate ADR 0027 §6 retired had the right *judgment* (this has no server answer) and the wrong *response* (refuse to compile). That gate was written when there was no third option — the realm's answer or the silent-empty-render class — and tier 0 is the third option it lacked.

### 8. Scope: SSG now, per-request SSR anticipated but not designed

The ~1.1 ms / ~3.9 s figures are build-time SSG numbers. **This ADR commits to no per-request SSR runtime**; ADR 0024 sub-design 7 stands unchanged — the compiler and the driver are build-time tooling and jsdom never ships to clients.

What the tiering *does* do is make a future per-request path possible without re-architecting: tier 1 and tier 0 are already per-request-cheap (string concatenation, no realm), so a per-request server would pay the realm cost only for tier-2 components, which the classifier has already identified and which LT-166's `(component, markup)` memoization already caches within a process. A per-request path would need a server-scoped analogue of that cache with an eviction policy, plus a decision about realm lifetime across requests — both deliberately left undesigned here, because designing a cache for a workload that does not exist yet would fix the wrong shape. Recorded as anticipated, not decided.

## Alternatives Considered

- **Two tiers (phase 1 fails → simulate), as originally sketched**: rejected on measurement. It routes `module-scrollarea` — the corpus's single biggest cost driver at 2,091 occurrences and ~2.3 s — into a realm that returns zeros for every layout read and drops its entire `bindState(internals, …)` output channel on the floor. Paying the full simulation cost to compute nothing is the specific outcome tiering exists to prevent.
- **Keep ADR 0027's unconditional simulation for every component**: rejected. Correct, and the honest baseline this ADR is measured against, but it pays ~3.9 s per build for an answer that ~27% of components do not need and that another substantial fraction cannot receive. It also forecloses a per-request path entirely rather than merely deferring it.
- **Fix the driver instead of routing around it** — add real `ElementInternals` and layout support so tier 2 can answer the tier-0 cases: rejected *as the answer to this question*, not rejected in principle. Layout is out of scope for jsdom by construction (there is no layout engine), so the geometry half is not fixable at this substrate; internals support is already tracked as deferred by ADR 0027 sub-design 5 and ADR 0026. Sub-design 1 is built so that landing an internals shim later re-routes the affected components automatically, by deleting a patch-table row.
- **Containment-based composition contamination** (any parent of a tier-2 descendant is tier 2): rejected — with page chrome in the compose graph it collapses to "almost everything is tier 2," which is the unconditional model with extra steps.
- **Routing impure-ambient reads to tier 2 so the realm is their single producer**: rejected, and it was this ADR's own first answer. It eliminates the mechanism disagreement, but by electing the mechanism that ships a confidently wrong value — an SSG'd `Date.now()` is not a flash the client corrects, it is a plausible-looking stale timestamp served for the life of the page. `evaluability.ts`'s own comment already made this argument ("bakes the BUILD MACHINE's reading into the page permanently") and it was right.
- **Classifying impure-ambient at component granularity** (a component reading `Date.now()` is wholly tier 0): rejected on the corpus. `module-ticker` calls `Math.random()` and is heavily `first()`-based; component-level tier 0 discards everything the realm could resolve for it. Unresolvability has to be per-expression for the rule to be correct at all.
- **A runtime fallback from phase 1 to phase 2**: rejected — the fallback condition is exactly what the static analysis already decides, so the fallback could only ever fire where the classifier was unsound, and the correct response to an unsound classifier is to fix it, not to paper over it at render time.
- **Retiring `TSRX013` and `TSRX043` outright**, as first sketched: rejected on inspection. `TSRX013` is four unrelated factories sharing a code; `deferredCollectorCall` is a client-side `NoActiveCollectorError` bug and `conditionalSignalConstructor` is an ADR 0024 sub-design 12 format rule. Neither is a server-evaluation guard, and neither is superseded by anything here.
- **Keeping `TSRX004`/`TSRX034` as warnings with reworded copy and a non-zero baseline target**: rejected — it keeps a routing decision in a channel meant for author-fixable problems, and it costs the zero-target regression signal LT-146/LT-168 built for no gain. A tier census carries the same information in the channel that fits it.
- **Deleting `evaluability.ts`/`harvest.ts` at ADR 0027 stage 3** (the prior plan): superseded. The analysis those modules perform *is* the classifier; deleting them would remove the mechanism this decision depends on.

## Consequences

**Good:**

- The build stops paying for answers it cannot use. Removing the tier-0 set — `module-scrollarea` alone is ~2.3 s of the measured ~3.9 s — is the largest single cost reduction available, and it comes from routing rather than from optimization.
- ADR 0027's correctness argument is preserved exactly where it applies. Tier 2 is unchanged simulation, including the fixed-point gate and the hermetic quiescence window; nothing about the realm's semantics is weakened to make it cheaper.
- The classifier is the analysis that already exists, inverted. `evaluability.ts` and `analysis/harvest.ts` stop being a gate that refuses and become a router that decides — same code, same proofs, no new grammar to maintain per idiom.
- The stub posture and the tier assignment are the same data, so a driver capability landing later re-routes components automatically instead of requiring a second bookkeeping pass.
- The compile-warning baseline recovers a zero target, and the tier census gives build cost its own regression signal for the first time — a component drifting from tier 1 to tier 2 is now visible.
- Author-facing diagnostics get quieter and more honest at once: the largest family of standing errors was never telling authors about a mistake, and now says so by not being an error. The impure-ambient case is the clearest instance — the server stops both refusing and guessing, and simply lets the client answer a question only the client can answer.
- A per-request SSR path stops being architecturally blocked, without anything being committed or designed prematurely.

**Bad / accepted tradeoffs:**

- Tier 2 needs a **serialization-time suppression step** for unresolvable expressions, sequenced after the fixed-point gate's second connect pass. That is real machinery the two-tier sketch did not need, and getting its ordering wrong produces spurious fixed-point failures rather than obviously wrong output.
- **Two evaluation mechanisms coexist permanently**, which is precisely the hazard ADR 0027 named. The equivalence audit (sub-design 7) is the mitigation and it is load-bearing: if it is ever disabled or allowed to go red, the drift class ADR 0027 eliminated comes straight back. It is a CI obligation, not a nice-to-have.
- The audit costs a full unconditional simulation pass in CI — the very ~4 s the build no longer pays. That is the deal: the cost moves from every build to every CI run, and buys the confidence that makes two mechanisms tolerable.
- Tier 0 is a real regression in served-HTML quality relative to unconditional simulation, for the components in it. ADR 0027's "every thunk renders its best server answer" becomes "every thunk renders its best server answer *that some phase can compute*." For `module-scrollarea` the practical difference is nil (the realm's answer was zeros), but the general statement is weaker and a future driver capability is what narrows it.
- The classifier is sound but not complete, so some components pay simulation cost they did not strictly need. Deliberate — the asymmetry is chosen, and the audit is what would reveal an over-tight tier-1 rule, not an over-loose one.
- Tier 1 is the minority path: roughly 6 of 22 migrated components. The cheap path exists but does not dominate, so tiering's payoff comes mostly from tier 0, not tier 1 — a different shape than the original framing assumed, and worth remembering before investing in widening tier 1.
- `TSRX013` must be split into three codes before any part of it retires, which is churn in a code family authors and fixtures already reference. The `tech-writer` error-message lifecycle covers the propagation.
- One more compile-time analysis result (`tier`) becomes product surface: it decides build cost, it appears in the build report, and a wrong answer in the tier-1 direction ships wrong HTML. It needs golden coverage like any other rewrite rule.

## Related

- Requirements: [§1 The core insight](../REQUIREMENTS.md#the-core-insight), [§5 Technical Constraints](../REQUIREMENTS.md#5-technical-constraints), [§7 Out of Scope](../REQUIREMENTS.md#7-out-of-scope) (unchanged — the compiler and driver stay build-time tooling)
- Architecture: [Server Evaluation Tiers](../ARCHITECTURE.md#server-evaluation-tiers)
- Compiler: [`server/tsrx/LE_TRUC_COMPILER.md` § 5](../server/tsrx/LE_TRUC_COMPILER.md)
- Amends: [ADR 0027](0027-server-simulation.md) (sub-designs 1 and 7 — the evaluability gate is repurposed rather than retired, and simulation applies to tier 2 rather than to every component); [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (sub-designs 2 and 3 — initial HTML is rendered by the tier's mechanism, not unconditionally by simulation). ADR 0024 sub-design 1 (template lowering) and sub-design 7 (library boundary) are untouched.
- Related ADRs: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (connect-time seeding — the client still corrects, in every tier), [ADR 0026](0026-aria-reflection-via-elementinternals-and-bindaria.md) (why `internals` is a tier-0 cause today), [ADR 0028](0028-tiered-error-surfacing.md) (the diagnostic channel/tier discipline this reclassification follows)
