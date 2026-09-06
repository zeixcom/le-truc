# TODO

Prioritized task queue, highest band first. Within a band, work top to bottom unless a task
names its own dependency.

**Where the history went.** Everything landed and reviewed has been removed from this file
(architect, 2026-09-06). The rationale for what shipped lives in `adr/` (0024, 0026–0030),
`ARCHITECTURE.md`, `server/tsrx/LE_TRUC_COMPILER.md` and `TSRX-HOST-PROFILE.md`; the
user-facing summary lives in `CHANGELOG.md` `[Unreleased]`; the task-by-task record lives in
`git log -p -- TODO.md`. Do not re-derive a decision from a task entry — read the ADR.

**Standing framing** (ADR 0029, accepted 2026-09-04). Server evaluation is three tiers:
**Folded** (phase 1 resolves it; string folding, no jsdom), **Simulated** (phase 1 cannot
complete AND the realm can answer; pre-played in jsdom), **Static** (neither; static skeleton,
the client corrects at connect). Tier is per **component**; unresolvability is per
**expression** — an impure ambient read (`Date.now()`, `Math.random()`) is omitted in every
tier and is not a routing signal. The compile-warning baseline's target is **zero**: routing
signals ride the tier census on `sim/report.ts`, not the diagnostic channel. Judge a migration
on zero warnings *plus* its recorded tier and reason.

**Next free task ID: LT-183.**

---

## P0 — Format spike (gates P5; parallel-safe with P1/P2)

- [ ] LT-183: TSX surface spike — decide `.tsrx` vs `.tsx` compiler surface. **Plan: `TSX_SPIKE.md`.**
  **Skill:** le-truc-dev
  **Context:** The 2026-09-06 architecture review concluded the compiler machinery
  (analysis, emitters, simulation, tiering) is format-independent while the surface
  (`.tsrx` grammar on a pinned `@tsrx/core`) carries the mounting costs: broken editor
  support, the React-near-miss diagnostic family, pin churn, emit-then-check type flow.
  A time-boxed spike on branch `spike/tsx-surface` re-targets the compiler front end onto
  the TypeScript parser (stand-alone core; no Babel; `sim/` stays out of its import
  graph — decisions §2 of the plan) and ports `basic-counter`, `basic-pluralize`,
  `form-combobox` + `form-listbox`, diffing server renders **byte-wise** against the
  existing `.tsrx` goldens. §7 records probe-verified facts (TS 6.0.3 parses and
  type-checks `truc:pass` namespaced JSX attributes; function-valued attributes and IIFE
  arms check under `--strict`). **Gates wave 4:** do not start LT-095–LT-111 before the
  go/no-go — a surface switch after migrating 21 more components would double the churn.
  On GO, an ADR supersedes ADR 0024's surface sub-designs; on NO-GO, TSRX stands with
  evidence. Read the plan; it is self-contained.

---

## P1 — Tiered server evaluation (critical path)

- [ ] LT-165: Implement the ADR 0029 tier classifier, and split TSRX013. — **steps 1–5 done and reviewed (step 5 reviewed ✓ 2026-09-06); steps 6–8 open.** Next up: step 6.
  **Skill:** le-truc-dev
  **Context:** ADR 0029 is accepted; this is its implementation. Read the ADR, not this
  summary, for the rationale. Steps 1–3 landed in `a2e789e4` and were reviewed and approved
  (2026-09-04): `TSRX013` is now three codes (`TSRX044` conditional signal constructor,
  `TSRX045` deferred collector call, `TSRX013` scoped to its two server-evaluation factories);
  `server/tsrx/tier.ts` carries `classifyTier`/`resolutionOf`/`stubbedApiRead`/
  `contaminateComposeReads`; `sim/patch-table.ts` gained `CAPABILITY_PATCHES`;
  `evaluability.ts` gained `impureAmbientCauses`; routing signals, `tier`, `routingSignals`
  and `composeReadTags` are threaded through the analysis contexts and onto `RegistryEntry`,
  with the compose fixpoint applied corpus-wide in `server/effects/tsrx.ts`. The measured
  corpus split is **19 Folded / 3 Simulated / 0 Static**, ruled correct at review: the tier
  routes which mechanism produces the *served HTML*, so a `first()` read confined to
  `watch()`/`on()` positions is a client concern and does not route. Static being empty is a
  correct classification, not a wiring gap — the tier is rare by construction and stays empty
  until wave 4.

  Remaining scope, ordered:
  4. **`emit-server.ts` takes a tier flag.** — done ✓ (landed `ce3ebd10`, with LT-182)
     One emit path; every component still gets a render module, because the realm parses it as
     input. A Simulated-tier or Static-tier module drops the parts of the `@{ }` setup its own
     markup does not need, under one criterion: **retain a setup statement when the emitted
     markup depends on its declared name, transitively; drop the rest.** Plain consts, folded
     signals and `expose()` all fall out of it rather than being special-cased. The Folded
     path is unchanged (the option defaults to `'folded'`), and the server goldens did not
     move. Landed with LT-182, which corrected the rule; ADR 0029 s4 and
     `LE_TRUC_COMPILER.md` § 5.4 carry the rationale in main text, and `ce3ebd10` carries the
     implementation record.
     **A coverage gap to close in wave 4, not before:** `check:tsrx` type-checks each module
     at its OWN classified tier, and the Static census is empty, so the build type-checks the
     Static emit path nowhere. `emit-tier.test.ts`'s "dropped ⇒ name absent" assertion stands
     in for it and covers all 22 × 3 combinations, which `tsc` does not. Wave 4's first real
     Static component closes it for free.
  5. **Diagnostic reclassification per ADR 0029 s5's table.** — reviewed ✓ (2026-09-06)
     `TSRX004`, `TSRX034` (non-severe), `TSRX043`, `TSRX013`'s two server-evaluation
     factories and the reactive `TSRX033` warning left the diagnostic channel; the
     compile-warning baseline is **0** (was 7 standing warnings: 6 on basic-pluralize,
     1 on form-listbox). The retired codes stay in the union as census provenance — the
     `RoutingSignal` origins in `tier.ts` cite them. The severe `TSRX034` error survives,
     scoped to the Static tier via a post-`classifyTier` filter in `index.ts` (the error gate
     moved after tier computation). Impure-ambient reactive reads are now silent —
     unresolvability (s1 limb b), not a warning; the static-child/attribute `TSRX033` errors
     remain. The synthetic Static fixture is re-pinned through the HARVEST path (an unrendered
     signal with an impure initializer — the shape step 4's note said could not compile), the
     impure-`hidden` route kept as a second pin, both controls updated. LT-142's `Intl` rule
     was already split three ways in steps 1–3; basic-pluralize stays Simulated, its six
     standing `TSRX034` warnings gone with the channel (LT-173 will flip the tier pin to
     Folded). `Date` analysed and decided per ADR 0030 s2: `new Date(y, m, d)` stays impure
     (the build-machine TIMEZONE is limb-b ambient state), `Date.UTC(y, m - 1, d)` admitted as
     pure — LT-095's prescribed blogmeta shape is foldable when that migration lands. Four
     decisions the table left open — including the new **`TSRX046`** (rendered client-only
     const: the one residue that stays an error, now precisely scoped to rendered sites) —
     are recorded in `NOTES.md` (2026-09-06); Tech Writer reviewed the retired copy with the
     errors.md/docs sweep. Two enabling fixes keep the retired shapes sound instead of
     silently broken: `emit-client.ts` declares unharvested signals verbatim (the realm
     replays that module), and the suppression pool in `emit-server.ts` excludes statements
     the harness cannot evaluate (the retention text-match would otherwise retain them via
     word collisions).
     **A fact steps 6–8 still carry forward:** emit receives the **PRE-contamination** tier
     (`index.ts` classifies; the corpus compose fixpoint runs afterwards in
     `server/effects/tsrx.ts`). So `form-combobox` — Simulated purely by `compose-read` — is
     emitted on the Folded path, and the census must decide WHICH tier it records; ruled
     acceptable for emit, but "a Simulated module drops setup" is true of the classifier, not
     of every module the corpus finally labels Simulated.
     **Review (2026-09-06):** Approved. Gates re-run independently: `bun test server`
     1418 pass / 0 fail, `check:tsrx` green with the compile-warning baseline read as **0**
     from its counted summary line. Of the four NOTES decisions: the `TSRX046`
     rendered/not-rendered split and the `Date.UTC` admission are accepted as landed
     (both match ADR 0029 s5 / ADR 0030 s2's rationale); the suppression-pool exclusion is
     accepted with one correction — the pool excludes client-only primitives and ref names
     only, NOT `host`/`internals` as NOTES claimed; those stay in the pool and are
     neutralized instead by the `refStub` any-stubs (harmless dead code) plus `TSRX046`
     when rendered, so do not "fix" the code to match the deleted NOTES wording. The
     severe-`TSRX034` component-tier edge is ruled a real gap against the ADR's own
     rationale — follow-up **LT-184**.
  6. **The tier census** rides `sim/report.ts` (LT-163's channel), recording per component its
     tier and the reason. It is NOT a warning — the compile-warning baseline's target stays
     zero (ADR 0029 s6), and `check:tsrx`'s counted summary line reports the two separately.
     LT-173 step 4's translation census adopts this surface; define it so a second census can
     ride it without a parallel channel.
  7. **Realm-side suppression for unresolvable expressions.** The generated client is the
     shipped artifact, so the realm cannot decline to install a binding: record each
     unresolvable expression's target site at compile time and revert those sites in the
     driver before serializing. **Ordering is load-bearing** — it must run AFTER the
     fixed-point gate's second connect pass (ADR 0027 s8), never between the two, or the gate
     compares a suppressed tree against an unsuppressed one and reports a spurious failure.
     `module-ticker` is the corpus case to pin (Simulated, `Math.random()` suppressed,
     everything else simulated) once migrated.
  8. **The CI equivalence audit** (ADR 0029 s7) — render every Folded-tier component through
     the realm as well, require byte-identical output, fail against the component on
     divergence. This is what makes two coexisting mechanisms defensible; it is not optional
     and not a follow-up. Audit scope is the 19 Folded components; its CI cost is bounded by
     corpus size (~4 s), not by the tier split. The known `Date.now()` disagreement between
     `IMPURE_AMBIENT_ROOTS` and ADR 0027 s6 is DISSOLVED by steps 5+7, not resolved by
     electing a winner: neither mechanism can answer it, so it renders in neither.

  Step 5's retirement copy was reviewed by Tech Writer at landing (ADR 0028 lifecycle);
  TSRX044/TSRX045's own propagation is done (LT-181).
  Acceptance: the classifier assigns a tier to every corpus component with a recorded reason
  and golden coverage; the synthetic Static fixture pins the skeleton emit path;
  `basic-counter`/`module-tabgroup`/`card-blogpost`/`card-callout` classify Folded; no
  `Date`/`Math.random()` reading expression renders a value in ANY tier; the equivalence audit
  runs green in CI; the compile-warning count is zero and the tier census is reported
  separately; `bun test server` green.

- [ ] LT-184: Scope the severe TSRX034 error per-expression instead of per-component (ADR 0029 s5 edge from the step-5 review).
  **Skill:** le-truc-dev
  **Context:** Step 5 implemented "severe `TSRX034` survives, scoped to the Static tier"
  literally: `index.ts` drops every severe `TSRX034` error unless `classifyTier` routed the
  whole component `static`. That reading fails for one shape the ADR's rationale doesn't
  cover: a severe site whose OWN resolution is `none` (unresolvable in every tier, e.g.
  `disabled={() => Date.now() < deadline}` — a time-window submit lockout) on a component
  routed Simulated by some OTHER realm-answerable signal. There the ADR's premise ("on the
  Simulated tier the value is resolved and the diagnostic is noise") is false — the value is
  still omitted, so "enabled and submittable regardless of author intent" ships silently on
  a submittable control. No corpus component hits the edge, but the shape is plausible.
  Fix: fire the severe error iff the SITE's routing signal carries
  `resolution.by === 'none'` (the resolution is already computed in `analysis/effects.ts`
  and carried on the signal), regardless of component tier. Sound without a tier check: a
  `none` resolution can never exist on a Folded-tier component (the routing signal itself
  would have made it non-Folded), so this matches the ADR's rationale AND lets the error
  gate return to its position before tier computation, removing that ordering dependency.
  The filter is the single post-`classifyTier` block in `index.ts`; the push site is
  `analysis/effects.ts`.
  **Channel:** unchanged — same code, same Tier 3 error placement; only the firing
  condition narrows. **Copy:** the current message asserts "this component routes to the
  Static tier", which becomes false in the newly covered case (Simulated-tier component,
  unresolvable site) — reword to state the site-level fact ("no server phase can resolve
  this value in any tier"). Tech Writer reviews the reworded copy per the ADR 0028
  lifecycle.
  Acceptance: the edge shape (severe site with `none` resolution on a component that also
  carries a realm-answerable routing signal) produces the error; a realm-answerable severe
  site on a Simulated-tier component stays silent (pin BOTH directions — the vacuous
  assertion is the failure mode); the error gate position change doesn't reorder any other
  diagnostic's visibility; `bun test server` green.

- [ ] LT-180: Surface library-contained connect failures in the simulation realm's diagnostics. **Land with or before LT-169.**
  **Skill:** docs-server-dev
  **Context:** A component that throws during `connectedCallback` inside the realm is contained
  by ADR 0028 and reported through `reportConnectFailure` — which writes to the **host**
  console, not jsdom's `virtualConsole` — so `realm.diagnostics` stays empty and a
  Simulated-tier component silently degrades to skeleton serialization: the build serves wrong
  HTML with no signal. The `component-throw` diagnostic kind already exists in the realm's
  channel, so the wiring is intended; only throws the library contains itself bypass it. Found
  and mutation-verified while pinning LT-177. ADR 0029 makes this urgent rather than cosmetic:
  once LT-169 wires the driver into the build, a silent connect failure is silently wrong
  served HTML — and the CI equivalence audit cannot catch it, because the audit compares
  Folded-tier output, not connect failures. Fix shape is open: capture the host console during
  the realm's load/render window, or route `reportConnectFailure` through a channel the realm
  subscribes to. If the fix wants a library-side channel or a new diagnostic class (an ADR 0028
  surface change), escalate to architect first.
  **Channel:** the build report (`sim/report.ts`), NOT the compile-warning channel — a connect
  throw is a dynamic execution failure, not a statically-detectable source issue, so it can
  never be a converging warning. **Tier:** 3 (Escalated) — error-level, failing the build and
  naming the component. No new runtime check and no TSRX code moves; if copy is touched
  anyway, Tech Writer reviews it.
  Acceptance: a component throwing in `connectedCallback` inside the realm yields an
  error-level diagnostic in `realm.diagnostics` naming the component; removing the wiring fails
  a test (pin the negative — the vacuous-assertion trap LT-177 documented is the failure mode
  to avoid); the LT-177 realm tests' marker-attribute assertions stay green; `bun test server`
  green.

- [ ] LT-169: Wire the simulation driver into the docs build for Simulated-tier components (ADR 0027 stage 2). **Depends on LT-165.**
  **Skill:** docs-server-dev
  **Context:** Only **Simulated**-tier components go through the driver. Folded renders through
  `emit-server.ts` + the `runtime.ts` value harness with no jsdom involvement, and Static
  renders the static skeleton and is likewise never simulated — that last bucket is where most
  of the cost saving lives, since `module-scrollarea` alone is ~2.3 s of the measured ~3.9 s.
  The wiring must read the classifier's tier and open a realm for Simulated ONLY; opening one
  for a Static- or Folded-tier component is the specific waste ADR 0029 exists to prevent, and
  no correctness test would catch it. Consolidated obligations from four prior reviews:
  1. **Disposal is build-process scope, not test-file scope** — `dispose()` at most once, after
     every render the build will ever do, never between. A disposed realm's deleted globals
     turn a contained component's lingering dependency-wait into a synchronous
     `customElements is not defined` flood that aborts the process.
  2. **The build report surfaces through `reportDiagnostics`** — the same partition the tests
     read; zero-unclassified is the build's own gate, the classified `getContext` entry stays
     listed with its reason, and the report copy is final (Tech Writer, 2026-09-03).
  3. **The fixed-point gate's placement decides** — the corpus test carries it today and
     auto-extends. Per-render doubles simulation cost for Simulated-tier components and is NOT
     required for correctness while the corpus test exists, so the default is test-only unless
     a stage-2 finding says otherwise.
  4. **The memoization's transferred acceptance lands here** — measure the simulated build
     stage's wall time and verify the render cache engages, scoped to Simulated-tier
     occurrences only.
  5. **Per-substrate goldens posture holds** — the build serializes with jsdom; a substrate
     swap means an expected snapshot re-baseline, not a behavior change.
  There is NO per-request SSR story to honor (ADR 0029 s8): the driver stays build-time tooling
  (ADR 0024 s7) and LT-166's memoization needs no server-scoped analogue. Do not merge this
  pass with LT-165 step 8's CI equivalence audit — that audit's unconditional Folded-tier
  simulation is a CI cost, deliberately not paid by this build.
  Acceptance: the build runs the driver over Simulated-tier `server/generated/tsrx/` components
  only — with an assertion that no realm is opened for a Static- or Folded-tier component — a
  new build-report entry fails the build naming the component, disposal is provably
  end-of-build, and the wall-time/cache-engagement figures are recorded in the handoff and
  split by tier, including the Static-tier saving as a separate figure.

---

## P2 — Internationalization (ADR 0030)

- [ ] LT-173: Implement the reserved `i18n` parameter and the catalog pipeline. **Depends on LT-165.**
  **Skill:** le-truc-dev
  **Context:** ADR 0030 is accepted; read it rather than this summary. The LT-165 dependency is
  wider than step 6: step 4's translation census has no channel to ride until LT-165 step 6
  defines the tier census on `sim/report.ts`, and step 4 ADOPTS that surface rather than
  defining a parallel one. Scope, ordered:
  1. **The reserved parameter.** `i18n` joins `children` as a compiler-supplied server arg
     (ADR 0024 s10's mechanism, reused — do not invent a second one). A component receives it
     only by declaring it; callers never pass it. Record shape: `lang`, `t`, `timeZone`,
     `currency`, `dir`. It must be an ordinary destructurable arg so it is server-known and
     folds in phase 1.
  2. **Precedence.** An authored `lang` arg, or a `lang` at a compose site, overrides the
     record. The EFFECTIVE locale renders onto the root `lang` attribute. Confirm no new
     TSRX039 exemption is needed — ADR 0024 s3's root-attribute exclusion should already cover
     it; if it does not, escalate rather than patching.
  3. **Catalog pipeline** — format, per-locale loading, key resolution at render time,
     staleness detection. New build surface with no prior art in this repo; keep it in
     `server/effects/` alongside the other build effects. Source-locale strings are declared
     INLINE in the `.tsrx` beside their keys — there is deliberately no per-component catalog
     file, since that reintroduces the sibling-file drift ADR 0024 cures. Translations are
     additive per-locale override files, component-namespaced: `i18n/de.json` with keys
     `<tag>.<key>`. **No tiering, no override stack** — a key resolves in exactly one place; do
     not add a global or page layer without reopening the ADR. **Staleness is the subtle part:**
     a source-string edit is a `.tsrx` edit that silently invalidates that key's translations,
     so detection must notice a moved source string, not just an absent key.
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
     Writer owns the copy** (new TSRX code; `workflows/error-message-lifecycle.md`).
  6. **Verify the tiering payoff.** With a server-known locale, `Intl` folds (LT-142) and
     `basic-pluralize` should become Folded-tier eligible, dissolving its six standing TSRX034
     warnings. If it does not, either the fold rule or the classifier is wrong — investigate
     rather than accepting Simulated. `basic-blogmeta` is **hard-blocked on LT-095**, not merely
     coordinated: it has no `.tsrx` until that migration, so its date-handling fix and fold
     verification cannot land here. Record blogmeta's fold as deferred to LT-095, whose text
     already carries the expectation and the fix (`Date.UTC(y, m - 1, d)` with `timeZone: 'UTC'`
     — never shifts the day, reads no ambient state; ADR 0030 s2).
  7. **Per-locale pruning of rendered alternatives** (ADR 0030 s6). A component rendering one
     alternative per plural category prunes to the locale's actual set — `{one, other}` for
     English instead of all six. Read the set from
     `Intl.PluralRules(lang, opts).resolvedOptions().pluralCategories`, NOT a hand-maintained
     table (same posture as ADR 0024 s4's ARIA mapping). Cardinal and ordinal differ, so prune
     by the configured `type` and fall back to their union when it can't be proven.
     **The client-side `hidden` toggles do NOT retire** — the locale is fixed but `host.count`
     is a reactive prop, so the category still changes at runtime and the client can only select
     among strings the server rendered. Removing the toggles would freeze every pluralized
     string at its initial count. Pin this with a fixture that changes `count` after connect.
  Acceptance: a component declaring `i18n` receives it with no caller change; an authored `lang`
  overrides the record and renders as the root attribute; a missing key renders the source
  string and appears in the census, not the warning stream; an untranslated literal warns;
  `basic-pluralize` classifies Folded, renders two category spans on an `en` page, and still
  re-selects correctly when `count` changes after connect; the build writes no tracked file;
  `bun test server` green.

- [ ] LT-175: Measure and contain the per-locale impact on LT-166's render cache (exploration). **Depends on LT-173.**
  **Skill:** docs-server-dev
  **Context:** A measurement round before designing anything — the direction of the net effect
  is genuinely unknown, which is why it is a spike and not an obligation buried inside LT-174.
  Pulling one way: per-locale rendering multiplies the corpus (~3,700 occurrences → N × 3,700)
  and LT-166's `(component, locale, markup)` memoization now varies by locale, so the measured
  **93.5% hit rate will drop**. Pulling back: ADR 0030's Folded-tier promotion means i18n
  components stop being simulated at all, and per-locale pruning (LT-173 step 7) shrinks the
  markup that is the cache key. **Measure, don't estimate:** hit rate and simulated-stage wall
  time at 1 locale vs. 2, split by tier, with and without pruning. Then decide whether
  containment is needed at all and what shape it takes (locale in the key vs. a locale-invariant
  key for components that don't consume `i18n`; the latter looks promising since most components
  won't declare the parameter, but confirm rather than assume). Record the figures in the
  handoff — ADR 0030's consequences section says explicitly that nobody has measured the net.

- [ ] LT-174: Per-locale page rendering for the docs site (ADR 0030 s1). **Depends on LT-173 and LT-175.**
  **Skill:** docs-server-dev
  **Context:** Path-prefix routing (`/de/guide`, `/en/guide`), one SSG page per locale, locale
  fixed before rendering begins. **The build-time-constant property is load-bearing, not an
  infrastructure preference** — it is what lets `Intl` fold and keeps i18n components on the
  Folded tier; a request-time locale would unfold every `Intl` call and push the whole i18n
  corpus to Simulated. **Perf obligation:** re-measure when the second locale lands and record
  the figure — it partially offsets ADR 0029's Static-tier savings. LT-175 is that measurement
  and lands first.

---

## P3 — Gate-wave residue (independent of P1/P2; parallelizable)

- [ ] LT-170: Strengthen two gate-wave assertions in `gate-wave-verification.test.ts` that don't test what they claim.
  **Skill:** docs-server-dev
  **Context:** Filed by the LT-144/LT-145 review (2026-09-03). Two tests in
  `server/tests/tsrx/gate-wave-verification.test.ts` pass today but don't verify the behavior
  their name/comment claims — a regression in the underlying compiler behavior would fail
  neither.
  1. **`'the reactive spelling plans a client binding the static spelling does not'`** (line
     ~220) only asserts `hostVariant.spans`/`bareVariant.spans` are truthy — true of any
     compiled component. Fix: assert on the actual compiled `clientCode`, e.g.
     `hostVariant.clientCode` contains a `watch(...host.count...bindText(` call and
     `bareVariant.clientCode` does not (confirmed by hand at review: the distinction is real and
     present today).
  2. **`'composed under form-combobox, initial render stays hermetic'`** (line ~263) only
     asserts the string `<form-listbox` appears in the composed output — trivially true.
     `form-combobox` composes its listbox with `filterable={false}`, so there is no clear button
     to check; the acceptance-relevant behavior is the other known composed-filter case from the
     LT-154 review (the combobox's selected-but-`hidden` inner option is authored `truc:pass`
     filter wiring). Assert the first option renders both `aria-selected="true"` AND `hidden=""`
     in the initial (pre-`truc:pass`) render, matching `sim-driver.test.ts`'s own corpus
     snapshot for `form-combobox`.
  Acceptance: both tests fail if the underlying compiled/rendered behavior regresses;
  `bun test server/tests` stays green.

- [ ] LT-147: Lower reactive `aria-*` on element targets to `bindAria()`, with a reverse IDL name table.
  **Skill:** le-truc-dev
  **Context:** Owner decision, 2026-09-02. About which binding helper the compiler emits, not
  about server-execution tiering. v2.6 added `bindAria()` (ADR 0026) and the compiler does not
  know about it: all 7 reactive ARIA bindings in the corpus lower to `bindAttribute` with a
  **compiler-synthesized `String()`** — `String(selected.get() === pid)` (module-tabgroup),
  `String(host.value === optValue)` (form-listbox), `String(parseOklch(host.value).h ?? 0)`
  (form-colorgraph) — precisely the hand-rolled coercion ADR 0026 §2 exists to remove.
  **Fix:** lower a reactive `aria-*` attribute on an element target to
  `watch(<thunk>, bindAria(el, '<idlName>'))`, dropping the synthetic `String()` and letting the
  helper apply ARIA's own coercion (boolean → `'true'`/`'false'`, number → decimal, `nil` →
  clear). **Two hard constraints.**
  1. The attribute→IDL mapping is a **lookup table, not a transform**: ARIA attribute names
     carry no inner hyphens, so `aria-valuenow` gives no clue where the camel hump falls
     (`ariaValueNow`). Build the table by enumerating `ARIAMixin`'s names and applying the
     library's own forward rule (`ariaAttributeName`, `src/bindings.ts:512`) — do not
     hand-maintain a second list that can drift from the platform.
  2. `ARIAMixin` splits into **44 string-valued props and 8 element-reference props**
     (`ariaActiveDescendantElement`, `ariaControlsElements`, `ariaDescribedByElements`,
     `ariaDetailsElements`, `ariaErrorMessageElements`, `ariaFlowToElements`,
     `ariaLabelledByElements`, `ariaOwnsElements`) that take `Element`/`Element[]`. An IDREF
     *string* must NEVER be routed to one — `aria-describedby="x"` is not
     `ariaDescribedByElements`. Map string-valued props only; leave the IDREF attributes on
     `bindAttribute`. All of the corpus's IDREF ARIA is server-static today, so nothing
     regresses.
  Acceptance: the 7 sites lower to `bindAria` with no `String()`; the golden clients update; all
  842 Playwright example specs stay green (they assert on the ARIA *attributes*, which native
  reflection still mirrors for element targets); the post-ADR-0029 zero-warning gate holds (use
  the gate, not a hand-maintained expected count).

- [ ] LT-148: Route the component's OWN host ARIA to `internals`, and diagnose CSS that depends on host ARIA attributes. **Depends on LT-147's mapping table.**
  **Skill:** le-truc-dev
  **Context:** Owner decision, 2026-09-02. Per ADR 0026 §1, host semantics belong on
  `internals.aria*`: invisible in markup, unclobberable by framework attribute rewriting, and
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
  selectors do. **Zero corpus sites exercise either half today**, so write both fixtures first;
  this is a forward-looking guard in the LT-125/129 posture.
  **Carried from LT-177.** (1) This task owns the serialization pin LT-177 deferred: a corpus
  fixture whose root `aria-*` binding serializes WITH the attribute under simulation — LT-177's
  realm-level test pins the mechanism only, and a `.tsrx` fixture was meaningless before any
  root ARIA binding existed. (2) Under simulation `internals` is now non-null for
  non-form-associated components, so an imperative `internals.states.add(…)` in a factory throws
  a `TypeError`; route custom states through `bindState()`, which capability-probes and no-ops
  on skeletal internals.
  Acceptance: a root `aria-*` thunk lowers to the internals form; a host `[aria-*]` style
  selector warns; the three child selectors stay silent; the simulation serialization pin holds;
  the zero-warning gate holds.

---

## P4 — v3.0 deprecated-surface removal (separate branch; gates wave 4)

**Owner sequencing, 2026-09-04:** both removals run on a **separate branch**, and land **before
any wave-4 migration** (LT-095–LT-111) so migrated twins and newly generated clients never
target the removed forms. ROADMAP § "Dead ends: deprecated in 2.x, removed in 3.0" already
declares both; these tasks implement it. The Cause & Effect 2.0 re-export surface rewrite is a
separate track, blocked on CE 2.0 shipping — out of scope here.

- [ ] LT-178: Remove the `pass()` unrestricted-write short forms (ADR 0012 removal).
  **Skill:** le-truc-dev
  **Context:** ADR 0012 scheduled removal for the next major; the major is in pre-release
  (3.0.0-next.1) and the DEV_MODE warning still fires in `swapSlots`
  (`src/helpers/reactive.ts`). Delete the property-key and bare-writable-signal input forms from
  `PassedProps` handling and `toSignal` resolution — the thunk (read-only) and `{ get, set }`
  descriptor (mediated) forms remain the only inputs. ADR 0012's status records the examples as
  already migrated; sweep `examples/`, `test/`, and `docs-src/` for stragglers anyway.
  **Retires a DEV_MODE deprecation warning — Tech Writer reviews the copy removal** (warning
  message, JSDoc on `pass()`/`PassedProps`, CHANGELOG breaking entry, ROADMAP dead-end
  check-off). Channel note: this retires a check and adds none.
  Acceptance: the short forms are gone from the types and the runtime; nothing warns because
  nothing exists to warn about; `bun test` green; CHANGELOG carries the breaking entry.

- [ ] LT-179: Remove the explicit factory return contract and `forEachUnseen` (ADR 0018 v3.0 milestone).
  **Skill:** le-truc-dev
  **Context:** ADR 0018's v3.0 milestone, still pending at 3.0.0-next.1:
  `watch()`/`on()`/`pass()`/`each()`/`provideContexts()` return `void`;
  `FactoryResult`/`EffectDescriptor` leave the public return contract (`src/types.ts`,
  `index.ts`); the `forEachUnseen` return-reconciliation in `src/component.ts` is deleted, as is
  `each()`'s copy kept only for the v2.3→v3.0 window (ADR 0017). Hand-authored descriptor
  registration remains `watch(() => true, descriptor)` — the only documented path. Sweep
  examples/tests for `return [...]` factories. **Tech Writer reviews the doc touchpoints**
  (AGENTS.md, ARCHITECTURE.md § Effect Descriptors, CONTEXT.md Factory/Effect Descriptor
  entries, CHANGELOG breaking entry).
  Acceptance: helpers return `void`; `FactoryResult` is not exported; a bare-statement helper
  call cannot silently no-op (the collector is the only registration path); `bun test` green.

---

## P5 — Wave 4: example migrations

**Gated on LT-178/LT-179** (owner sequencing). Otherwise unblocked. The canonical pattern is
LT-092's: same-commit cutover — delete the `.ts` twin, point `examples/main.ts` at the generated
client, drop any CEM exclusion, keep the demo/spec green against the served compiled component.
Surface compiler gaps in NOTES.md — or fix them directly if small (LT-088 precedent) — never
weaken a component to dodge a gap. **Per migration, record the tier and the reason** alongside
the zero-warning check; only the Simulated tier opens a realm, so Folded and Static both mean
near-zero added build cost regardless of occurrence count.

- [ ] LT-095: Migrate `basic-blogmeta` by reshaping it into a template owner with typed byline props (LT-033 decision). **Blocks LT-173's blogmeta fold verification.**
  **Skill:** le-truc-dev
  **Context:** Design decided 2026-08-29: fully-typed props, NO arbitrary pass-through
  (mediaqueries precedent) — `author` (string), `avatar` (optional URL string), `published`
  (datetime string), `modified` (optional datetime string), `reading-time` (optional number,
  minutes). The template re-emits ALL the schema.org microdata the old light DOM carried —
  `itemprop="author"`/`itemscope`/`itemtype="https://schema.org/Person"`, `datePublished`,
  `dateModified`, and `<meta itemprop="timeRequired" content="PT{n}M">` derived from the
  reading-time prop — with the avatar `<img>` behind an `@if` on the avatar prop and the
  modified span a conditional branch on prop presence. Author-supplied arbitrary siblings inside
  `<basic-blogmeta>` are dropped; consumers port to props. Locale formatting and invalid-date
  handling expressed via setup consts (server-safe, the `fn2Digits` precedent). Consumers to
  port: `examples/basic/blogmeta/basic-blogmeta.html`, `server/effects/pages.ts`
  (`emitBlogCards`), `docs-src/layouts/blog.html`, the examples.md demo markup.
  **Date handling is prescribed** (ADR 0030 s2, and it is what makes the fold possible): use
  `Date.UTC(y, m - 1, d)` with `timeZone: 'UTC'` in the formatter — never shifts the day, reads
  no ambient state. The current `new Date(year, month - 1, day)` + zone-less
  `Intl.DateTimeFormat` reads the build machine's timezone and must not survive the migration.
  Verify the component classifies Folded once migrated; LT-173 step 6 defers its fold
  verification here.

- [ ] LT-096: Migrate `module-codeblock` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** Smallest hand-written example (~43 lines). **Known pre-existing bug to fix during
  this migration** (LT-117 review): the twin calls `copyToClipboard(code, copy, {...}` bare — the
  `EffectDescriptor` is created and discarded, so the copy-click listener never attaches (label
  stays "Copy" on click; verified at HEAD). Per AGENTS.md it needs registration —
  `watch(() => true, copyToClipboard(...))` — plus a spec assertion that click actually
  copies/toggles the label. **Perf:** this is one of the two components that move page chrome
  into the simulated corpus (299 occurrences in the built docs). Record the simulated build
  stage's wall time before and after, verify the render cache engages, and record the tier. Its
  `first('code')`/`first('button.overlay')`/`first('basic-button.copy')` refs predict Simulated,
  but ~299 occurrences make that ~0.33 s — not a blocker.

- [ ] LT-097: Migrate `module-cem-list` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~39 lines, an `each()` loop over CEM manifest data. Watch for: loop body reactive
  attrs on non-root children (the LT-037 fix), selector uniqueness among repeated items.

- [ ] LT-098: Migrate `module-colorinfo` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~86 lines, color info display. culori usage follows the `asOklch.ts`/`_common`
  setup point (modes must be registered there, LT-091 finding 3).

- [ ] LT-099: Migrate `module-pagination` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, pagination controls. Has a spec — keep it green against
  `/test/module-pagination`.

- [ ] LT-100: Migrate `module-catalog` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, component catalog. Has a spec — keep it green against
  `/test/module-catalog`.

- [ ] LT-101: Migrate `module-dialog` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~75 lines, native `<dialog>` + `showModal()` orchestration. Has a spec. Watch
  for: `dialog.` method calls from client-only setup statements (LT-069 gate), focus-related
  event handlers as bare `on()` statements.

- [ ] LT-102: Migrate `module-splitview` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~77 lines, pointer-capture drag between panes. Watch for:
  `setPointerCapture`/`PointerEvent` client-only ambients (LT-069 widened `JS_GLOBALS` for
  exactly this class of code).

- [ ] LT-103: Migrate `module-scrollarea` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~104 lines, scroll area with `IntersectionObserver`. Has a spec. Watch for: the
  effect-with-cleanup idiom (`watch` + `return () => observer.disconnect()`, the LT-069
  acceptance case). **This component drove ADR 0029's three-tier shape and its tier is the thing
  to verify.** It reads `scrollLeft`/`scrollTop`/`scrollWidth`/`offsetWidth`/`scrollHeight`/
  `offsetHeight` and emits exclusively through `bindState(internals, …)`. **Expected tier:
  Folded** — the geometry reads live in scroll/observer callbacks and the
  `bindState(internals, …)` output never reaches served HTML (Static is equally acceptable; both
  are never simulated, so the ~2.3 s is unpaid either way). **Simulated is the outcome to
  investigate:** at 2,091 occurrences it reproduces the ~2.3 s ADR 0029 exists to avoid — either
  reshape the migrated component so its reads stay in client-only positions (per its
  demonstrated patterns) or surface the over-signal in NOTES.md. Record the actual tier, the
  reason, and the wall-time figures either way; only wrong served HTML is a correctness bug.

- [ ] LT-104: Migrate `module-lazyload` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~114 lines, `createTask` async loading. Has a spec + mocks (served under
  `/test/module-lazyload/mocks/...`, resolved from the component dir's `mocks/`). Watch for:
  async boundary shape — this is one of the few real `@try`/`@pending`/`@catch` consumers
  alongside `form-listbox` (fieldset auto-wrap, LT-077/086); tree-shaking interplay with LT-078.

- [ ] LT-105: Migrate `module-coloreditor` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~120 lines, color editing UI. culori usage follows the `_common` setup point. If
  it composes other form components multiple times, use the static-attr discriminator addressing
  (LT-087/089/090).

- [ ] LT-106: Migrate `context-media` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~142 lines, the context-protocol example (`provideContexts` + `requestContext`,
  LT-035's compiled precedents exist in the corpus). Watch for: context effects' server-side
  rendering semantics; no spec exists — verify on `/test/context-media` in a real browser.

- [ ] LT-107: Migrate `module-listnav` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~129 lines, navigation list. Also ports
  `examples/module/listnav/module-listnav.test.ts` — a unit test file — to run against the
  compiled artifact (or the served page, matching the corpus's spec conventions); mocks served
  under `/test/module-listnav/mocks/...` stay working.

- [ ] LT-108: Migrate `module-carousel` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~161 lines, `each()` items + `IntersectionObserver` autoplay gating. Has a spec.
  Combines the LT-097 loop concerns with the LT-103 cleanup idiom.

- [ ] LT-109: Migrate `module-calctable` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~200 lines, the heaviest `reconcile()` consumer (8 call sites). Reactive lists
  lower to the compiled `each()`/reconcile path (LT-003) — check loop-body reactive attrs on
  non-root children (LT-037) carefully. Formats numbers through `Intl`; read LT-142's fold rule
  and ADR 0029's tier split rather than re-deciding whether those thunks fold.

- [ ] LT-110: Migrate `module-ticker` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~283 lines, the most loop-dense example (`each()` ×11, `MutationObserver` ×6,
  `IntersectionObserver`, `populate`). Expect this to stress the loop/effect analysis hardest —
  surface compiler gaps in NOTES.md rather than restructuring the component away from its
  demonstrated patterns. Formats through `Intl`; same tiering reference as LT-109. **This is
  LT-165 step 7's corpus pin:** Simulated tier with its `Math.random()` expression suppressed
  and everything else simulated.

- [ ] LT-111: Migrate `module-todo` to `.tsrx` with same-commit cutover — last hand-written example, completes the corpus port.
  **Skill:** le-truc-dev
  **Context:** ~379 lines, the largest example (`reconcile()` ×10, `each()`, pointer capture).
  Has a spec. Completing this satisfies LT-014's trigger — after review, confirm the corpus
  sweep: no `.ts` component files remain in `examples/` outside `test/`, `docs/`, and `_common`
  helpers.

---

## P6 — Cleanup round (after the corpus port)

- [ ] LT-093: Make TSRX004 honest for credited-but-unportable signal initializers, then thread initializer free names into client placement (LT-036's wall).
  **Skill:** le-truc-dev
  **Context:** Re-confirmed empirically 2026-08-29: `const DEFAULT = 'red'; const color =
  createCell(DEFAULT)` consumed only through a style-map still fires TSRX004's "never rendered"
  message, though the signal IS credited as rendered (`thunkRendered`) —
  `substituteArgExpr`'s free-name gate rejects the verbatim initializer because the client
  module may not define the name. **Step 1 (small):** split the diagnostic — "rendered but
  initializer not client-portable" (name the offending free names) vs "never rendered".
  **Step 2 (goal):** feed signal-initializer free names into `computeClientNeededNames` as
  client-needed seed positions so plain-setup and import-local names in initializers place
  client-side; the fixpoint has grown accretively (clientSetup statements, composed refs, pass
  set-thunks — LT-069/087/088), so the plumbing gap is much narrower than when option (b) was
  judged heavy. Also fold in a compiler unit test for the `imports.plainLocalNames`
  `badFreeNames` widening (currently unexercised after the LT-091 redesign), and the LT-116
  finding that `returnsNumber`'s heuristic misses number-signal reads (`count.get()`) in `value`
  thunks, which now lack `String()` coercion under property dispatch — consult `inferredType` so
  the coercion fires for number-typed signal reads (no corpus offender today; add the unit test).
  **Raised in priority by ADR 0029:** now that TSRX004 is a routing signal rather than an error,
  a false TSRX004 firing on a fully phase-1-resolvable component wrongly tiers it into
  simulation. Re-triage once LT-165 step 5 lands.

- [ ] LT-135: Follow plain-const indirection when crediting client-only setup reads (LT-119 sharp edge).
  **Skill:** le-truc-dev
  **Context:** LT-119 credits a signal in `thunkRendered` when a `clientSetup` statement reads
  it, but the check is `containsSignalGet(stmt.node, …)` on the statement itself. Hoisting the
  predicate into a plain setup const — `const isOpen = () => open.get(); watch(() => !isOpen(),
  …)` — moves the read out of the statement and the signal draws TSRX004 again, so the author
  must repeat the predicate at every site (`form-combobox.tsrx` does, with a comment saying
  why). The diagnostic is loud, not silent, and the workaround is one line, so this is a DX wart
  rather than a correctness gap. **Fix:** resolve reads through `component.plainSetup` consts
  the statement names — the same one-hop widening `computeClientNeededNames` already does — or
  fold into LT-093, which is the same free-name-through-a-const wall from the other direction.
  The negative case is pinned in `server/tests/tsrx/client-setup-credit.test.ts`; flip that test
  when fixing. **Re-check after LT-165 step 5:** a signal that draws TSRX004 now means "this
  routes to simulation", which may make the workaround moot for unrelated reasons.

- [ ] LT-134: TSRX035 and TSRX042 give opposite advice on the same construct (LT-131 review finding).
  **Skill:** le-truc-dev
  **Context:** TSRX035 (`duplicateIdAcrossArms`) tells the author "Give each arm's element a
  distinct id" — a static id per arm. TSRX042 then warns on each of those static ids. Both are
  individually true (TSRX035 is about two ids colliding within ONE instance, TSRX042 about one
  id colliding across TWO instances) and the server-arg fix satisfies both at once, but neither
  message says so, and an author fixing TSRX035 as instructed walks straight into TSRX042. No
  corpus component hits it today. **Fix:** make TSRX035's fix-it name the server-arg shape too —
  "give each arm's element a distinct id, taken as server args so they stay unique per instance
  (TSRX042)" — and check whether TSRX038 (`duplicateComposeId`) needs the same. Cheap,
  message-only; the point is that the diagnostic set should not contain a loop. **Tech Writer
  reviews the copy.**

- [ ] LT-136: Name the `@for` collection/server-arg shadowing in the tsc failure it causes (LT-119 review finding).
  **Skill:** le-truc-dev
  **Context:** A `@for (const x of items)` loop lowers CLIENT-side to
  `const items = all('<selector>')` — the loop's collection name becomes a query variable that
  SHADOWS the server arg of the same name. Setup or `expose()` code reading the arg then means
  two different things per half: server `items.length` is the array length, client
  `items.length` is `undefined` on a `Cell`. **Verified 2026-08-30, and it is loud:**
  `expose({ n: () => items.length })` over a `@for (const item of items)` loop compiles with
  ZERO compiler diagnostics but fails `check:tsrx` with `TS2339: Property 'length' does not
  exist on type 'Cell<HTMLSpanElement[]>'`, mapped back to the right `.tsrx` line. So this is a
  message-clarity task, not a correctness hole — same posture as LT-125. The tsc text names
  `Cell<…>` but never says *why* the author's `string[]` arg became one, and the fix (rename the
  loop binding, or project the value through `expose()`) is not discoverable from it. **Fix:**
  detect the collision in the compiler — a `@for` collection name that also names a server arg,
  where the arg is read outside the loop body — and emit a dedicated diagnostic naming both the
  shadowing and the rename. Low priority: no corpus component hits it, and the build already
  stops.

- [ ] LT-138: The `truc:html={}` sanitizer default is inverted between server and client (LT-128 verification finding). **Gated: deferred until a component actually authors `truc:html`; none does today.**
  **Skill:** le-truc-dev
  **Context:** The two halves of one `.tsrx` source disagree on the default trust posture:
  `server/tsrx/runtime.ts:335` defaults `htmlSanitizer` to escaping ALL markup (`<`/`>` →
  entities, so nothing ever renders — safe but inert), while the client's
  `dangerouslyBindInnerHTML` (`src/bindings.ts:652`) ships NO sanitizer and assigns raw unless
  `configureHtmlSanitizer()` was called. Both are configurable and both document themselves as
  "the library owns no sanitizer", but the DEFAULTS point opposite ways. For a reactive
  `truc:html={() => …}` that means an unconfigured app server-renders escaped, inert text and
  then flips to live markup on hydration — a visible content change and an inconsistent security
  posture from one authored attribute. **Unverified:** no corpus component authors the
  attribute, so this has never run end to end; confirm the flip with a fixture before designing
  the fix. **Decide** which default is right, then make both halves agree, and make
  `configureHtmlSanitizer` on one side not silently leave the other unconfigured.
  **One sanitizer serves both channels (settled by LT-152, 2026-09-03).** jsdom is in the build
  regardless of tiering, and DOMPurify's documented Node path
  (`createDOMPurify(new JSDOM('').window)`) was verified on it against two hostile payload sets.
  So: DOMPurify server-side through `configureHtmlSanitizer`, DOMPurify client-side, and
  `sanitize-html` retires. That matters beyond tidiness — two sanitizers with different
  allowlists mean a `truc:html` value that survives the server's filter can be altered by the
  client's at connect, i.e. a hydration diff in the one place a hydration diff is a security
  question. The retirement is small: `sanitize-html` was never a production dependency
  (`configureHtmlSanitizer` is called only from `server/tests/tsrx/features.test.ts:25`).
  **ADR 0010's policy is untouched** — the library still ships no sanitizer and the consumer
  still supplies the hook; this is about what the compiler runtime is configured with and what
  the docs recommend.
  **Target state (owner, 2026-08-31): seamless Trusted Types.** The API is Baseline 2026 and the
  client half is already shaped for it — `Sanitizer` returns `string | TrustedHTML` and
  `dangerouslyBindInnerHTML` assigns through a cast a Trusted-Types-enforcing CSP accepts
  (`src/bindings.ts:35`, `:682`). The blocker is TypeScript's DOM lib and it has NOT lifted:
  `lib.dom.d.ts` in the installed TS 6.0.3 still has no `TrustedHTML` interface, which is why
  `src/bindings.ts:32` carries a local `type TrustedHTML = object` placeholder. **Unverified:**
  whether TS 7 fixes it — the published `typescript@7.0.2` tarball ships no `lib.dom.d.ts` in
  the old layout, so check against however TS 7 delivers its DOM lib before planning. Two things
  follow if it has landed: drop the placeholder for the real type, and decide whether the SERVER
  half gets a Trusted-Types-shaped seam too (it produces strings into markup so it cannot hold a
  `TrustedHTML`, but it can share one policy-configuration entry point with the client so an app
  configures trust ONCE rather than per environment — which is the actual fix for the
  inverted-defaults problem).

---

## P7 — Backlog (not scheduled)

- [ ] LT-014: Type-flow diagnostics — Volar language-core plugin over the LT-011 span table (ADR 0024 milestone 4, stage 2).
  **Skill:** le-truc-dev
  **Context:** Blocked on trigger: every example outside `test/*` and `docs/*` cut over to its
  compiled client — that is LT-111 plus the remaining dual-state components. CLI-first (LT-011,
  done) covers CI/agent workflows; this adds in-editor squiggles via a `@volar/language-core`
  plugin projecting the generated client module, reusing LT-011's span table.

- [ ] LT-078: Implement conditional branch tree-shaking for `@try`/`@pending`/`@catch` (CHECKLIST §9).
  **Skill:** le-truc-dev
  **Context:** Performance optimization, not a bug fix (LT-065 confirmed the current
  unconditional behavior is already safe). Needs a new usage-graph analysis: shake (emit no
  client task) only when the resolved value is read nowhere outside its own arm AND the guarding
  promise depends solely on server-definitive args. `form-listbox.tsrx` is the one real consumer
  of the async boundary — build fixtures around it, same caution as LT-077.

- [ ] LT-076: Establish a dev-mode signal for generated `.tsrx` client code, then implement the hydration assertion (CHECKLIST §6).
  **Skill:** le-truc-dev
  **Context:** Architecture decision 2026-08-29: generation-time inlining.
  `server/build.ts`/`server/effects/tsrx.ts` gain a dev/prod mode from the build pipeline (the
  docs site's examples bundle ships dev diagnostics today — `build:examples:js` already defines
  `DEV_MODE='"true"'`), pass it to the compiler as a `devMode` option, and the compiler INLINES
  the folded constant into generated client modules. Generated code must never reference
  `process.env` (bundler-agnostic, constant-folded at generation, same philosophy as the
  library's own `--define`). With that signal in place, implement CHECKLIST §6's hydration
  assertion: on upgrade, recompute each folded expression and `console.warn` on mismatch —
  emitted only under the generation-time dev flag and folded away entirely otherwise.
