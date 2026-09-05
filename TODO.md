# TODO

## Sequencing (architect, 2026-09-04; tiered server evaluation supersedes the stage-3 fold-retirement plan)

**[LANDED, 2026-09-04 — LT-171 delivered [ADR 0029](adr/0029-tiered-server-evaluation.md).** The
entry below is the owner's articulated direction as filed; read it for the argument and the cost
data, but read ADR 0029 for the decision. **Three things in it changed shape under scrutiny and
the ADR overrides them:** (1) the model is THREE tiers, not two — `module-scrollarea` (2,091
occurrences, ~2.3 s) is unanswerable by phase 2 as well, so the classifier asks "is simulation
worth running", with `sim/patch-table.ts` as its second conjunct; (2) TSRX013 does NOT retire
outright — it is four factories sharing a code and two of them (`deferredCollectorCall`,
`conditionalSignalConstructor`) are not server-evaluation guards at all; (3) the compile-warning
baseline's target STAYS ZERO — routing signals leave the warning channel for a tier census, which
preserves LT-146/LT-168's regression signal instead of abandoning it. The bracketed claim below
that "the target is therefore NOT zero" is superseded on that basis.]**

**Waves 1–3 — CLOSED.** Wave 1 (the addressing surface) and wave 2 (data-account debt on the
migrated corpus) closed 2026-08-30. Wave 3 (diagnostic honesty) closed 2026-09-01.

**ADR 0027 wave — Server Simulation stage 1. CLOSED, ADRs 0024/0027 accepted 2026-09-03/04.**
LT-154 (driver), LT-163 (build-report channel), LT-164 (goldens + two-order/double-connect
invariants), LT-166 (memoization, landed early by owner request), LT-167 (polish), and LT-168
(compile-warning baseline reconciled to a tool-counted 8 unique) all landed and reviewed. Full
history compacted to the archive below.

**Gate wave — CLOSED except LT-147/148/170.** LT-143/LT-133/LT-144/LT-145/LT-146 all landed,
reviewed, and are compacted to the archive below. LT-146 in particular ended up simpler than its
own task text assumed — see its archive line — which is directly relevant to the new decision
below: a `first()`-bound ref read handed straight to `expose()` needs neither a compiler proof
nor a DOM-duplicating workaround once something downstream actually *executes* the setup code
against a real document. That observation is what LT-171 now has to take architecture-wide.

**NEW DECISION (2026-09-04): commit to phase-1/phase-2 tiering as the SSR mechanism, superseding
LT-153 decision 4's "delete evaluability.ts at stage 3" and decision 2's "zero is the compile
target."** This is the owner's articulated direction, not yet formalized in either ADR — that
formalization is LT-171, filed first, below.

**The shape of it.** Le Truc's SSR is partial application done entirely SERVER-side, never
shipped over the network the way RSC ships serialized data/promises/functions/a rendering
engine to reconstruct a blueprint. Two phases:

1. **Phase 1 — render the JSX/TSRX blueprint to static HTML.** Plain string concatenation from
   server args. This is what `emit-server.ts` already does and continues to do; it is not going
   away (ADR 0024 sub-design 1, template lowering, is untouched).
2. **Phase 2 — pre-play DOM hydration on the server.** Run the signal graph — DOM harvesting,
   `expose()`, `watch()`, event wiring, everything the browser would do at connect — for real,
   once, against a simulated document (jsdom), and serialize whatever DOM state falls out. This
   is what `server/tsrx/sim/` already does, today, as a TEST-ONLY verification harness (ADR
   0027's "nothing consumes the artifacts yet"). The new decision promotes it to the actual
   phase-2 SSR mechanism for the components that need it.

**Why not every component runs phase 2.** Measured cost: pre-play averages ~1.1 ms/component.
A full SSG pass over the docs site's ~3,700 component occurrences would add ~4 s to the build —
tolerable for SSG, not for SSR (per-request). So phase 2 must be selective: a component that is
fully resolved by phase 1 alone (no DOM ref, no signal data harvested from another component —
"full application" in phase 1) skips jsdom entirely and stays on the cheap path. A component
that phase 1 cannot fully resolve ("partial application" — DOM harvest, cross-component signal
dependency) is routed through phase 2.

**What this does to the existing diagnostic family — this is the load-bearing insight LT-171
has to work out precisely, not just restate:**
- **TSRX004** (signal never rendered / can't harvest) and **TSRX034** (hidden has no
  server-renderable initial value) **stop being errors to fix and become the classifier
  itself.** The exact static analysis that used to justify "refuse to compile" now justifies
  "route this component through phase 2." A "no" answer from the analysis doesn't mean the
  author did something wrong — it means the component is (correctly) The Simulated tier. **The
  compile-warning baseline's target is therefore NOT zero** — LT-153 decision 2 and every
  "zero-warning corpus" acceptance line inherited from it (LT-147/LT-148 included) is now the
  wrong framing and needs correcting once LT-171 lands, not before (the correction is
  architecture, not a search-and-replace).
- **TSRX013** (conditional signal constructor) and **TSRX043** (ref read in a setup const)
  **retire outright, for every component, regardless of tier** — their entire reason for
  existing was protecting a constrained, no-DOM re-execution of `component.setup`. That
  execution mode disappears whichever way a component is tiered: phase-1-only components don't
  re-run setup server-side at all under the new model, and phase-2 components run it for real,
  in jsdom, where a ref genuinely resolves. There is no tier left where either restriction is
  still protecting something real.
- **TSRX039** (duplicated channel) is untouched either way — it's a data-ownership rule (which
  channel owns a value), not a fold-provability rule, and tiering doesn't answer it.
- **`evaluability.ts`/`harvest.ts` do not get deleted (LT-165's premise is now wrong) — they get
  REPURPOSED** from a pass/fail gate into the tier classifier. **LT-165 is superseded by LT-171**
  and retitled below rather than left pointing at a deletion that would remove the very
  mechanism the new plan depends on.
- `emit-server.ts` changes shape for Simulated-tier components: instead of emitting a second,
  semantically-constrained "server module" that re-declares setup, phase 2 needs to drive the
  *client* factory through the simulation realm to produce the string. What exactly this looks
  like (one emit path with a tier flag? two paths where today there's one?) is undecided —
  LT-171's job, not assumed here.

**What's explicitly still open, not decided by this entry — LT-171 answers these:**
- Is tiering decided purely statically at compile time (reusing the existing analysis as-is), or
  is a runtme fallback from phase 1 to phase 2 ever needed?
- Per-request SSR cost for Simulated-tier components is flagged as "not optimal" but not measured or
  designed around yet — does phase 2 need its own cache/warm-path story beyond LT-166's
  same-build memoization, for a live server rather than a build?
- Whether this is an amendment to ADR 0027 (promoting simulation from verification-only to the
  real phase-2 mechanism) or a new ADR, and what ADR 0024 needs to say differently about the
  compiler's two emit paths.

**i18n, added 2026-09-04 — [ADR 0030](adr/0030-internationalization-as-build-time-server-data.md).**
A multilingual docs site is now planned, and i18n was entirely unaddressed (REQUIREMENTS.md
neither required nor excluded it). Locale and translations are build-time SERVER data reaching
components through a compiler-supplied reserved `i18n` parameter — not the context protocol,
whose fallback-then-correct shape would flash English into German and leave a no-JS reader on
the wrong language permanently. **Three things worth carrying forward:** (1) it is a tiering
WIN — a build-constant locale folds `Intl`, so i18n components are Folded-tier eligible and
`basic-pluralize`'s six standing TSRX034 warnings dissolve; (2) missing translation keys go to a
translation CENSUS, not the warning channel, because they are not author-fixable and would
restart the non-zero-baseline drift ADR 0029 s6 just removed; (3) LT-172 fixes a live bug the
investigation surfaced — the simulation realm's truncated ancestor chain makes `getLocale()`
resolve `'en'` silently for any component without a `lang` arg. Tasks: LT-172 (independent,
do first), LT-173 (depends on LT-165), LT-175 (cache-impact measurement spike), LT-174 (depends
on both). **Catalog layout** is decided (ADR 0030 s4): source strings inline in the `.tsrx`,
translations as additive per-locale namespaced files (`i18n/de.json`), **no tiering and no
override stack**. **One correction worth carrying:** a build-constant locale does NOT retire
`basic-pluralize`'s client-side toggles — `count` stays reactive, so the category still changes
at runtime and the client can only select among server-rendered strings. What it buys is
per-locale PRUNING of the rendered alternatives (six spans → two on an `en` page).

**The wave order, after this decision:** LT-171 (architecture) blocks nothing already landed,
but should land BEFORE wave 4 commits any more migrations to the old "reduce warnings to zero"
framing, and before LT-165/LT-169 are touched at all (both are now stale in their current
wording — see their entries below). [**Updated 2026-09-04:** LT-171 has landed; LT-165 and
LT-169 are rewritten against ADR 0029 and LT-165 now gates LT-169. Wave 4 is unblocked — and
"reduce warnings to zero" turns out to be the correct framing after all, for the warnings that
remain warnings.]

## Architecture — tiered server evaluation (LANDED: ADR 0029)

- [x] LT-171: Work out phase-1/phase-2 tiering's implications for ADR 0024 and ADR 0027, and
      record the decision. — done ✓
  **Skill:** architect
  **Context:** Owner decision, 2026-09-04 (see the Sequencing section above for the full
  argument and cost data — do not re-derive it, extend it). The verification-only phase of
  server simulation is over; phase-2 pre-play is committed as the real SSR mechanism for
  components phase 1 cannot fully resolve. This task is to turn that into an actual
  architectural decision rather than an implication left implicit:
  1. **Decide the ADR shape:** amend ADR 0027 (promote simulation from verification-only to the
     phase-2 SSR mechanism) vs. a new ADR that supersedes parts of both 0024 and 0027. ADR 0024
     sub-design 1 (template lowering, phase 1) is untouched either way and should say so
     explicitly once this lands, so a future reader doesn't assume the whole compiler pipeline
     moved to simulation.
  2. **Specify the classifier precisely.** `evaluability.ts`/`harvest.ts`'s existing analysis is
     the reused mechanism (confirmed in the Sequencing section), but "component that phase 1
     cannot fully resolve" needs a precise, checkable definition — presumably every currently
     TSRX004/TSRX034-triggering site, but confirm there's no third case (e.g. a component with
     no DOM-dependent site itself but that COMPOSES one that does).
  3. **Decide `emit-server.ts`'s shape for Simulated-tier components** — what it emits instead of
     today's re-declared, DOM-less setup, and whether Folded-tier components' emit path changes at
     all (it shouldn't need to, but confirm).
  4. **Resolve the retirement/reclassification per diagnostic**, and hand the copy work to Tech
     Writer once decided: TSRX013/TSRX043 retire outright (no tier needs them — argued in the
     Sequencing section); TSRX004/TSRX034 stop being errors and become the classifier's positive
     signal (their copy needs to say "this routes to phase 2," not "this is wrong"); TSRX039 is
     unaffected. TSRX005 (already dissolved per LT-153) is unaffected by this task.
  5. **Answer the three open questions from the Sequencing section**: static-only tiering vs. a
     runtime fallback path; per-request SSR cost/caching story for Simulated-tier components (the 1.1
     ms/component, ~4 s/3,700-component figures are a build-time SSG number, not yet an SSR
     one); and whether LT-166's build-scoped memoization needs a server-scoped analogue.
  6. **Reconcile every "zero-warning" acceptance criterion this supersedes** — LT-147/LT-148's
     "the zero-warning baseline from LT-146 holds," LT-153 decision 2, and LT-165's own premise
     — using the append-only correction convention already established in this file (bracket the
     correction in place; do not silently rewrite).
  Acceptance: an ADR (amended or new) records the tiering decision and the diagnostic
  reclassification; LT-165 and LT-169 are rewritten (not just corrected) to match; every
  superseded "zero-warning" acceptance criterion in this file carries a correction; wave 4 does
  not start against the old framing.
  **Delivered, 2026-09-04 — [ADR 0029](adr/0029-tiered-server-evaluation.md), amending 0024
  (s2/s3) and 0027 (s1/s7); ARCHITECTURE.md § Server Evaluation Tiers; TSRX-HOST-PROFILE.md
  § What you write decides your evaluation tier; LE_TRUC_COMPILER.md § 5 rewritten, § 6
  reclassification table, § 8 invariant added.**
  **The model changed shape during the work — two tiers became three, on measurement:**
  1. **A third tier was found, and it carries most of the payoff.** The binary "phase 1 can't
     resolve it → simulate it" classifier routes `module-scrollarea` (2,091 occurrences, ~2.3 s
     of the measured 3.9 s) into a realm that returns ZEROS for its every layout read and drops
     its entire `bindState(internals, …)` output channel — ADR 0027's own stub posture
     guarantees a null answer. So the classifier is a conjunction: the Simulated tier requires phase 1 to
     fail AND the realm to be able to answer, the second conjunct read from
     `sim/patch-table.ts`. The Static tier (static skeleton, client corrects) is the third bucket.
     `card-mediaqueries`, `form-colorgraph`, `form-textbox`, `form-spinbutton` join it.
  2. **The Folded tier is the minority path, measured: ~6 of 22 migrated components.** Under the owner's
     strict baseline (server args + `@tsrx/core` only) it is 2 of 22; the two sound relaxations
     (signal initializers over server args in the value harness; `host.<prop>` reads of
     Parser-exposed props) bring it to ~6. Fifteen of 22 use `first()` and are Simulated-tier by
     construction. Tiering's payoff comes from the Static tier, not the Folded tier — worth remembering before
     anyone invests in widening the Folded tier.
  3. **"TSRX013/TSRX043 retire outright" was wrong as stated.** TSRX013 is FOUR factories
     sharing one code and only two are server-evaluation guards: `deferredCollectorCall` is a
     client-side `NoActiveCollectorError` bug (tier-independent) and `conditionalSignalConstructor`
     enforces ADR 0024 s12's format rule. Both survive and need their own codes; the split is a
     PREREQUISITE of the retirement, not a follow-up.
  4. **TSRX034's severe variant survives, scoped to the Static tier** — its own copy is right that a
     submittable control rendering the wrong `disabled`/`checked` is a correctness bug, and
     the Static tier is the one tier where nothing resolves it.
  5. **The baseline target stays ZERO.** Routing signals leave the diagnostic channel for a tier
     census, so the remaining warnings are all author-fixable again and LT-146/LT-168's
     regression signal survives intact. This is a better answer than the "target is not zero"
     framing the Sequencing section assumed.
  6. **Composition contaminates on READS, not containment** — a parent embedding a Simulated-tier child
     splices its markup and keeps its own tier; only a `first()` on a compose site or a
     `truc:pass` into it contaminates. Containment-based contamination would drag page chrome's
     whole ancestry into the realm.
  7. **A CI equivalence audit is now a standing obligation** (ADR 0029 s7). Tiering reinstates
     the two-mechanism hazard ADR 0027 explicitly rejected; the audit renders every Folded-tier
     component through the realm too and requires byte-identical output. If it goes red or gets
     disabled, the drift class 0027 eliminated comes back.
  8. **`Date.now()` exposed a fourth correction, made by the owner mid-review and folded in.**
     The Folded-tier/Simulated-tier disagreement over impure ambient reads is not a drift bug to resolve by
     electing a mechanism — NEITHER can answer it. The Folded tier refuses; the Simulated tier folds a value that is
     not an approximation but a build-machine reading cached into the served HTML for the life
     of the page. So impure-ambient became an **expression-level** property (unresolvable in
     every tier, omitted in every tier, no diagnostic) rather than a Simulated-tier routing signal. This
     also forced the general split — unresolvability is per-EXPRESSION, tier is per-COMPONENT —
     which `module-ticker` proves is necessary (`Math.random()` inside a heavily `first()`-based
     component: the Simulated tier with one suppressed expression). ADR 0027 s6's determinism gate had the
     right judgment and the wrong response; the Static tier is the third option it lacked.
  9. **Per-request SSR: anticipated, not committed** (owner, 2026-09-04). ADR 0024 s7 stands —
     build-time tooling only, jsdom never ships. LT-166's memoization needs no server-scoped
     analogue yet; designing a cache for a workload that doesn't exist would fix the wrong shape.

## Architecture — ARIA reflection in the simulation realm (ADR 0026, amended 2026-09-04)

- [x] LT-177: Make `bindAria()`/`bindState()` capability-resilient; let the realm keep jsdom's skeletal `ElementInternals`. — reviewed ✓
  **Skill:** le-truc-dev
  **Context:** Owner decision, 2026-09-04, amending [ADR 0026](adr/0026-aria-reflection-via-elementinternals-and-bindaria.md) §2 in place (pointer notes already landed in ADR 0027 s2 and ADR 0029 s1 limb (a), and in `ARCHITECTURE.md` § Server Evaluation Tiers). Polyfilling `ElementInternals` in the realm was REJECTED: a working reflection surface would fire the stale-attribute removal at simulated connect and **strip** `role`/`aria-*` from the served HTML — the opposite of what serialization needs. Ordered scope:
  1. **Remove the forced `attachInternals` throw** from `PROTOTYPE_PATCHES` (`server/tsrx/sim/patch-table.ts:251`) — its own comment records it as "no longer load-bearing for correctness" since LT-150. jsdom's skeletal internals then flows through non-null and populates `internalsHosts` and the declaration-protocol registry at the existing constructor line (ADR 0026 §2 note 1, §3).
  2. **Form association keeps the global degradation** (LT-150's shape check, unchanged, owner decision): an incomplete stub is worse than none for form-associated components — the realm still lands them on the old-Safari branch. Verify LT-150 still detects jsdom's actual skeletal shape with the patch removed; it was built against exactly this substrate.
  3. **`bindAria()` capability tiers** (ADR 0026 §2 as amended): probe the target once at bind time. Full `ARIAMixin` → reflection + stale-attribute removal, unchanged everywhere it works today. No reflection surface → resolve the host via `internalsHosts` and bind the **content attribute** with the same coercion table (boolean → `'true'`/`'false'`, number → decimal, nil/null → `removeAttribute`; the eight element-reference properties have no honest attribute fallback and stay no-ops). Null target → no-op, unchanged. No stale-attribute removal ever fires on the fallback path.
  4. **`bindState()` parity**: a non-null target without a `states` surface is a no-op, not a `TypeError` (extends ADR 0016 §8's null rule).
  5. **Residual, documented, not fixed**: for LT-150-degraded (form-associated) components the context value is `null` and no WeakMap route exists — `bindAria(null, …)` stays a no-op. Zero corpus sites (LT-148's fixtures are the forward guard); the mitigation for one that appears is authored static markup.
  **Channels/tiers:** a capability fallback is not a failure — channel: none, no Surfacing Tier, no diagnostic (the attribute path is a supported channel, not degradation). The LT-150 degradation-warning copy and `bindAria`/`bindState` JSDoc are touched → **Tech Writer reviews the copy** (`tech-writer`'s `workflows/error-message-lifecycle.md`).
  **Coordinate:** LT-165's classifier reads the patch table — when it lands, internals capability is capability rows, not one binary row: ARIA expressions are realm-answerable via this fallback; `internals.states`/form-member reads stay unanswerable. LT-148 lowers root ARIA to `bindAria(internals, …)`; add to its fixtures the serialization pin this task exists for: the served HTML carries the attribute under simulation.
  Acceptance: a root `aria-*` `.tsrx` fixture under simulation serializes WITH the attribute (golden-pinned per substrate); real-browser behavior unchanged (reflection + removal — existing ARIA specs stay green); `bindState` on skeletal internals no-ops; `bun test server` green; per-substrate goldens re-baselined if jsdom output moves.

  **Handoff (le-truc-dev, 2026-09-04).** All five scope items landed.
  1. `PROTOTYPE_PATCHES` is now empty (`server/tsrx/sim/patch-table.ts`). The applier loop, the `PrototypePatch` type and the table entry in `SIM_PATCH_TABLE` all stay — LT-165's classifier reads the table, and the mechanism is what the next capability row plugs into.
  2. Verified, and pinned: `server/tests/tsrx/sim-realm.test.ts` renders a `formAssociated()` component in the realm and asserts the factory sees `internals === null`. Mutation-checked (making `isUsableInternals` unconditionally true fails it) — the earlier diagnostics-based assertion was silently vacuous, because the library's `reportConnectFailure` writes to the HOST console, not jsdom's `virtualConsole`, so a contained connect failure inside the realm never becomes a `SimDiagnostic`. **That gap is real and outside this task** — filed as LT-180 (architect review, 2026-09-04: build reports ARE meant to catch connect failures).
  3. **The capability probe is `isCompleteInternals()` (new, `src/internal.ts`), not a per-property `in` check.** jsdom's skeletal internals *does* carry working `role`/`aria*` accessors (they store and read back, reaching nothing), so "does this property exist" classifies the realm as reflection-capable and the fallback never fires. The discriminator used instead is presence of the form-association members (`setFormValue`/`setValidity`, never called): every engine that ships `ElementInternals` ships them, because form association is the feature it was introduced for; jsdom ships none of them. `ariaActiveDescendantElement` was considered and rejected as the sentinel — element-reference reflection landed years after `ElementInternals` itself, so it would demote real browsers to the attribute path and change shipped behavior. Element-reference properties stay no-ops on the fallback path *including for a nullish value*: there is no attribute they own to clear.
  4. `bindState()` probes `states` for a callable `add`/`delete` once at bind time and captures the set.
  5. Unchanged, as decided.
  **Copy for Tech Writer** (three sites): (a) the LT-150 degradation warning in `src/component.ts` — first draft narrows "ARIA reflection" to "host ARIA … for this component" and adds the mitigation sentence the ADR names ("Author the ARIA attributes in your markup instead"); (b) `bindAria()`'s JSDoc, which gained a capability-fallback paragraph; (c) `bindState()`'s JSDoc, which now names the no-`states` case alongside `null`. No error class and no `TSRX` code was added, removed, or renamed, so no union member or diagnostics-registry entry moved.
  **Docs touched** (also Tech Writer's, factual corrections only): `ARCHITECTURE.md` (the `bindAria`/`bindState` helper-table rows, and the unresolvable-expression sentence that still said `attachInternals()` is normalized to throw), `server/SERVER.md`, `server/tsrx/LE_TRUC_COMPILER.md` (§ unresolvability limb (a) and the `patch-table.ts` entry). ADR 0026 §2 needed no edit — the owner's amendment already described the shipped behavior.
  **Acceptance status:** the serialization pin is a realm-level test rather than a `.tsrx` corpus fixture, because LT-148 (which lowers root ARIA to `bindAria`) has not landed — no corpus component binds root ARIA yet, so a `.tsrx` fixture would pin `bindAttribute` and prove nothing. The realm test defines a `defineComponent` + `bindAria(internals, …)` component, renders it from `<probe-aria aria-expanded="false">`, and requires `aria-expanded="true"` in the serialized output; mutation-checked (taking the reflection path serializes `<probe-aria></probe-aria>` — the attribute stripped, nothing written, exactly the regression this task exists to prevent). **LT-148 should still add the corpus fixture.** No golden moved: `bun test server` 1362/1362, `bun test src/tests` 483/483, tsc clean, biome clean, and the Chromium+WebKit `test-aria` specs stay green (23 passed, 3 skipped) — real-browser reflection + removal unchanged.
  **New hazard for LT-148/LT-165:** under simulation `internals` is now non-null for non-form-associated components, so an imperative `internals.states.add(…)` in a factory throws a `TypeError` where it previously no-op'd through `internals?.`. No corpus site does this today (`form-textbox` removed the last one in LT-060). `bindState()` is the safe path.
  **Review (architect, 2026-09-04):** Approved. Implementation matches ADR 0026 §2's amended *Capability fallback* exactly — probe once at bind time, three tiers, shared coercion table, stale-attribute removal confined to the reflection path, element-reference properties no-ops on the attribute path. The `setFormValue`/`setValidity` presence probe is the right discriminator (jsdom's `aria*` accessors store and read back, so a property-existence probe would misclassify the realm as reflection-capable and never fire the fallback); the empty-but-retained `PROTOTYPE_PATCHES` is right for LT-165's table-read. The realm-level (rather than corpus-fixture) serialization pin is accepted — no corpus component binds root ARIA yet — with the fixture obligation moved onto LT-148 (amended there). The connect-failure diagnostics gap in the handoff and NOTES.md is filed as **LT-180**. Verified independently: `bun test server` 1362/1362, `bun test src/tests` 483/483, tsc clean; biome clean except one pre-existing unrelated suppression warning (`server/tsrx/globals.d.ts:59`, not touched by this diff). One accepted nuance, no follow-up: in real browsers the fallback path is near-unreachable (an engine without `attachInternals()` yields `null` → the no-op tier), so the attribute path's consumer-override semantics are effectively a simulation-only concern.
  **Copy review (Tech Writer, 2026-09-04):** Done. All three sites met the lifecycle criteria in draft; final wording applied: (a) the LT-150 warning now runs condition — em-dash mechanism — consequence — imperative, drops the implementation-voice "Treating it as no internals" for "The component runs without internals", and says "host ARIA reflection"; (b) `bindAria()`'s fallback paragraph now cites ADR 0026 §2 and unstacks its modifiers; (c) `bindState()`'s JSDoc says "no usable `states`" (the old "no `states` set behind it" misparses). **Propagation beyond the handoff's list** — the behavior docs that described the old no-op/reflection-only story: `docs-src/pages/effects.md` (helper-table nil cells + both prose paragraphs), `docs-src/pages/accessibility.md` (the `internals` bullet and the stale-attribute callout), `.agents/skills/le-truc/references/effects.md` (bindState/bindAria sections), `.agents/skills/le-truc/references/accessibility.md` (channel guidance). No error class, TSRX code, channel, or tier moved, so `errors.md`, `debug.md`, ADR 0028's inventory, and `non-obvious.md` are untouched. `types/src/bindings.d.ts` regenerated. When this branch lands, the CHANGELOG entry for the feature should mention the fallback and the reworded warning (changelog-keeper, at merge). Post-edit: server 1362/1362, src 483/483, tsc clean, biome clean.

## Architecture — internationalization (ADR 0030)

- [x] LT-172: Seed the simulation realm's `<html lang>` from the page's build locale. — reviewed ✓
  **Skill:** docs-server-dev
  **Context:** **Fixes a live silent-wrong-answer bug; do this independently of the rest of the
  i18n work.** `sim/realm.ts` renders with `document.body.innerHTML = markup`, so the simulated
  document's `<html>` carries no `lang` and `getLocale()`'s `closest('[lang]')` walk sees a
  TRUNCATED ancestor chain — it finds the component's own root `lang` if it rendered one, and
  otherwise silently resolves the `'en'` fallback regardless of the page's actual locale.
  `basic-pluralize`/`basic-number` are safe only by accident (they take `lang` as a server arg
  and render it); `module-calctable` and `basic-blogmeta` call `getLocale(host)` with no `lang`
  arg and would resolve `'en'` under simulation for any page. This is ADR 0027's "the
  diagnostics loss is structural" hazard with a concrete instance. Seed `<html lang>` from the
  build's page locale (ADR 0030 s7). Acceptance: a fixture component reading `getLocale(host)`
  with no `lang` arg, rendered on a non-`en` page, resolves that page's locale under simulation;
  `bun test server` green. Note this only narrows the gap — the realm still parses one
  component's markup, so an ancestor `[lang]` BELOW `<html>` remains invisible; ADR 0030 s7
  makes the reserved `i18n` parameter the canonical route for that reason.
  **Changed:** `server/tsrx/sim/realm.ts` — `RenderOptions` gains an optional `locale`;
  `render()` seeds it onto `<html lang>` inside the synchronous window before
  `document.body.innerHTML = markup`, and the render memo key becomes
  `(component, locale, markup)`. New `page locale seeding` describe block in
  `server/tests/tsrx/sim-realm.test.ts`.
  **How:** `setAttribute('lang', locale)` when a locale is given, `removeAttribute('lang')`
  when it is not — so "no page locale known" is distinct from the previous render's locale and
  nothing leaks between pages. The locale had to join the memo key: the same markup on a `de`
  page and an `en` page are different renders once a component reads `getLocale(host)`.
  **Check:** (a) the no-locale branch clearing rather than defaulting to `'en'` — the `'en'`
  fallback stays `getLocale()`'s, not the realm's; (b) whether the driver that will call
  `render()` from the build (not yet written) should get the locale from a realm-level default
  instead, given one realm per build but one locale per page — per-render was chosen because
  the realm outlives the page; (c) the memo-key widening is a cache-hit-rate change: distinct
  locales now multiply the 216 measured signatures by the number of built locales.
  **Review (architect, 2026-09-04):** Approved. All three checks resolved as implemented: (a)
  the clearing branch is correct and pinned (`hasAttribute('lang')` false + `data-locale="en"`
  from `getLocale`'s own fallback); (b) per-render is right — the realm outlives the page, and
  LT-169's driver is the natural per-page caller; (c) the cache-hit-rate cost is exactly
  LT-175's spike scope, no action here. One accepted nuance: the test probe reimplements
  `getLocale`'s one-line walk rather than importing `examples/_common/getLocale` — faithful
  (verified against the helper), and importing an examples helper into a server test would be
  the worse layering; also, a cache hit returns before the seeding line, so `documentElement`'s
  `lang` reflects the last actual render, not the current call — irrelevant to serialized
  bytes, no follow-up. Verified independently: `bun test server` 1391/1391 (includes the 2 new
  tests), `tsc -p tsconfig.build.json` clean, biome clean except the pre-existing
  `server/tsrx/globals.d.ts:59` suppression warning (noted at the LT-177 review, unrelated).

- [ ] LT-173: Implement the reserved `i18n` parameter and the catalog pipeline (ADR 0030).
  **Skill:** le-truc-dev
  **Context:** ADR 0030 is accepted; read it rather than this summary. Scope, ordered:
  1. **The reserved parameter.** `i18n` joins `children` as a compiler-supplied server arg
     (ADR 0024 s10's mechanism, reused — do not invent a second one). A component receives it
     only by declaring it; callers never pass it. Record shape: `lang`, `t`, `timeZone`,
     `currency`, `dir`. It must be an ordinary destructurable arg so it is server-known and
     folds in phase 1.
  2. **Precedence.** An authored `lang` arg, or a `lang` at a compose site, overrides the
     record. The EFFECTIVE locale renders onto the root `lang` attribute. Confirm no new
     TSRX039 exemption is needed — ADR 0024 s3's root-attribute exclusion should already cover
     it; if it does not, that is a finding worth escalating rather than patching.
  3. **Catalog pipeline** — format, per-locale loading, key resolution at render time, staleness
     detection. New build surface with no prior art in this repo; keep it in `server/effects/`
     alongside the other build effects. **Layout (ADR 0030 s4):** source-locale strings are
     declared INLINE in the `.tsrx` beside their keys — there is deliberately no per-component
     catalog file, since that reintroduces the sibling-file drift ADR 0024 cures. Translations
     are additive per-locale override files, component-namespaced: `i18n/de.json` with keys
     `<tag>.<key>`. **No tiering, no override stack** — a key resolves in exactly one place; do
     not add a global or page layer without reopening the ADR. **Staleness is the subtle part:**
     a source-string edit is a `.tsrx` edit that silently invalidates that key's translations, so
     detection must notice a moved source string, not just an absent key.
  3b. **Report artifact and `i18n:sync`.** The build stays READ-ONLY: emit a gitignored report
     (machine-readable per locale + a human summary) and the census count in the build summary.
     A separate explicit `bun run i18n:sync` writes missing keys into the committed catalogs as
     empty entries — run by a person, diffable in review. The build must never write tracked
     files (non-idempotent builds, CI writing to the working tree).
  4. **Missing keys** fall back to the source-locale string and land in the build report's
     **translation census** (ADR 0030 s5) — NOT the compile-warning channel, since a missing key
     is not author-fixable and would restart the non-zero-baseline drift ADR 0029 s6 removed.
     Reuse `sim/report.ts`, the same channel as the tier census.
  5. **The untranslated-literal warning** — literal prose inside a component that otherwise uses
     the catalog. This one IS author-fixable, so it is a genuine compile warning and must
     converge to zero. **Channel:** compiler. **Tier:** 1 (Prevented) per ADR 0028. **Tech
     Writer owns the copy** (new TSRX code; `tech-writer`'s `workflows/error-message-lifecycle.md`
     carries the propagation checklist).
  6. **Verify the tiering payoff.** With a server-known locale, `Intl` folds (LT-142) and
     `basic-pluralize` should become Folded-tier eligible, dissolving its six standing TSRX034
     warnings. If it does not, either the fold rule or the classifier is wrong — investigate
     rather than accepting the Simulated tier. `basic-blogmeta` should fold too, but ONLY once its date
     handling stops reading the build machine's timezone: it currently does
     `new Date(year, month - 1, day)` (local zone) and `new Intl.DateTimeFormat(locale, {dateStyle})`
     with no `timeZone`. For a date-only value use `Date.UTC(y, m - 1, d)` with
     `timeZone: 'UTC'` — never shifts the day, reads no ambient state (ADR 0030 s2; this closes
     the question ADR 0029 s5 left open). Coordinate with LT-095, which reshapes this component.
     **[Hardened 2026-09-04 (LT-173 block, NOTES.md): this is a HARD block, not a courtesy —
     `basic-blogmeta` has no `.tsrx` until LT-095 migrates it, so the date-handling fix and the
     fold verification for it cannot land inside this task. Verify `basic-pluralize` here and
     record blogmeta's fold as deferred-to-LT-095 (whose text already carries the expectation).]**
  7. **Per-locale pruning of rendered alternatives** (ADR 0030 s6). A component rendering one
     alternative per plural category prunes to the locale's actual set — `{one, other}` for
     English instead of all six. Read the set from
     `Intl.PluralRules(lang, opts).resolvedOptions().pluralCategories`, NOT a hand-maintained
     table (same posture as ADR 0024 s4's ARIA mapping). Cardinal and ordinal differ, so prune by
     the configured `type` and fall back to their union when it can't be proven.
     **The client-side `hidden` toggles do NOT retire** — the locale is fixed but `host.count` is
     a reactive prop, so the category still changes at runtime and the client can only select
     among strings the server rendered. Removing the toggles would freeze every pluralized string
     at its initial count. Pin this with a fixture that changes `count` after connect.
  Acceptance: a component declaring `i18n` receives it with no caller change; an authored `lang`
  overrides the record and renders as the root attribute; a missing key renders the source
  string and appears in the census, not the warning stream; an untranslated literal warns;
  `basic-pluralize` classifies as Folded-tier, renders two category spans on an `en` page, and still
  re-selects correctly when `count` changes after connect; the build writes no tracked file;
  `bun test server` green.
  **Depends on LT-165** (the classifier must exist before the tiering payoff in step 6 is
  checkable). **[Resolved 2026-09-04 (user, via NOTES.md): land LT-165 first. Verified while
  blocked that the dependency is wider than step 6 — step 4's translation census has no
  channel to ride until LT-165 step 6 defines the tier census on `sim/report.ts`; when this
  task resumes, step 4 ADOPTS that census surface rather than defining a parallel one. The
  `basic-pluralize` Simulated→Folded flip (this task's step 6 vs LT-165 step 5) is an
  expected sequential state, not a regression — see the note now on LT-165 step 5.]**

- [ ] LT-175: Measure and contain the per-locale impact on LT-166's render cache (exploration).
  **Skill:** docs-server-dev
  **Context:** **Owner decision, 2026-09-04: do this as a measurement round before designing
  anything.** The direction of the net effect is genuinely unknown, which is why it is a spike
  and not an obligation buried inside LT-174. Pulling the other way: per-locale rendering
  multiplies the corpus (~3,700 occurrences → N × 3,700) and LT-166's `(component, markup)`
  memoization now varies by locale, so the measured **93.5% hit rate will drop**. Pulling back:
  ADR 0030's Folded-tier promotion means i18n components stop being simulated at all, and per-locale
  pruning (LT-173 step 7) shrinks the markup that is the cache key. **Measure, don't estimate:**
  hit rate and simulated-stage wall time at 1 locale vs. 2, split by tier, with and without
  pruning. Then decide whether containment is needed at all and what shape it takes (locale in
  the key vs. a locale-invariant key for components that don't consume `i18n`; the latter looks
  promising since most components won't declare the parameter, but confirm it rather than
  assuming). Record the figures in the handoff — nobody has measured the net, and ADR 0030's
  consequences section says so explicitly. **Depends on LT-173.**

- [ ] LT-174: Per-locale page rendering for the docs site (ADR 0030 s1).
  **Skill:** docs-server-dev
  **Context:** Path-prefix routing (`/de/guide`, `/en/guide`), one SSG page per locale, locale
  fixed before rendering begins. **The build-time-constant property is load-bearing, not an
  infrastructure preference** — it is what lets `Intl` fold and keeps i18n components on the Folded tier;
  a request-time locale would unfold every `Intl` call and push the whole i18n corpus to the Simulated tier.
  **Perf obligation:** the corpus's ~3,700 occurrences become N × 3,700, and LT-166's
  `(component, args)` memoization now keys on locale, so the measured 93.5% hit rate will drop
  by an amount that depends on how many components consume `i18n`. Re-measure when the second
  locale lands and record the figure — it partially offsets ADR 0029's Static-tier savings, and
  nobody has measured the net yet — **LT-175 is that measurement, and it should land first.**
  **Depends on LT-173 and LT-175.**

## Documentation alignment

- [x] LT-181: Propagate the TSRX013 split (TSRX044/TSRX045) through the error-surfacing docs, and re-point ADR 0028 §5's `NoActiveCollectorError` row. — done ✓
  **Skill:** tech-writer
  **Context:** Owed from LT-165 steps 1–3 (landed, reviewed ✓ 2026-09-04). `TSRX013` is now
  three codes: `conditionalSignalConstructor` → **TSRX044** (ADR 0024 s12 format rule),
  `deferredCollectorCall` → **TSRX045** (client-side `NoActiveCollectorError`,
  tier-independent), and `clientOnlySetupConst`/`clientOnlySignalCompute` keep TSRX013. The
  two new codes carry first-draft messages carried verbatim from TSRX013's originals, which
  described all four factories at once — each should name only its own shape. Propagation
  (ADR 0028 lifecycle; `workflows/error-message-lifecycle.md`):
  1. `.agents/skills/le-truc/references/errors.md` — the `NoActiveCollectorError` row cites
     `TSRX013` (deferred call) → TSRX045; the TSRX013 diagnostic row scopes to the two
     server-evaluation factories; add TSRX044/TSRX045 rows.
  2. ADR 0028 §5's `NoActiveCollectorError` row — re-point `TSRX013` → TSRX045. **The
     architect pre-approves this ADR edit**: the row's own text instructs it ("re-point this
     row when LT-165 lands") and the re-point is mechanical; use a dated bracket per house
     style, no history rewrite.
  3. `server/tsrx/LE_TRUC_COMPILER.md` § 6 — the reclassification table says the two
     factories "get their own code" without naming it; name TSRX044/TSRX045.
  4. `TSRX-HOST-PROFILE.md` § "What you write decides your evaluation tier" says "the
     server-evaluation members of `TSRX013`" — still accurate (only the two retaining
     factories are server-evaluation guards); verify, don't rewrite.
  **Channels/tiers:** no new check and no code moved by this task — copy only. If the
  verbatim drafts mislead (they enumerate shapes that moved to sibling codes), rewording the
  messages in `server/tsrx/diagnostics.ts` is in scope, same commit.
  **Coordinate:** land before or with LT-165 step 5's diagnostic-reclassification copy pass,
  so the diagnostics copy is touched once.
  Acceptance: `errors.md`, ADR 0028 §5, and `LE_TRUC_COMPILER.md` § 6 agree with
  `server/tsrx/diagnostics.ts`'s code set; a grep for TSRX013 no longer describes the split
  factories anywhere author-facing; `bun test server` green if messages moved.
  **Handoff (tech-writer, 2026-09-04; architect-verified):** docs-only, `diagnostics.ts`
  untouched. `errors.md`: `NoActiveCollectorError` row → `TSRX045`; the `TSRX013` row rescoped
  to its two surviving server-evaluation factories; `TSRX044`/`TSRX045` rows added in code
  order with fix-its matching the code's messages. ADR 0028 §5: re-pointed to `TSRX045` with a
  dated bracket; the row's "re-point when LT-165 lands" instruction completed in place.
  `LE_TRUC_COMPILER.md` § 6: the table names `TSRX044`/`TSRX045`; the "must be split BEFORE
  retirement" sentence now records the landed split. `TSRX-HOST-PROFILE.md` verified still
  accurate post-split, untouched. **Premise correction: the task expected verbatim misleading
  drafts needing reword — the two codes' messages were already shape-specific before the split**
  (a2e789e4 changed identifiers/JSDoc only), so no message moved and no test churned.
  Deliberately stale, not missed: `adr/0029` (immutable record), `adr/0027` §78 (historical),
  ADR 0028's Related amendment line, CHANGELOG. Residual: `docs-src/api/_media/`'s generated
  copies refresh on the next `bun run build:docs` (gitignored, never hand-edited).
  `bun test server` 1391/1391.

- [x] LT-176: Align bundle-size thresholds across test copy and ADR citations. — done ✓
  **Skill:** tech-writer
  **Context:** One number, three stories (architecture review, 2026-09-04). The constants are operative: `test/regression-bundle.test.ts:4-5` enforces **9 kB minimal (hard ceiling)** and **warns at 10 kB** for core + `formAssociated()` — but the first test's title says "under 8 kB", the second's says "exceeds 14 kB", and published ADRs cite the older numbers (ADR 0010: "≤10 kB target, hard ceiling 14 kB"; ADR 0014: "the 14 kB ceiling"; ADR 0019: "the 9/10 kB ceiling"). REQUIREMENTS §4 is already canonical (rewritten 2026-09-04): 9 kB minimal hard ceiling, 10 kB formAssociated warn, full barrel reported-not-asserted. Fix: test titles to match their constants; audit every threshold citation in `adr/`, `ARCHITECTURE.md`, `README.md`, and `docs-src/`. Do NOT rewrite published ADR history — add bracketed correction pointers in the house style (ADR 0003 ← 0019 is the pattern). Acceptance: no surviving doc/test text states a threshold the constants don't enforce; a "kB" grep across test titles, `adr/`, `ARCHITECTURE.md`, and `docs-src/` agrees with the constants or carries a dated correction pointer.
  **Handoff (tech-writer, 2026-09-04; architect-verified):** titles-only in
  `test/regression-bundle.test.ts` ("at or under 9 kB gzipped" / "exceeds 10 kB gzipped" —
  matching `toBeLessThanOrEqual` and `>` respectively); dated *(Corrected 2026-09-04: …)*
  pointers added to ADR 0010/0014/0019, no history rewrite — ADR 0019's pointer quotes what the
  replaced line actually said ("below 14 kB … TCP segment threshold; target ≤10 kB"), and
  ADR 0014's verifies the original claim still holds at the measured 8915 B. Every kB citation
  in `adr/`, `ARCHITECTURE.md`, `README.md`, `docs-src/` judged: agreeing citations and cost
  figures left as-is. Sole judgment call, accepted: the 2026-03-09 blog post's "less than
  10 kB" (historical narrative, still true of the core). `bun run check:size` 5/5; measured:
  minimal **8915 B** (301 B under the 9 kB ceiling), core+`formAssociated()` 9700 B /
  +Checkbox 9729 B (warn 10240 B, neither warns), barrel 17773 B informational. Generated
  gitignored `docs-src/api/_media/REQUIREMENTS.md` refreshes on the next `bun run build:docs`.
  Headroom note for the next size conversation: the minimal ceiling is the thinner margin
  (301 B vs ~510 B); retuning it is a REQUIREMENTS §4 decision, not a doc fix.

## v3.0 — deprecated-surface removal (separate branch; gates wave 4)

**Owner sequencing, 2026-09-04:** both removals run on a **separate branch**, started only once the authoritative documents speak a common language again (the ADR amendments + the v3 REQUIREMENTS rewrite, landed 2026-09-04, plus LT-176), and land **before any wave-4 migration** (LT-095–LT-111) so migrated twins and newly generated clients never target the removed forms. ROADMAP § "Dead ends: deprecated in 2.x, removed in 3.0" already declares both; these tasks implement it. The Cause & Effect 2.0 re-export surface rewrite (ROADMAP § "Cause & Effect 2.0 alignment") is a separate track, blocked on CE 2.0 actually shipping — out of scope here.

- [ ] LT-178: Remove the `pass()` unrestricted-write short forms (ADR 0012 removal).
  **Skill:** le-truc-dev
  **Context:** ADR 0012 scheduled removal for the next major; the major is in pre-release (3.0.0-next.1) and the DEV_MODE warning still fires in `swapSlots` (`src/helpers/reactive.ts`). Delete the property-key and bare-writable-signal input forms from `PassedProps` handling and `toSignal` resolution — the thunk (read-only) and `{ get, set }` descriptor (mediated) forms remain the only inputs. ADR 0012's status records the examples as already migrated; sweep `examples/`, `test/`, and `docs-src/` for stragglers anyway. **Retires a DEV_MODE deprecation warning — Tech Writer reviews the copy removal** (warning message, JSDoc on `pass()`/`PassedProps`, CHANGELOG breaking entry, ROADMAP dead-end check-off). Channel note: this retires a check and adds none.
  Acceptance: the short forms are gone from the types and the runtime; nothing warns because nothing exists to warn about; `bun test` green; CHANGELOG carries the breaking entry.

- [ ] LT-179: Remove the explicit factory return contract and `forEachUnseen` (ADR 0018 v3.0 milestone).
  **Skill:** le-truc-dev
  **Context:** ADR 0018's v3.0 milestone, still pending at 3.0.0-next.1: `watch()`/`on()`/`pass()`/`each()`/`provideContexts()` return `void`; `FactoryResult`/`EffectDescriptor` leave the public return contract (`src/types.ts`, `index.ts`); the `forEachUnseen` return-reconciliation in `src/component.ts` is deleted, as is `each()`'s copy kept only for the v2.3→v3.0 window (ADR 0017). Hand-authored descriptor registration remains `watch(() => true, descriptor)` — the only documented path. Sweep examples/tests for `return [...]` factories. **Tech Writer reviews the doc touchpoints** (AGENTS.md, ARCHITECTURE.md § Effect Descriptors, CONTEXT.md Factory/Effect Descriptor entries, CHANGELOG breaking entry).
  Acceptance: helpers return `void`; `FactoryResult` is not exported; a bare-statement helper call cannot silently no-op (the collector is the only registration path); `bun test` green.

## Gate wave — remaining

- [ ] LT-147: Lower reactive `aria-*` on element targets to `bindAria()`, with a reverse IDL name table.
  **Skill:** le-truc-dev
  **Context:** **Owner decision, 2026-09-02. Unaffected by the phase-1/phase-2 decision** — this
  is about which binding helper the compiler emits, not about server-execution tiering. v2.6
  added `bindAria()` (ADR 0026), and the compiler does not know about it: all 7 reactive ARIA
  bindings in the corpus lower to `bindAttribute` with a **compiler-synthesized `String()`** —
  `String(selected.get() === pid)` (module-tabgroup), `String(host.value === optValue)`
  (form-listbox), `String(parseOklch(host.value).h ?? 0)` (form-colorgraph) — which is precisely
  the hand-rolled coercion ADR 0026 §2 exists to remove. **Fix:** lower a reactive `aria-*`
  attribute on an element target to `watch(<thunk>, bindAria(el, '<idlName>'))`, dropping the
  synthetic `String()` and letting the helper apply ARIA's own coercion (`boolean` →
  `'true'`/`'false'`, `number` → decimal, `nil` → clear). **Two hard constraints.** (1) The
  attribute→IDL mapping is a **lookup table, not a transform**: ARIA attribute names carry no
  inner hyphens, so `aria-valuenow` gives no clue where the camel hump falls (`ariaValueNow`).
  Build the table by enumerating `ARIAMixin`'s names and applying the library's own forward rule
  (`ariaAttributeName`, `src/bindings.ts:512`) — do not hand-maintain a second list that can
  drift from the platform. (2) `ARIAMixin` splits into **44 string-valued props and 8
  element-reference props** (`ariaActiveDescendantElement`, `ariaControlsElements`,
  `ariaDescribedByElements`, `ariaDetailsElements`, `ariaErrorMessageElements`,
  `ariaFlowToElements`, `ariaLabelledByElements`, `ariaOwnsElements`) that take
  `Element`/`Element[]`. An IDREF *string* must NEVER be routed to one —
  `aria-describedby="x"` is not `ariaDescribedByElements`. Map string-valued props only; leave
  the IDREF attributes on `bindAttribute`. All of the corpus's IDREF ARIA is server-static
  today, so nothing regresses. Acceptance: the 7 sites lower to `bindAria` with no `String()`,
  the golden clients update, and all 842 Playwright example specs stay green (they assert on the
  ARIA *attributes*, which native reflection still mirrors for element targets). [**Corrected, 2026-09-04 (LT-171 / ADR 0029):** any inherited "the zero-warning
  baseline from LT-146 holds" reading of this acceptance line is superseded. The baseline's
  target IS still zero — ADR 0029 sub-design 6 moves the routing signals (TSRX004/TSRX034) out
  of the warning channel into a tier census rather than declaring a non-zero target — so use
  the post-0029 zero-warning gate here, not a hand-maintained expected count.]

- [ ] LT-148: Route the component's OWN host ARIA to `internals`, and diagnose CSS that depends on host ARIA attributes.
  **Skill:** le-truc-dev
  **Context:** **Owner decision, 2026-09-02. Unaffected by the phase-1/phase-2 decision**, same
  reasoning as LT-147. Depends on LT-147's mapping table. Per ADR 0026 §1, host semantics belong
  on `internals.aria*`: invisible in markup, unclobberable by framework attribute rewriting, and
  still overridable by the consumer's own attribute. **Fix:** a reactive `aria-*` on the ROOT
  element lowers to `watch(<thunk>, bindAria(internals, '<idlName>'))` rather than to an
  attribute write on the host. **The two halves must land in the same commit,** because the
  routing is what makes the diagnostic necessary: `bindAria()` on an `ElementInternals` target
  **removes the shadowing content attribute** at its first value assertion (ADR 0026 §1,
  stale-attribute rule), so a server-rendered `aria-expanded="false"` on the host is deleted at
  hydration — by design, and fatal to any CSS selecting on it. **So:** diagnose a selector in
  the component's own `<style>` block that matches the HOST on an `aria-*` content attribute
  (e.g. `module-tabgroup[aria-expanded="true"]`), with the fix-it naming `:state()` (ADR 0016
  §8) as the component-owned styling hook. **The distinction is load-bearing and the diagnostic
  is wrong without it:** ARIA on CHILD elements stays on the attribute channel (native IDL
  reflection mirrors element-target writes), so the corpus's three existing
  `&[aria-selected="true"]` selectors — nested under tab buttons and option buttons in
  `module-tabgroup` and `form-listbox` — are CORRECT and must NOT warn. Only host-matching
  selectors do. **Zero corpus sites exercise either half today** (no component has a reactive
  `aria-*` on its root, and no `<style>` selects host ARIA), so **write both fixtures first**;
  this is a forward-looking guard, in the LT-125/129 posture. Acceptance: a root `aria-*` thunk
  lowers to the internals form; a host `[aria-*]` style selector warns; the three child
  selectors stay silent. [**Superseded reference, 2026-09-04; resolved by LT-171 / ADR 0029:** the
  intermediate note that "the zero-warning baseline no longer applies" was itself too broad.
  ADR 0029 sub-design 6 keeps the baseline's target at ZERO by moving the routing signals
  (TSRX004/TSRX034) out of the warning channel entirely into a tier census. So the original
  acceptance line stands as written — the eight standing warnings' successors are simply not
  warnings any more.] [**Amended 2026-09-04 (LT-177 landed):** carry two things from LT-177's
  handoff. (1) This task now owns the serialization pin LT-177 deferred: a corpus fixture whose
  root `aria-*` binding serializes WITH the attribute under simulation — LT-177's realm-level
  test pins the mechanism only, and a `.tsrx` fixture was meaningless before any root ARIA
  binding exists. (2) Under simulation `internals` is now non-null for non-form-associated
  components, so an imperative `internals.states.add(…)` in a factory throws a `TypeError`;
  route custom states through `bindState()`, which capability-probes and no-ops on skeletal
  internals.]

- [ ] LT-170: Strengthen two gate-wave assertions in `gate-wave-verification.test.ts` that don't test what they claim.
  **Skill:** docs-server-dev
  **Context:** Filed by the LT-144/LT-145 review (2026-09-03). Unaffected by the phase-1/phase-2
  decision. Two tests in `server/tests/tsrx/gate-wave-verification.test.ts` pass today but don't
  verify the behavior their name/comment claims — a regression in the underlying compiler
  behavior would not fail either one. (1) **LT-144's `'the reactive spelling plans a client
  binding the static spelling does not'`** (line ~220) only asserts `hostVariant.spans`/
  `bareVariant.spans` are truthy — true of any compiled component. Fix: assert on the actual
  compiled `clientCode`, e.g. `hostVariant.clientCode` contains a `watch(...host.count...bindText(`
  call and `bareVariant.clientCode` does not (confirmed by hand during review: this distinction
  is real and present today). (2) **LT-145's `'composed under form-combobox, initial render
  stays hermetic'`** (line ~263) only asserts the string `<form-listbox` appears in the composed
  output — trivially true. `form-combobox` composes its listbox with `filterable={false}`, so
  there's no clear button to check there; the acceptance-relevant behavior this test should pin
  is the OTHER known composed-filter case already documented in the LT-154 review ("The
  combobox's selected-but-`hidden` inner option is authored `truc:pass` filter wiring") — assert
  the first option renders both `aria-selected="true"` AND `hidden=""` in the initial
  (pre-`truc:pass`) render, matching `sim-driver.test.ts`'s own corpus snapshot for
  `form-combobox`, so this file actually pins the case its own task text describes rather than
  duplicating weaker coverage. Acceptance: both tests fail if the underlying compiled/rendered
  behavior regresses; `bun test server/tests` stays green.

- [ ] LT-165: Implement the ADR 0029 tier classifier, and split TSRX013. — steps 1–3 reviewed ✓; steps 4–8 not started
  **Skill:** le-truc-dev
  **Context:** [**Rewritten 2026-09-04 against ADR 0029; the original "delete the evaluability
  machinery" premise, and its 2026-09-04 interim retitle, are both superseded.**] ADR 0029 is
  accepted; this is its implementation. Read the ADR, not this summary, for the rationale.
  Ordered, because step 1 gates the rest:
  1. **Split `TSRX013` first.** Four unrelated factories share the code and only two are
     server-evaluation guards. `deferredCollectorCall` (client-side `NoActiveCollectorError`,
     tier-independent) and `conditionalSignalConstructor` (ADR 0024 s12 format rule) each get
     their own code and KEEP their current severity. `clientOnlySetupConst` and
     `clientOnlySignalCompute` stay on TSRX013 and become classifier input. Nothing else in this
     task is safe to do before this split. **Tech Writer reviews the copy** for the two new
     codes and for every retirement (ADR 0028 lifecycle; `tech-writer`'s
     `workflows/error-message-lifecycle.md` carries the propagation checklist).
  2. **Build the classifier** in `evaluability.ts`/`analysis/harvest.ts` as ADR 0029 s1 specifies
     — a conjunction, not a single predicate. Phase-1 totality is the existing analysis with
     inverted polarity; realm answerability reads `sim/patch-table.ts`. Keep the stub table as
     the single source for the second conjunct: a driver capability landing later must re-route
     components by deleting a patch-table row, not by editing a second list.
  3. **Compose-graph fixpoint** — contamination on READS (a `first()` on a compose site, a
     `truc:pass` into it), never on containment (ADR 0029 s3). Computed in the registry-aware
     second pass alongside `analysis/compose-refs.ts`.
  4. **`emit-server.ts` takes a tier flag.** One emit path; every component still gets a render
     module (the realm parses it as input). The only difference: Simulated-tier and Static-tier modules do
     NOT re-declare `@{ }` setup verbatim. The Folded tier's path is unchanged — confirm this with the
     server goldens, which should not move for any Folded-tier component.
     **[Amended 2026-09-04 (architect review, check (b)): the corpus's Static tier is empty and
     stays so until wave 4 (see the review ruling), so pin the Static emit variant with a
     SYNTHETIC fixture compiled through `compileComponent` in tests — a component whose only
     signal is served-relevant and unresolvable (e.g. a `Math.random()`-initialized cell
     rendered into markup), asserting tier `'static'` and a server module without the verbatim
     setup re-declaration. Without it, the Static emit path ships untested until a real
     migration exists.]**
  5. **Diagnostic reclassification per ADR 0029 s5's table.** TSRX004, TSRX034 (non-severe),
     TSRX043 and TSRX013's two server-evaluation factories leave the diagnostic channel for the
     tier census. TSRX034-severe survives SCOPED TO THE STATIC TIER. TSRX039 untouched.
     **Impure-ambient is NOT a routing signal** — it is the expression-level unresolvability
     property (ADR 0029 s1 limb b): omitted in EVERY tier including the Simulated tier, no diagnostic. This
     needs the realm-side suppression step (step 7). LT-142's `Intl` rule splits three ways:
     server-known locale → Folded-tier-eligible; locale read from the DOM (`getLocale(el)`,
     `host.lang`) → Simulated-tier routing signal, since the realm executes it for real; runtime-default
     locale → unresolvable. `basic-pluralize` must stay the Simulated tier. **[Amended
     2026-09-04 (architect review, cross-noted in LT-173 step 6): this pin is SEQUENTIAL, not
     permanent — LT-173's reserved `i18n` parameter makes the locale server-known, so
     `basic-pluralize` is expected to flip Simulated → Folded when LT-173 lands. That flip is
     this acceptance line's successor state, not a regression; whoever implements either task
     should expect it and update the census golden rather than investigating.]** Also revisit `evaluability.ts`'s
     unconditional `Date` impurity: `new Date(year, month, day)` over parsed server args (the
     `basic-blogmeta`/LT-095 shape) reads no viewing-moment fact, but both the constructor and
     the formatter read the build machine's TIMEZONE — analyse it, don't assume it.
  6. **The tier census** rides `sim/report.ts` (LT-163's channel), recording per component its
     tier and the reason. It is NOT a warning — the compile-warning baseline's target stays zero
     (ADR 0029 s6), and `check:tsrx`'s counted summary line should report the two separately.
  7. **Realm-side suppression for unresolvable expressions.** The generated client is the
     shipped artifact, so the realm cannot decline to install a binding: record each unresolvable
     expression's target site at compile time and revert those sites in the driver before
     serializing. **Ordering is load-bearing** — it must run AFTER the fixed-point gate's second
     connect pass (ADR 0027 s8), never between the two, or the gate compares a suppressed tree
     against an unsuppressed one and reports a spurious failure. `module-ticker` is the corpus
     case to pin (the Simulated tier, `Math.random()` suppressed, everything else simulated) once migrated.
  8. **The CI equivalence audit** (ADR 0029 s7) — render every Folded-tier component through the
     realm as well, require byte-identical output, fail against the component on divergence.
     This is what makes two coexisting mechanisms defensible; it is not optional and it is not a
     follow-up task. The known `Date.now()` disagreement between `evaluability.ts`'s
     `IMPURE_AMBIENT_ROOTS` and ADR 0027 s6 is DISSOLVED by steps 5+7, not resolved by electing a
     winner: neither mechanism can answer it, so it renders in neither.
  Acceptance: the classifier assigns a tier to every corpus component with a recorded reason and
  golden coverage; `module-scrollarea`-shaped components (layout + `internals`-only output)
  classify as Static-tier once migrated; `basic-counter`/`module-tabgroup`/`card-blogpost`/`card-callout`
  classify as Folded-tier; no `Date`/`Math.random()` reading expression renders a value in ANY tier;
  the equivalence audit runs green in CI; TSRX013 is three codes; the compile-warning count is
  zero and the tier census is reported separately; `bun test server` green.
  **Changed (steps 1–3, 2026-09-04):**
  - `server/tsrx/diagnostics.ts` — TSRX013 split three ways. `conditionalSignalConstructor` →
    **TSRX044** (ADR 0024 s12 format rule), `deferredCollectorCall` → **TSRX045** (client-side
    `NoActiveCollectorError`); `clientOnlySetupConst`/`clientOnlySignalCompute` keep TSRX013.
    `lineOf` is now exported so the census cites the same line the diagnostic did.
  - `server/tsrx/tier.ts` (new) — `classifyTier`, `resolutionOf`, `stubbedApiRead`,
    `contaminateComposeReads`.
  - `server/tsrx/sim/patch-table.ts` — new `CAPABILITY_PATCHES` (`kind: 'capability'`) for
    member reads the realm answers WRONG rather than not at all (layout geometry → silent zeros;
    `internals.states`/form members). ARIA members deliberately excluded per ADR 0026 §2.
  - `server/tsrx/evaluability.ts` — new `impureAmbientCauses`, with `containsImpureAmbient`
    redefined on top of it so the two cannot drift.
  - Routing signals threaded through `ExtractContext`/`AnalysisContext`/`ClientPlan`; classified
    in `server/tsrx/index.ts`; `tier`/`routingSignals`/`composeReadTags` recorded on
    `RegistryEntry`; the compose fixpoint applied corpus-wide in `server/effects/tsrx.ts`.
  **How:** the two ADR 0029 facts are kept separate in code as well as in prose —
  `resolutionOf` is per-EXPRESSION (which limb, if any, makes it unresolvable) and
  `classifyTier` is per-COMPONENT (is phase 2 worth running). Limb (a) reads the patch table so
  the delete-a-row-to-re-route property holds. LT-142's `Intl` rule splits three ways via
  `impureAmbientCauses`: `intl-dom-locale` is impure for FOLDING but realm-answerable, which is
  what keeps `basic-pluralize` Simulated rather than Static.
  **Check:** (a) **the Folded/Simulated/Static split is 19/3/0, not the ~6-of-22 ADR 0029's
  Consequences forecast — this needs an Architect decision and is written up in NOTES.md**; it
  changes the CI equivalence audit's cost (step 8 renders every Folded component through the
  realm) and therefore step 8's design; (b) Static is EMPTY because every component ADR 0029
  names as a Static-tier case (`module-scrollarea` above all) is unmigrated, so the tier the
  cost argument rests on has no corpus member yet; (c) whether `composeReadTags`' definition —
  a compose site carrying a `ref` or `pass` attr — is the right reading of "contamination on
  reads"; (d) the diagnostics still fire alongside the new signals, deliberately, so steps 1–3
  are behaviour-preserving; step 5 is what removes them from the channel.
  **Not started:** steps 4 (emit-server tier flag), 5 (diagnostic reclassification), 6 (tier
  census on `sim/report.ts`), 7 (realm-side suppression), 8 (CI equivalence audit).
  **Copy handoff owed to Tech Writer:** TSRX044 and TSRX045 are new codes with first-draft
  messages (carried over verbatim from TSRX013's originals) and need the ADR 0028 lifecycle
  propagation — `.agents/skills/le-truc/references/errors.md` still describes TSRX013 as all
  four factories, and ADR 0028 §5's `NoActiveCollectorError` row carries an explicit
  "re-point this row when LT-165 lands" instruction that is now due. **[Filed as LT-181,
  2026-09-04.]**
  **Review (architect, 2026-09-04):** Steps 1–3 **approved**. Read `tier.ts`, the signal push
  sites in `analysis/harvest.ts`/`analysis/effects.ts`/`compiler.ts`, `index.ts`'s wiring, and
  `effects/tsrx.ts`'s fixpoint independently; gates re-run: `bun test server` 1391/1391, tsc
  clean, biome clean, `check:tsrx` 22/22. Verified behavior-preserving: the compile-warning
  baseline is **7 unique** at BOTH this head and its parent `809d2f7e` (LT-168's recorded "8"
  was already stale on this branch — see the archive correction below), so steps 1–3 moved
  nothing. Rulings on the checks:
  - **(a) 19-Folded is right.** The tier routes which MECHANISM produces the served HTML;
    sub-design 1 defines "phase 1 cannot resolve" operationally as the inverted refusal sites,
    and those count sites whose *server render* cannot complete. A `first()` read confined to
    `watch()`/`on()` positions is a client concern (ADR 0003, tier-independent) that reaches
    no served byte — the Context's "~6 of 22" measured a broader any-purpose predicate and was
    the pre-implementation estimate, not the definition. Bracketed corrections are now in ADR
    0029 (Context facts 1–2 and the Consequences minority-path bullet) and
    `LE_TRUC_COMPILER.md` § 5.3. Step 8's audit scope is therefore 19 components — accepted;
    its CI cost is bounded by corpus size (~4 s), not by the tier split, and a harness/realm
    divergence on any of them is the audit working as designed (sub-design 7: a false Folded
    or a real two-mechanism disagreement).
  - **(b) Static empty is a correct classification, not a wiring gap — do NOT pull wave 4
    forward to fill it.** ADR 0029's named Static cases (`card-mediaqueries`, `form-colorgraph`,
    `form-textbox`, `form-spinbutton`, and by the same reading a migrated `module-scrollarea`)
    hold their unanswerable reads in client-only positions, so they fold totally. The tier is
    real but rare by construction: unanswerable expressions in a *served* position with no
    realm-answerable sibling signal. The cost argument survives without a Static corpus member —
    Folded and Static are both never simulated, so `module-scrollarea`'s ~2.3 s is not paid
    either way. Wave 4 stays gated on LT-178/LT-179 (owner sequencing). Because Static may stay
    empty until wave 4, **step 4's acceptance gains a synthetic Static-tier emit fixture** (see
    the amended step 4) so the skeleton emit path is exercised before a real member exists.
  - **(c) `composeReadTags` is the right reading.** A compose-site `ref` attr IS ADR 0029 s3's
    "`first()` addressing a compose site" (resolved to a synthetic ref by
    `analysis/compose-refs.ts`), and a `pass` attr is its "`truc:pass` into it" — the
    implementation matches the ADR clause clause-for-clause.
  - **(d)** Confirmed deliberate and correct for steps 1–3; step 5 removes the overlap.

- [ ] LT-169: Wire the simulation driver into the docs build for Simulated-tier components (ADR 0027 stage 2). **Depends on LT-165.**
  **Skill:** docs-server-dev
  **Context:** [**Rewritten 2026-09-04 against ADR 0029**; originally "wire the driver in for
  every corpus component", then re-scoped to "Simulated-tier only" under a two-tier model. The accepted
  model is THREE tiers: only **The Simulated tier** goes through the driver. **The Folded tier** renders through
  `emit-server.ts` + the `runtime.ts` value harness with no jsdom involvement, and **The Static tier**
  renders the static skeleton and is likewise never simulated — that last bucket is where most
  of the cost saving lives, since `module-scrollarea` alone is ~2.3 s of the measured ~3.9 s and
  the realm cannot answer it. The wiring must therefore read the classifier's tier (LT-165) and
  open a realm for the Simulated tier ONLY; opening one for the Static tier is the specific waste ADR 0029 exists to
  prevent, and it would not be caught by any correctness test.] The consolidated obligations from four prior reviews, carried forward unchanged because
  they don't depend on the tiering question: (1) **Disposal is build-process scope, not
  test-file scope** — `dispose()` at most once, after every render the build will ever do, never
  between; a disposed realm's deleted globals turn a contained component's lingering
  dependency-wait into a synchronous `customElements is not defined` flood that aborts the
  process. (2) **The build report surfaces through `reportDiagnostics`** — the same partition
  the tests read; zero-unclassified is the build's own gate, the classified `getContext` entry
  stays listed with its reason, and the report copy is final (Tech Writer, 2026-09-03). (3)
  **The fixed-point gate's placement decides** — the corpus test carries it today and
  auto-extends; the wiring may either keep it test-only or run a second connect per render at
  build time; per-render doubles simulation cost for Simulated-tier components and is NOT required for
  correctness while the corpus test exists, so the default is test-only unless a stage-2 finding
  says otherwise. (4) **The memoization's transferred acceptance lands here** — measure the
  simulated build stage's wall time (the LT-096/LT-103 handoffs record their before/after
  figures) and verify the render cache engages, now scoped to Simulated-tier occurrences only. (5)
  **Per-substrate goldens posture holds** — the build serializes with jsdom; if the substrate
  ever swaps, the snapshot re-baseline is expected and is not a behavior change. **Resolved from LT-171
  (ADR 0029 s8):** there is NO per-request SSR story to honor — the driver stays build-time
  tooling (ADR 0024 s7 unchanged) and LT-166's memoization needs no server-scoped analogue. If a
  per-request path is ever wanted, the Folded tier and the Static tier are already per-request-cheap and only
  the Simulated tier would need a cache with an eviction policy; do not build one now. **Also from ADR 0029
  s7:** the CI equivalence audit (LT-165 step 8) runs an unconditional simulation pass over
  Folded-tier components — that is a CI cost, deliberately NOT paid by this build. Do not let the two
  get merged into one pass. Acceptance: the build runs the driver over Simulated-tier
  `server/generated/tsrx/` components only — with an assertion that no realm is opened for a
  Static-tier or Folded-tier component — a new build-report entry fails the build naming the component,
  disposal is provably end-of-build, and the wall-time/cache-engagement figures are recorded in
  the handoff and split by tier, including the Static-tier saving as a separate figure.

- [ ] LT-180: Surface library-contained connect failures in the simulation realm's diagnostics.
  **Skill:** docs-server-dev
  **Context:** Found and mutation-verified while pinning LT-177 item 2 (NOTES.md, 2026-09-04,
  resolved into this task). A component that throws during `connectedCallback` inside the realm
  is contained by ADR 0028 and reported through `reportConnectFailure` — which writes to the
  **host** console, not jsdom's `virtualConsole` — so `realm.diagnostics` stays empty and a
  Simulated-tier component silently degrades to skeleton serialization: the build serves wrong
  HTML with no signal. The `component-throw` diagnostic kind already exists in the realm's
  channel, so the wiring is intended; only throws the library contains itself bypass it.
  ADR 0029 makes this urgent rather than cosmetic: once LT-169 wires the driver into the build,
  a silent connect failure is silently wrong served HTML — and the CI equivalence audit
  (ADR 0029 s7) cannot catch it, because the audit compares Folded-tier output, not connect
  failures. **Land with or before LT-169.** Fix shape is open: capture the host console during
  the realm's load/render window, or route `reportConnectFailure` through a channel the realm
  subscribes to — if the fix wants a library-side channel or a new diagnostic class (an
  ADR 0028 surface change), escalate back to architect first. **Channel:** the build report
  (`sim/report.ts`), NOT the compile-warning channel — a connect throw is a dynamic execution
  failure, not a statically-detectable source issue, so it can never be a converging warning.
  **Tier:** 3 (Escalated) — error-level, failing the build and naming the component, matching
  LT-169's existing build-report gate. No new runtime check and no new diagnostic kind is
  introduced, so no TSRX code moves; if copy is touched anyway, Tech Writer reviews it.
  Acceptance: a component throwing in `connectedCallback` inside the realm yields an
  error-level diagnostic in `realm.diagnostics` naming the component; removing the wiring
  fails a test (pin the negative — the vacuous-assertion trap LT-177 documented is the failure
  mode to avoid); the LT-177 realm tests' marker-attribute assertions stay green;
  `bun test server` green.

## Wave 4 — example migrations

**Note added 2026-09-04:** the phase-1/phase-2 tiering decision (LT-171) doesn't block starting
this wave. [**Updated 2026-09-04, LT-171/ADR 0029:** the zero-warning gate STANDS — routing
signals (TSRX004/TSRX034-non-severe/TSRX043) leave the warning channel entirely, so a migration
that trips them is not accruing warnings, it is being classified. Judge a migration on: zero
warnings in the diagnostic channel, plus its recorded TIER and the reason.] [**Updated 2026-09-04 (owner sequencing):** wave 4 additionally gates on LT-178/LT-179 — the deprecated-surface removals land on a separate branch first, so no migration authors against forms that are about to disappear.] LT-096/LT-103's perf-trigger notes (below) are about whether they push
page chrome into the simulated corpus at all; that's still meaningful under tiering (a
phase-1-only component migrating in adds ~nothing; a phase-2 component adds real jsdom cost),
so keep recording the wall-time figures either way — and note that a **Static-tier** result (layout
reads, `internals`-only output, stubbed sensors) also adds ~nothing, because it is never
simulated. Under ADR 0029 only the Simulated tier costs jsdom time.

- [ ] LT-095: Migrate basic-blogmeta by reshaping it into a template owner with typed byline props (LT-033 decision).
  **Skill:** le-truc-dev
  **Context:** **Design decided 2026-08-29 (checkpoint resolved):** fully-typed props, NO arbitrary pass-through (mediaqueries precedent) — `author` (string), `avatar` (optional URL string), `published` (datetime string), `modified` (optional datetime string), `reading-time` (optional number, minutes). The component's template re-emits ALL the schema.org microdata the old light DOM carried — `itemprop="author"`/`itemscope`/`itemtype="https://schema.org/Person"`, `datePublished`, `dateModified`, and `<meta itemprop="timeRequired" content="PT{n}M">` derived from the reading-time prop — with the avatar `<img>` behind an `@if` on the avatar prop and the modified span a conditional branch on prop presence. Author-supplied arbitrary siblings inside `<basic-blogmeta>` are dropped; consumers port to props. Locale formatting and invalid-date handling expressed via setup consts (server-safe, the `fn2Digits` precedent). Consumers to port: `examples/basic/blogmeta/basic-blogmeta.html` (rewrite to attribute-configured usage), `server/effects/pages.ts` (`emitBlogCards` emits `<basic-blogmeta author="…" avatar="…" published="…" modified="…" reading-time="…">`), `docs-src/layouts/blog.html`, the examples.md demo markup. Cutover is same-commit per the canonical pattern (LT-092): delete the `.ts` twin, point `examples/main.ts` at the generated client, drop any CEM exclusion, keep the blog pages rendering correctly (Playwright blog specs or a real-browser check). **Depends on LT-142** (owner decision, 2026-09-02): the locale date formatting this reshape is built around folds server-side only once `Intl` is foldable with a server-known locale — do not hand-roll around it.

- [ ] LT-096: Migrate `module-codeblock` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** Smallest hand-written example (~43 lines). Migrate `examples/module/codeblock/module-codeblock.ts` → `.tsrx` following the corpus precedents and TSRX-HOST-PROFILE.md. Cutover is same-commit per the canonical pattern (LT-092): delete the `.ts` twin, point `examples/main.ts` at the generated client, drop any CEM exclusion, keep the demo/spec green against the served compiled component. Surface compiler gaps in NOTES.md — or fix them directly if small (LT-088 precedent) — never weaken the component to dodge a gap. **Known pre-existing bug to fix during this migration (LT-117 review):** the twin calls `copyToClipboard(code, copy, {...}` bare — the `EffectDescriptor` is created and discarded, so the copy-click listener never attaches (label stays "Copy" on click; verified at HEAD). Per AGENTS.md it needs registration — `watch(() => true, copyToClipboard(...))` or returning it — and a spec assertion that click actually copies/toggles the label (verify via clipboard or button-text state). **Perf trigger (LT-166), 2026-09-03:** this component is one of the two that move page chrome into the simulated corpus (299 occurrences in the built docs, and together with the other ~91% of the measured 3.9 s full-site simulation cost). Record the simulated build stage's wall time before and after this migration in the handoff. [Amended by the LT-166 review, 2026-09-03: nothing left to schedule as a trigger — record the wall-time figures and verify the render cache is actually engaging. **Amended again, 2026-09-04 (LT-171/ADR 0029):** also record which of the THREE tiers this component lands in once LT-165's classifier exists — Folded and Static both mean near-zero added cost regardless of occurrence count; only the Simulated tier opens a realm. Its `first('code')`/`first('button.overlay')`/`first('basic-button.copy')` refs predict the Simulated tier, but its ~299 occurrences make that ~0.33 s, not a blocker.]

- [ ] LT-097: Migrate `module-cem-list` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~39 lines, an `each()` loop over CEM manifest data. Migrate per the canonical pattern (see LT-096). Watch for: loop body reactive attrs on non-root children (the LT-037 fix), selector uniqueness among repeated items.

- [ ] LT-098: Migrate `module-colorinfo` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~86 lines, color info display. Migrate per the canonical pattern (see LT-096); culori usage follows the `asOklch.ts`/`_common` setup point (modes must be registered there, LT-091 finding 3).

- [ ] LT-099: Migrate `module-pagination` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, pagination controls. Migrate per the canonical pattern (see LT-096); has a spec — keep it green against `/test/module-pagination`.

- [ ] LT-100: Migrate `module-catalog` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, component catalog. Migrate per the canonical pattern (see LT-096); has a spec — keep it green against `/test/module-catalog`.

- [ ] LT-101: Migrate `module-dialog` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~75 lines, native `<dialog>` + `showModal()` orchestration. Migrate per the canonical pattern (see LT-096); has a spec. Watch for: `dialog.` method calls from client-only setup statements (LT-069 gate), focus-related event handlers as bare `on()` statements.

- [ ] LT-102: Migrate `module-splitview` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~77 lines, pointer-capture drag between panes. Migrate per the canonical pattern (see LT-096). Watch for: `setPointerCapture`/`PointerEvent` client-only ambients (LT-069 widened `JS_GLOBALS` for exactly this class of code).

- [ ] LT-103: Migrate `module-scrollarea` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~104 lines, scroll area with `IntersectionObserver`. Migrate per the canonical pattern (see LT-096); has a spec. Watch for: effect-with-cleanup idiom (`watch` + `return () => observer.disconnect()`, the LT-069 acceptance case). **Perf trigger (LT-166), 2026-09-03:** this component is one of the two that move page chrome into the simulated corpus (2,091 occurrences in the built docs, and together with the other ~91% of the measured 3.9 s full-site simulation cost). Record the simulated build stage's wall time before and after this migration in the handoff. [Amended by the LT-166 review, 2026-09-03: nothing left to schedule as a trigger — record the wall-time figures and verify the render cache is actually engaging. **Amended again, 2026-09-04 (LT-171/ADR 0029):** this component's tier is now PREDICTED, and it drove the ADR's three-tier shape. It reads `scrollLeft`/`scrollTop`/`scrollWidth`/`offsetWidth`/`scrollHeight`/`offsetHeight` and emits exclusively through `bindState(internals, …)` — layout returns zeros under jsdom and `attachInternals()` is normalized to throw, so the realm cannot answer it and it classifies **The Static tier**: never simulated, static skeleton, client corrects at connect. At 2,091 occurrences that is ~2.3 s of the measured ~3.9 s NOT paid. Verify the classifier actually reaches that conclusion during this migration — if it lands the Simulated tier instead, the second conjunct (`sim/patch-table.ts` lookup, ADR 0029 s1) is not wired correctly, and no correctness test would catch it. **[Amended 2026-09-04 (LT-165 review / ADR 0029 Context correction): the Static prediction above is superseded — the geometry reads live in scroll/observer callbacks and the `bindState(internals, …)` output never reaches served HTML, so under the corrected predicate the EXPECTED tier is FOLDED (Static also acceptable, same never-simulated saving). Simulated is now the outcome to investigate: at 2,091 occurrences it reproduces the ~2.3 s this ADR exists to avoid, so either reshape the migrated component so its reads stay in client-only positions (per its demonstrated patterns) or surface the over-signal in NOTES.md. Record the actual tier + reason + wall-time figures either way; only wrong served HTML is a correctness bug.]**]

- [ ] LT-104: Migrate `module-lazyload` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~114 lines, `createTask` async loading. Migrate per the canonical pattern (see LT-096); has a spec + mocks (served under `/test/module-lazyload/mocks/...`, resolved from the component dir's `mocks/`). Watch for: async boundary shape — this is one of the few real `@try`/`@pending`/`@catch` consumers alongside `form-listbox` (fieldset auto-wrap, LT-077/086); tree-shaking interplay with LT-078.

- [ ] LT-105: Migrate `module-coloreditor` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~120 lines, color editing UI. Migrate per the canonical pattern (see LT-096); culori usage follows the `_common` setup point. If it composes other form components multiple times, use the static-attr discriminator addressing (LT-087/089/090).

- [ ] LT-106: Migrate `context-media` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~142 lines, the context-protocol example (`provideContexts` + `requestContext`, LT-035's compiled precedents exist in the corpus). Migrate per the canonical pattern (see LT-096). Watch for: context effects' server-side rendering semantics; no spec exists — verify on `/test/context-media` in a real browser.

- [ ] LT-107: Migrate `module-listnav` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~129 lines, navigation list. Migrate per the canonical pattern (see LT-096). Also ports `examples/module/listnav/module-listnav.test.ts` — a unit test file — to run against the compiled artifact (or the served page, matching the corpus's spec conventions); mocks served under `/test/module-listnav/mocks/...` stay working.

- [ ] LT-108: Migrate `module-carousel` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~161 lines, `each()` items + `IntersectionObserver` autoplay gating. Migrate per the canonical pattern (see LT-096); has a spec. Combines the LT-097 loop concerns with the LT-103 cleanup idiom.

- [ ] LT-109: Migrate `module-calctable` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~200 lines, the heaviest `reconcile()` consumer (8 call sites). Migrate per the canonical pattern (see LT-096); reactive lists lower to the compiled `each()`/reconcile path (LT-003) — check loop-body reactive attrs on non-root children (LT-037) carefully. **Note:** formats numbers through `Intl`; LT-142 settles whether those thunks fold server-side (Folded-tier) or need pre-play (Simulated-tier, per LT-171). Read that rule before authoring, rather than re-deciding it here.

- [ ] LT-110: Migrate `module-ticker` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~283 lines, the most loop-dense example (`each()` ×11, `MutationObserver` ×6, `IntersectionObserver`, `populate`). Migrate per the canonical pattern (see LT-096). Expect this to stress the loop/effect analysis hardest — surface compiler gaps in NOTES.md rather than restructuring the component away from its demonstrated patterns. **Note:** formats through `Intl`; see LT-142/LT-171 for the tiering question, same as LT-109.

- [ ] LT-111: Migrate `module-todo` to `.tsrx` with same-commit cutover — last hand-written example, completes the corpus port.
  **Skill:** le-truc-dev
  **Context:** ~379 lines, the largest example (`reconcile()` ×10, `each()`, pointer capture). Migrate per the canonical pattern (see LT-096); has a spec. Completing this task satisfies LT-014's trigger (every example outside `test/*` and `docs/*` is then `.tsrx`) — after review, confirm the corpus sweep: no `.ts` component files remain in `examples/` outside `test/`, `docs/`, and `_common` helpers.

## Deferred — cleanup round after the corpus port

- [ ] LT-134: TSRX035 and TSRX042 give opposite advice on the same construct (LT-131 review finding).
  **Skill:** le-truc-dev
  **Context:** TSRX035 (`duplicateIdAcrossArms`) tells the author "Give each arm's element a distinct id" — a static id per arm. TSRX042 (LT-131) then warns on each of those static ids. Both are individually true (TSRX035 is about two ids colliding within ONE instance, TSRX042 about one id colliding across TWO instances) and the server-arg fix satisfies both at once, but neither message says so, and an author fixing TSRX035 as instructed walks straight into TSRX042. No corpus component hits it today. **Fix:** make TSRX035's fix-it name the server-arg shape too — "give each arm's element a distinct id, taken as server args so they stay unique per instance (TSRX042)" — and check whether TSRX038 (`duplicateComposeId`, "Give each site a distinct id") needs the same. Cheap, message-only; the point is that the diagnostic set should not contain a loop.

- [ ] LT-135: Follow plain-const indirection when crediting client-only setup reads (LT-119 sharp edge).
  **Skill:** le-truc-dev
  **Context:** LT-119 credits a signal in `thunkRendered` when a `clientSetup` statement reads it, but the check is `containsSignalGet(stmt.node, …)` on the statement itself. Hoisting the predicate into a plain setup const — `const isOpen = () => open.get(); watch(() => !isOpen(), …)` — moves the read out of the statement and the signal draws TSRX004 again, so the author must repeat the predicate at every site (form-combobox.tsrx does, with a comment saying why). The diagnostic is loud, not silent, and the workaround is one line, so this is a DX wart rather than a correctness gap. **Fix:** resolve reads through `component.plainSetup` consts the statement names, the same one-hop widening `computeClientNeededNames` already does for client-needed names — or fold into LT-093, which is the same free-name-through-a-const wall from the other direction. The negative case is already pinned in `server/tests/tsrx/client-setup-credit.test.ts`; flip that test when fixing. **Note, 2026-09-04:** if LT-171 repurposes TSRX004 as the tier classifier rather than an error, re-check whether this sharp edge still matters the same way — a signal that draws TSRX004 here would now mean "this routes to phase 2," which may make the workaround moot for reasons unrelated to this fix.

- [ ] LT-136: Name the `@for` collection/server-arg shadowing in the tsc failure it causes (LT-119 review finding).
  **Skill:** le-truc-dev
  **Context:** A `@for (const x of items)` loop lowers CLIENT-side to `const items = all('<selector>')` — the loop's collection name becomes a query variable that SHADOWS the server arg of the same name. Setup or `expose()` code that reads the arg then means two different things per half: server `items.length` is the array length, client `items.length` is `undefined` on a `Cell`. **Verified 2026-08-30, and the good news is it is loud:** `expose({ n: () => items.length })` over a `@for (const item of items)` loop compiles with ZERO compiler diagnostics but fails `check:tsrx` with `TS2339: Property 'length' does not exist on type 'Cell<HTMLSpanElement[]>'`, mapped back to the right `.tsrx` line. So this is a message-clarity task, not a correctness hole — same posture as LT-125. The tsc text names `Cell<…>` but never says *why* the author's `string[]` arg became one, and the fix (rename the loop binding, or project the value through `expose()`) is not discoverable from it. **Fix:** detect the collision in the compiler — a `@for` collection name that also names a server arg, where the arg is read outside the loop body — and emit a dedicated diagnostic naming both the shadowing and the rename. Low priority: no corpus component hits it, and the build already stops.

- [ ] LT-138: The `html={}` sanitizer default is inverted between server and client (LT-128 verification finding).
  **Skill:** le-truc-dev
  **Context:** Found while verifying LT-128, and more consequential than the spelling. The two halves of one `.tsrx` source disagree on the default trust posture: `server/tsrx/runtime.ts:335` defaults `htmlSanitizer` to escaping ALL markup (`<`/`>` → entities, so nothing ever renders — safe but inert), while the client's `dangerouslyBindInnerHTML` (`src/bindings.ts:652`) ships NO sanitizer and assigns raw unless `configureHtmlSanitizer()` was called. Both are configurable and both document themselves as "the library owns no sanitizer", but the DEFAULTS point opposite ways. For a reactive `truc:html={() => …}` that means an unconfigured app server-renders escaped, inert text and then flips to live markup on hydration — a visible content change and an inconsistent security posture from one authored attribute. **Unverified:** no corpus component authors the attribute, so this has never run end to end; confirm the flip with a fixture before designing the fix. **Decide:** which default is right (escape-everywhere is the conservative match to the server's current behavior; raw-everywhere matches upstream's trusted-markup framing and the `dangerously` prefix's warning) — then make both halves agree, and make `configureHtmlSanitizer` on one side not silently leave the other unconfigured.
  **Target state (owner, 2026-08-31): seamless Trusted Types.** The API is Baseline 2026, and the client half is already shaped for it — `Sanitizer` returns `string | TrustedHTML` and `dangerouslyBindInnerHTML` assigns through a cast that a Trusted-Types-enforcing CSP accepts (`src/bindings.ts:35`, `:682`). The blocker was TypeScript's DOM lib, and it has NOT lifted yet: `lib.dom.d.ts` in the installed TS 6.0.3 still has no `TrustedHTML` interface (only prose in `document.write`'s doc comment), which is why `src/bindings.ts:32` carries a local `type TrustedHTML = object` placeholder. **Unverified:** whether TS 7 fixes it — the published `typescript@7.0.2` tarball ships no `lib.dom.d.ts` in the old layout, so this needs a real check against however TS 7 delivers its DOM lib before planning. Two things follow if it has landed: drop the placeholder for the real type, and decide whether the SERVER half gets a Trusted-Types-shaped seam too (it produces strings into markup, so it cannot hold a `TrustedHTML`, but it can share one policy-configuration entry point with the client so an app configures trust ONCE rather than per environment — which is the actual fix for the inverted-defaults problem above).
  **How it lands is now answered (LT-152, 2026-09-03) — the trigger is unchanged.** jsdom is in the build regardless of the tiering decision, and DOMPurify's documented Node path (`createDOMPurify(new JSDOM('').window)`) was verified on it: hostile payloads sanitize correctly, re-verified independently at the LT-152 review against a second payload set. So **one sanitizer serves both channels** — DOMPurify server-side through `configureHtmlSanitizer`, DOMPurify client-side — and `sanitize-html` retires. That matters beyond tidiness: two sanitizers with different allowlists mean a `truc:html` value that survives the server's filter can be altered by the client's at connect, i.e. a hydration diff in the one place a hydration diff is a security question. Note `sanitize-html` was never a production dependency — `configureHtmlSanitizer` is called only from `server/tests/tsrx/features.test.ts:25`, and the docs build renders `truc:html` through the escape-all default — so the retirement is small. **ADR 0010's policy is untouched:** the library still ships no sanitizer and the consumer still supplies the hook; this is about what the compiler runtime is configured with, and what the docs recommend. **Owner decision, 2026-09-03: this stays deferred behind the same gate** — before any component actually authors `truc:html`, and nothing does today.

- [ ] LT-093: Make TSRX004 honest for credited-but-unportable signal initializers, then thread initializer free names into client placement (LT-036's wall).
  **Skill:** le-truc-dev
  **Context:** Re-confirmed empirically 2026-08-29 (LT-071 re-evaluation): `const DEFAULT = 'red'; const color = createCell(DEFAULT)` consumed only through a style-map still fires TSRX004's "never rendered" message, though the signal IS credited as rendered (`thunkRendered`) — `substituteArgExpr`'s free-name gate rejects the verbatim initializer because the client module may not define the name. Step 1 (small): split the diagnostic — "rendered but initializer not client-portable" (name the offending free names) vs "never rendered". Step 2 (goal): feed signal-initializer free names into `computeClientNeededNames` as client-needed seed positions so plain-setup and import-local names in initializers place client-side; the fixpoint has grown accretively since the NOTES entry (clientSetup statements, composed refs, pass set-thunks — LT-069/087/088), so the plumbing gap is much narrower than when option (b) was judged heavy. Also fold in a compiler unit test for the `imports.plainLocalNames` badFreeNames widening (LT-090 review note — currently unexercised after the LT-091 redesign removed the corpus's two-way pass). Also fold in the LT-116 NOTES entry: `returnsNumber`'s heuristic misses number-signal reads (`count.get()`) in `value` thunks, which now lack `String()` coercion under the property dispatch — consult `inferredType` so the coercion fires for number-typed signal reads (no corpus offender today; add the unit test). No current migration is blocked by this wall (workaround: inline the constant or add a direct render site) — priority below the component tasks. **Raised in priority by LT-171, 2026-09-04:** once TSRX004 becomes the phase-1/phase-2 classifier rather than an error, an honest "rendered but not client-portable" message matters more than before — a false TSRX004 firing on a fully phase-1-resolvable component would wrongly tier it into phase 2. Re-triage after LT-171 lands.

## Backlog — not scheduled

- [ ] LT-078: Implement conditional branch tree-shaking for `@try`/`@pending`/`@catch` (CHECKLIST §9).
  **Skill:** le-truc-dev
  **Context:** Performance optimization, not a bug fix (LT-065 confirmed current unconditional behavior is already safe). Needs a new usage-graph analysis: shake (emit no client task) only when the resolved value is read nowhere outside its own arm AND the guarding promise depends solely on server-definitive args. `form-listbox.tsrx` is the one real consumer of the async boundary — build fixtures around it, same caution as LT-077.

- [ ] LT-076: Establish a dev-mode signal for generated `.tsrx` client code, then implement the hydration assertion (CHECKLIST §6).
  **Skill:** le-truc-dev
  **Context:** **Architecture decision 2026-08-29:** generation-time inlining. `server/build.ts`/`server/effects/tsrx.ts` gain a dev/prod mode from the build pipeline (the docs site's examples bundle ships dev diagnostics today — `build:examples:js` already defines `DEV_MODE='"true"'` — so site/dev builds pass dev-mode ON; a prod site build flips it off), pass it to the compiler as a `devMode` option, and the compiler INLINES the folded constant into generated client modules. Generated code must never reference `process.env` (bundler-agnostic, constant-folded at generation, same philosophy as the library's own `--define`). With that signal in place, implement CHECKLIST §6's hydration assertion: on upgrade, recompute each folded expression and `console.warn` on mismatch — emitted only under the generation-time dev flag and folded away entirely otherwise.

- [ ] LT-014: Type-flow diagnostics — Volar language-core plugin over the LT-011 span table (ADR 0024 milestone 4, stage 2).
  **Skill:** le-truc-dev
  **Context:** Blocked on trigger: every example outside `test/*` and `docs/*` is cut over to its compiled client — that means LT-111 (module-todo, the last hand-written module example) AND LT-114..LT-117 finishing the five currently dual-state components (basic-number, basic-gauge, basic-pluralize, form-radiogroup, basic-button). CLI-first (LT-011, done) covers CI/agent workflows; this adds in-editor squiggles via a `@volar/language-core` plugin projecting the generated client module, reusing LT-011's span table.

---

## Done (archive)

Full task-by-task rationale, review notes, and corpus-impact numbers for everything below have been compacted out of this file; see git history (`git log -p -- TODO.md`) for the original entries if needed.

**ADR 0027 stage-1 implementation (2026-09-03, CLOSED — all reviewed; ADRs 0024/0027 accepted on this basis):** LT-154 (server-simulation driver — jsdom substrate, hermetic-quiescence boundary replacing strict synchronicity, children-first replay from the compose graph, load-once-per-module assertion), LT-163 (build-report channel — five diagnostic conditions raised as Simulated-tier/Contained build warnings attributed per-component: jsdomError, unhandled rejection, contained connect throw, network access, non-quiescent drain overrun; `getContext` classified as a documented non-issue), LT-164 (per-substrate simulated goldens plus the two-order hermeticity and double-connect fixed-point invariants, both as `bun test server/tests` cases), LT-166 (render memoization on `(component, markup)`, landed ahead of its 1.0 s trigger by explicit owner request — 93.5% measured hit rate at docs scale), LT-167 (driver polish — stale network-stub doc, probe drain dedup, three fixture-artifact ARGS fixed, `check:sim` output attributed), LT-168 (reconciled the compile-warning baseline to the tool-counted **8 unique** standing warnings — six `basic-pluralize` TSRX034 correct refusals, `form-listbox` TSRX034, `form-tokenbox` TSRX039 — correcting a "cleared six, leaving 2" mis-record that never held on this branch; added a counted summary line to `check:tsrx` **[re-counted 2026-09-04 at the LT-165 review: the tool reports 7 unique at both LT-165's head and base commit — the `form-tokenbox` TSRX039 listed here was closed by LT-146 and does not stand; read the tool count, not this line.]**). LT-153 (the architect's compiler-consequences plan that produced LT-163/164/165/166 and re-scoped the gate wave) is superseded in its "zero is the target"/"delete evaluability.ts at stage 3" halves by the 2026-09-04 phase-1/phase-2 tiering decision — see the Sequencing section and LT-171.

**Gate wave (2026-09-03/04, CLOSED except LT-147/LT-148/LT-170, tracked above):** LT-143 (`basic-pluralize` renders correctly under simulation for count values 0/1/2/3/5/11 — the six standing TSRX034 refusals confirmed correct and left untouched), LT-133 (`basic-number` renders the formatted value under simulation; `basic-gauge.html`'s hand-authored `84%`/`65%`/`20.57%` fallback text removed — the last figure was itself inconsistent with its own `options`, corrected to `20.6%` by removing the workaround), LT-144 (`{host.count}`/`{count}` converge on identical initial HTML under simulation; the remaining binding-plan difference — one plans a live `watch()`, the other is a compile-time literal substitution — is real and documented, but the test pinning it was weak; strengthening it is LT-170), LT-145 (`form-listbox`'s Parser-exposed-`filter`-prop-with-no-server-arg fallback pinned under simulation — a pure runtime pin, does not move the compile baseline; an arithmetic error in the task's own acceptance text was corrected by the architect review, not by chasing a follow-up fix), LT-146 (`form-tokenbox.description`'s TSRX039 duplicate-channel warning closed — final shape is `description: descriptionEl?.textContent ?? ''` handed straight to `expose()`, which auto-wraps any plain function/value into a reactive cell; no `data-description` attribute or explicit `createCell`/`asString` needed, simpler than the `form-combobox` `descriptionCell` pattern it was originally modeled on, which is itself now a candidate for the same simplification).

**TSRX compiler bring-up (ADR 0024 milestones 1–4):** LT-001/002 (compiler core + client codegen), LT-005 (isomorphic form-component format), LT-006 (CEM generation parity), LT-003 (reactive lists via `reconcile()`), LT-004 (Volar projection — infeasible, reshaped into LT-011), LT-008 (form-corpus migration enablers), LT-013 (tsrx.dev feature parity — `@switch`/`@try`/`html={}`), LT-011 (CLI-first span-table diagnostics, editor-level deferred to LT-014).

**Composition & children (ADR 0024 sub-design 10):** LT-015 (server-side PascalCase composition), LT-016 (`pass={{ }}` unified prop dispatch), LT-017 (two-way `pass()` codegen), LT-018 (`{children}` insertion), LT-019 (type-check generated server modules), LT-020 (module-list/form-textbox real composition).

**Async boundaries & control flow:** LT-012 (`isPending` routing, residue → LT-025), LT-023 (optional `@if`, hoisted handler consts), LT-024 (widened arg→DOM substitution), LT-025 (reactive `html={}`, `@try` addressing, `createMemo` — found LT-050).

**Example migrations, round 1:** LT-026 (`examples/basic/*`, found LT-027), LT-027 (`freeIdentifiers` TS type-position fix), LT-033 (`examples/card/*` — surfaced 3 genuine cliffs, now LT-071), LT-034 (plain-import placement inference), LT-035 (context protocol — `requestContext`/`provideContexts`).

**Bindings & reactive maps:** LT-030/029 (map-form `bind*()` overloads, merged), LT-028 (`style-map` AttributeIR, gaps → LT-031/032), LT-031 (`class-map` → `bindClass` array-form), LT-032 (root-level `class-map` exemption), LT-036 (style/class-map credited as harvest sites), LT-037 (`plain-imports.ts` traces `'server'`-kind attrs), LT-038 (`watch()` auto-wraps lazy-child thunks).

**Compiler regrouping (M1–M7):** LT-039 (`ir.ts`), LT-040 (`core.ts`), LT-041 (shared predicates → `ast-utils.ts`/`spans.ts`), LT-042 (`walk.ts` visitor), LT-043 (`evaluability.ts`), LT-044 (import handling, removed `node:path` — browser-purity gate), LT-045 (browser-bundle smoke test), LT-046 (remaining walks reviewed, won't-do), LT-021/LT-022 (`compiler.ts`/`analyze.ts` split into locality-focused modules), LT-047/LT-048 (direct unit tests for `evaluability.ts`, `loops.ts`/`naming.ts`), LT-049 (deleted dead `diagnostic.withLine`), LT-050 (`configureHtmlSanitizer()`).

**CHECKLIST.md triage (2026-08-26), conformance & ergonomics:** LT-051 (reactive-lift analysis, TSRX017), LT-052 (removed `&{}` sigil, TSRX018–020), LT-053 (`pass` → `truc:pass`), LT-054 (hard errors + codemod for near-miss React JSX, TSRX021–024), LT-055 (`ref={}` → `first()`, TSRX025–027), LT-056/LT-057 (`form.ts` reset-ordering + `defaultValue` baseline fix), LT-058 (TSRX028 — managed form member shadow), LT-059 (TSRX029 — named inner control), LT-060 (reconciled `form-textbox.revised.tsrx`, found the `@if` union-addressing bug), LT-061 (TSRX033 impure-fold rule, gap → LT-075), LT-063 (hydration — live-property harvest for dirty-flag attrs, assertion → LT-076), LT-064 (TSRX035 duplicate-id-across-arms, fieldset fix → LT-077), LT-065 (tree-shaking preconditions verified safe by omission, optimization → LT-078), LT-066 (TSRX030–032 authoring lint rules), LT-067 (docs pointed at tsrx.dev/llms.txt; eval re-run left as a manual user action), LT-068 (`TSRX-HOST-PROFILE.md` authored).

**2.5.1 form-reset release (shipped 2026-08-27):** LT-072 (ported form-reset fix to `bugfix/form-reset-baseline` off `next`, PR #119), LT-073 (form-docs consistency pass), LT-074 (changelog entry). Tagged `v2.5.1`; `next`/`package.json` now at `2.6.0`.

**Authored-import policy (ADR 0024 sub-design 16, re-amended 2026-08-27):** LT-079 (required explicit FactoryContext imports — superseded same day, highlighting rationale failed empirically), LT-080 (host-profile roster doc fix), LT-081 (migrated 53 test fixtures to the real-export import rule), LT-082 (sub-design 16 implementation itself — `REAL_EXPORT_NAMES`, scope-aware TSRX036/037, per-name import placement — reviewed ✓ 2026-08-29), LT-084 (rewrote host-profile's import section for the sub-design 16 policy).

**LT-127 review (architect, 2026-08-30):** Approved, committed as `59bcf3a3`. Read the `compose-refs.ts`/`first-refs.ts`/`plan.ts` diffs independently and re-ran the gates rather than trusting the handoff: server 1182/1182, `check:tsrx` 22/22 with the 18-warning baseline unchanged, tsc clean. The pass-split is the right shape — deferring a selector that names a custom-element tag is the only sound answer inside single-file `compileSource`, since rejecting there rejects a selector about to resolve. The three constraints in the handoff are all real and I confirmed the reasoning on the first: the discovery pass DROPS any file it errors on, so an error there is not a louder warning, it is a silent skip. Reviewer fix applied directly: TSRX027's message now says the discriminating attribute goes on the COMPOSE SITE, not inside the child, with an example — the handoff's own check (3), and the one place the message could send an author to edit the wrong file. On check (1): a typo'd raw custom-element selector now reports TSRX026 from pass 2 rather than pass 1 — same code, same message, later line, and `check:tsrx` still fails. Accepted; the ir.ts field docstring records it. On check (2): `analyzeClient` is called once per `compileComponent` and each call re-parses (verified — no other caller in `server/` or `scripts/`), so the IR mutation is sound; it is a layering wrinkle, not a bug, and the alternative (threading the registry into the front end) is the thing this task deliberately avoided. Not blocking, filed instead: LT-132 (two `first()` names matching one element silently drop the second — pre-existing since LT-055, widened by this task).

**Composed addressing (ADR 0024 sub-design 10, 2026-08-29/30):** LT-087 (`first()` widened to composed elements by resolved child tag + compose-site static attrs — design changed mid-implementation, approved), LT-089 (multiple same-source composed instances discriminated by a static `class`/`id`/`data-*`; client half sound, missing server half filed as LT-090), LT-090 (compose-site `class`/`id` materialized on the child's server-rendered root via `composeHostAttrs`), LT-127 (composed-element `ref={}` retired outright — compose sites are addressed by `first('<child-tag>.<discriminator>')` like any other element, resolved in the registry-aware second pass; LT-087's raw-AST pre-scan deleted with it).

**Client-setup gate & the form-colorgraph acceptance case:** LT-069 (client-setup free-name gate widened to element locals and effect helpers), LT-070 (first migration attempt — partial, split to LT-088), LT-088 (re-attempt, gated on LT-089, blocked on LT-090), LT-091 (first real-DOM coverage for a composed-ref component), LT-071 (deferred component-shape questions re-evaluated 2026-08-29, split into LT-093/094/095).

**`@try` arm inertness (CHECKLIST §8):** LT-077 (non-active arms auto-wrapped in `fieldset[disabled]`), LT-086 (`:has()`-based addressing replaced with a browser-baseline-safe alternative).

**Server folds & host-derived evaluability:** LT-085 (server-fold rule widened to derived `host.<prop>` thunks; TSRX034 escalated to an error for `disabled`/`checked` on real form controls).

**Site cutover and its remediation (2026-08-29/30):** LT-092 (docs site serves compiled `.tsrx` components instead of hand-written twins; folds in LT-094; remediation filed as LT-112/113, four stopped cutovers spun into LT-114..116), LT-112 (children-are-data harvesting restored, ported demos/specs re-swept), LT-113 (`form-textbox`'s `description` made writable, `module-coloreditor`'s reach-in reverted), LT-114 (root lazy text children get a client `bindText`), LT-115 (arg→DOM substitution no longer freezes reactivity; illegal root self-query fixed), LT-116 (loop-body boolean dirty-flag attrs lower to property writes), LT-094 (folded into LT-092).

**Enhancer-mode removal and the default-path capabilities it needed (2026-08-30):** LT-121 (server ref-stub crash — every harvesting component's `render*()` threw), LT-122 (`{arg}` sites gain the client binding when the arg names an exposed prop; TSRX039), LT-123 (site-inferred `first()` cardinality, TSRX026 required-only, TSRX008 bare root), LT-117 (`config.enhancer` and every enhancer-only branch deleted; `basic-button`'s harvest contract re-expressed in the default template-owning path).

**Addressing-surface correctness, wave 1 (2026-08-30, CLOSED):** LT-130 (two ref-addressed elements in one `@if` branch no longer rejected), LT-131 (a template-owning component can render a per-instance unique `id`; found LT-133/LT-134), LT-132 (two `first()` names matching ONE element now diagnosed as TSRX041 rather than silently dropping the second — pre-existing since LT-055, exposed by LT-127). All three landed in `bf054a70`, architect-reviewed. LT-118 (`form-spinbutton`'s zero-state affordance restored; premised on wrong assumptions, corrected mid-flight — found LT-129/LT-130 and two latent bugs), LT-124 (class discriminators emitted as token selectors `span.label` rather than exact-match `[class="label"]`, with `matchesSelector` as the load-bearing half; extended to `#id` — found LT-131).

**Data-account debt on the migrated corpus, wave 2 (2026-08-30/31, CLOSED):** LT-119 (`form-listbox.visibleOptions` readonly prop; form-combobox's popup-visibility gate restored through it rather than by counting the child's option buttons — required widening TSRX004's render credit to `clientSetup` reads, and static template defaults plus client-only `watch`es because a ref-reading predicate in a JSX attribute is silently OMITTED from the served HTML, TSRX034), LT-120 (`form-textbox.focusControl()` and `form-listbox.focusFirstOption()` retire the last two `querySelector` reach-ins; native `focus()` deliberately NOT shadowed). Both reviewed and committed as `47ce2ab5`; follow-ups LT-135/LT-136 deferred to the cleanup round.

**`html={}`'s future (LT-128, decided 2026-08-31):** the premise the task was filed on turned out to be false — there is no upstream `{html expr}` keyword in `@tsrx/core` 0.1.60 or 0.1.63, nor in `@tsrx/ripple` or `ripple`. Core delegates raw markup to the host ("use each target framework's native raw HTML prop"), and the reference host answers with a literal `innerHTML` attribute. So the attribute is host-owned and earns the prefix: **`truc:html`**. `innerHTML` was rejected as the spelling despite being the convergent one, because Le Truc sanitizes rather than assigning raw — borrowing the DOM name would promise semantics we deliberately do not have. Implementation is LT-137; the sanitizer-default inversion found while verifying is LT-138. Recorded in TSRX-HOST-PROFILE § "When an attribute earns the `truc:` prefix".

**Parser pin moved 0.1.60 → 0.1.63 (2026-08-31):** reviewed change per ADR 0024 sub-design 2. TSRX split out of the Ripple repo into `tsrx-org/tsrx`, and most of the release range is that de-Rippling; the one behavioral change is that `&{…}`/`&[…]` lazy destructuring patterns now raise in expression position, which Le Truc does not author. Golden tests unmoved (corpus output byte-identical), full gate suite green.

**Diagnostic honesty, wave 3 (2026-08-30/09-01, CLOSED):** LT-125 (TSRX043 — a `first()`-derived setup local spliced into the server render; the task's premise was corrected mid-flight, since the silent-empty-render half was already reachable whenever the ref was also named inside `expose()`), LT-129 (TSRX039 no longer fires on the sanctioned host-attribute override — excluded per SITE, not per prop, so a genuinely independent second channel still warns), LT-126 (`returnsNumber` resolves number-signal reads through `inferredType`; the string-signal negative pinned too), LT-075 (TSRX033 widened to static/server-rendered attribute literals, ERROR to match `impureStaticChild`), LT-137 (`html={}` → `truc:html={}` per LT-128; bare `html` is a hard error, not a silent reclassification, and four phantom parser hints naming constructs that exist in no published TSRX release were deleted while `switch`/`await` were kept and reworded), LT-139 (the LT-129 exclusion extended to text children — `walkTemplate` already passed the parent, so the task overestimated the work), LT-141 (TSRX039 exempts a `formAssociated()` host's reset baseline while the root actually carries the attribute; unique warnings 9 → 8).

**ADR 0027 engine gaps and spikes (2026-09-03, CLOSED — all four reviewed):** LT-149 (factory-run errors contained in `connectedCallback`; ADR 0011's branded contract errors deliberately still escape — `TrucError`/`TrucTypeError` + `isContractError()`), LT-150 (an unusable `ElementInternals` stub routes to the same `internals = null` degradation as a throw, gated on `formAssociated` because spec-correct browsers throw `NotSupportedError` on non-form-associated elements — worth ~1000 characters of correct markup, 2274 → 3302), LT-151 (`server/tsrx/sim/` — the declarative patch table, two-phase realm, and boundary assertion; portable across Bun/Node/Deno, re-verified byte-identical on Bun and Node at review, and honest about an absent runtime rather than falsely passing), LT-152 (substrate evaluation — **jsdom confirmed, happy-dom disqualified**: DOMPurify fails open on it, independently re-verified at review against a second payload set where it also ships a live `<svg><animate onbegin>` handler and mangles benign markup; fidelity at parity otherwise; cost measured at 3.9 s full-site / ~0.1 s stage-1 on jsdom; memoization answered YES at a 93.5% hit rate). `happy-dom` was dropped from `devDependencies` on owner instruction, 2026-09-03, once the review noticed that installing a *disqualified* substrate had downgraded the hoisted `entities` from 8.0.0 to 7.0.1 (happy-dom pins `^7.0.1`), pushing parse5 — jsdom's own parser — onto a nested copy. `bun.lock` is now byte-identical to its pre-LT-152 state. The harness was kept and made to degrade rather than deleted: `substrateAvailable()` in `scripts/lib/substrate-probe.ts` resolves the import optionally, and `eval:substrate` runs every section's jsdom half one-sided while naming what is missing and why.

**`Intl` server-fold rule (LT-142, landed 2026-09-02, reviewed ✓ 2026-09-03):** `IMPURE_AMBIENT_ROOTS` splits `Intl` from `Date` — `Intl.*` folds when its locale resolves to a server-known value, `Date` stays impure, `Math.random()` untouched. **Reconciled by LT-168 (2026-09-03):** the rule's own six-warnings-cleared claim never held on this branch — `check:tsrx` at LT-142's own commit already reported the full 8-unique baseline; the six were slated for LT-143's reshape, which LT-153 superseded before it ran. The six are correct refusals (the fold cannot follow the authored `pluralCategory` const, cannot resolve the `getLocale(el)` call, cannot fold the `hasAttribute` DOM sensor) and the rule itself works as its unit tests prove. **Its service-life question is superseded by the 2026-09-04 tiering decision** — see LT-171/LT-165 — rather than resolved by the old "retires at stage 3 with TSRX034" plan.

**LT-153 — the TSRX-compiler consequences plan (architect, 2026-09-03, DELIVERED — since partially superseded, 2026-09-04):** the deferred inventory, executed: diagnostics moved from compile time to build time (`TSRX005` dissolved, `TSRX034` became a report, `TSRX039` survived); the regression signal became two baselines; goldens byte-pin what's emitted and behavior-pin what's simulated, per-substrate; `evaluability.ts`'s deletion was checkpointed at stage 3; LT-142's rule was given a service life. Produced LT-163/LT-164/LT-165/LT-166 and re-scoped LT-143/LT-133/LT-144/LT-145. **The "zero is the compile target" and "delete evaluability.ts" halves are superseded by the phase-1/phase-2 tiering decision** (Sequencing section, LT-171) — the rest (build-report channel, golden strategy, TSRX039's survival) stands unchanged.

**Tiered error surfacing (ADR 0028, 2026-09-03, CLOSED):** LT-155 (containment model — contract brand deleted, containment unconditional, activation split per descriptor), LT-156 (connect-failure phase label and reconnect asymmetry, landed with LT-155), LT-157 (the four owed compiler rules), LT-158 (exposed-prop writability in the TSRX registry, so `pass()` legality is decidable at compile time), LT-159 (Tech Writer took ownership of error-message copy in `src/errors.ts` and `server/tsrx/diagnostics.ts` — reviewed with one correction), LT-160 (`references/errors.md` added to the `le-truc` skill), LT-161 (`le-truc-dev` and `architect` taught when to involve Tech Writer), LT-162 (error-message lifecycle workflow added to the `tech-writer` skill).

**Test-gate reliability (2026-09-02, CLOSED):** LT-140 (golden tests emit into per-run sibling directories instead of the real `server/generated/tsrx/`, ending the concurrent-writer race; exposed and fixed two tests that had been passing on stale artifacts). The residual flake it uncovered — `file-watcher.test.ts`'s 5 s debounce poll starving under load — was pre-existing and unrelated, and was addressed the same day.
