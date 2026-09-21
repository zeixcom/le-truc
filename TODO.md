# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-21): opening wave 4 — the last gates cleared, and the
first migrations land.** Drawn from [BACKLOG.md](BACKLOG.md)'s P1, P2b, P3, P4 and P5 bands.
The previous iteration ("the compiler measured, its install story sound, and the last v3.0
deprecation gates cleared") is fully landed and reviewed — LT-266, LT-273, LT-278 and LT-279
are in `DONE.md`, and LT-178 (PR #131) and LT-179 (PR #132) are merged from the removal
branch, so wave 4's original gate is discharged.

**Why these nine.** The last iteration cleared LT-178/LT-179 expressly so this one could
open the wave-4 migrations (P5, the biggest remaining band). Opening the wave is gate work
first, and the gates are serialized in front of the first migration: **LT-238** gates every
remaining migration and LT-237 (the canonical-plus-variants ruling is the owner's call and
must be grilled before any migration lands). **LT-235** runs before LT-212's implementation
per its own sequencing note and lays the IR foundation the ADR 0037 chain and LT-280 both
coordinate against. **LT-212 and LT-213** are the owner-sequenced gates in front of the
FIRST migration; **LT-188** must land before the wave adds composition across tiers (the
first migrated component, module-codeblock, composes basic-button). With the gates
through, **LT-237** gives the spike fixtures a real home and **LT-096** — the smallest
example — proves the wave actually opened: compiled `.tsx`, spec green, tier + reason
recorded. **LT-258** is the one runnable P1 task (the partial-readiness invariant is
checkable now, and LT-257 — template emission, the release mechanism — depends on it), and
**LT-207** is small suite-determinism insurance: the wave runs the test suite constantly
and it currently exits 0-or-1 nondeterministically. Both run in parallel slots at any time
(LT-207 worth doing first). **Deliberately not here:** LT-280's grilling waits for the
iteration that implements it — its gate binds only the wave's final three composites
(LT-109/110/111), and its rulings will be better-informed once LT-235's IR ADR has landed.
The remaining text-shape migrations (LT-095, LT-097–LT-108) follow next iteration once the
gates hold; the i18n chain (LT-242 → LT-233 → LT-250) and the ADR 0037 implementation
(LT-274/275/276) keep for later iterations — nothing in this iteration contends with them.

**Exit criterion:** a corpus carrying all three spellings of one example compiles clean,
its spec passes against each, and LTC048 still fires for two canonical sources (LT-238);
the IR ADR is recorded (LT-235) and `@empty` + dynamic tags land with parity green, the
warning baseline at 0 and census 20/2/0 (LT-212, LT-213); a Simulated parent
server-splicing a Folded child renders the child UPGRADED (LT-188); `spike/` is deleted
and the parity suite, tsx typecheck gates and dual-corpus test run from the new fixture
homes (LT-237); module-codeblock serves as compiled `.tsx` with its spec green, the
copy-click bug fixed and pinned, zero warnings and tier + reason recorded (LT-096); a
fixture reaching page context outside the declared ambient set fails the build while the
corpus passes unchanged (LT-258); three consecutive full `bun test server/tests` runs exit
0 (LT-207).

**Next free task ID: LT-283.** (LT-280/281/282 are filed in BACKLOG.md — LT-280 gates the
wave's loop-heavy composites, LT-281/LT-282 are the LT-179 review riders. The LT-238 and
LT-235 sessions will consume LT-283+ for the implementation tasks and riders they file.)

---

- [ ] LT-238: Relax "one authored source per component tag" to a canonical-plus-variants rule (owner ruling, 2026-09-18). **Gates LT-237 and every remaining wave-4 migration.**
  **Skill:** architect (design + ADR) → le-truc-dev (implementation)
  **Context:** The owner has ruled that this repo must carry **all three spellings of a
  component side by side** — the hand-written `.ts` twin, the `.tsx` compile and the `.tsrx`
  compile — for two reasons: (a) each must pass the same Playwright spec, so the spec is the
  equivalence contract at runtime the way the parity suite is at build time; (b) the three
  spellings side by side are the honest showcase of the surfaces' trade-offs, which is
  exactly what ADR 0032's dual ruling asks readers to weigh. Today the corpus forbids this:
  one tag declared by two corpus files fails the build (LTC048), and the P5 migration
  pattern above says "delete the `.ts` twin."
  **The design question this needs answered first — do not skip to the code.** Three
  spellings of one tag collide in three places, not one: the emitted artifact names
  (`<tag>.server.ts` / `<tag>.client.ts` / `<tag>.css`), the corpus registry (`RegistryEntry`
  is keyed by tag, and `truc:pass` legality is decided through it), and the browser
  (`customElements.define` throws on the second registration). Two shapes answer it, and
  they trade off differently:
  (a) **Canonical + suffixed variants** — one spelling owns the tag, the others compile to a
  derived tag (`basic-counter--tsx`) and their own artifacts. All three can be registered on
  one page, so the showcase is a side-by-side demo and the spec can address each directly.
  Cost: the derived tag leaks into the registry, compose sites, and CEM output.
  (b) **Canonical + build-selected variants** — one tag, three builds, a page-level or
  build-level switch picking which spelling is served. The spec is run three times unchanged,
  which is the cleanest possible reading of goal (a). Cost: the showcase is no longer
  simultaneous, so goal (b) needs the docs to render sources rather than live components.
  Recommendation to grill, not to assume: (b) for the test contract, with the docs showing
  all three sources from the same folder — but this is the owner's call and it should be
  made before either LT-237 or the next migration. **Framework note (S0):** under the
  general-purpose goal the showcase is external-facing — the side-by-side demo is part of
  the product story for library users, so weigh goal (b) (simultaneous live demos) at full
  weight when grilling, not as a nice-to-have.
  **Obligations.** This amends ADR 0032 sub-design 6 and the `ARCHITECTURE.md` § Authoring
  Surfaces sentence "One component tag has exactly one authored source" — record via
  `adr-keeper`, do not edit the ruling in place. LTC048 narrows rather than retires (it must
  still catch two *canonical* sources for one tag): **channel = compiler, tier 1 Prevented**,
  statically decidable, no runtime half. **Tech Writer reviews the new LTC048 copy** — the
  message names both files today and will need to name the canonical-source rule instead.
  Rewrite the P5 migration pattern above in the same commit: "delete the `.ts` twin" becomes
  "retain the `.ts` twin as a variant."
  **Verification:** a corpus carrying all three spellings of one example compiles clean; the
  example's Playwright spec passes against each; LTC048 still fires for two canonical
  sources; `bun test server/tests`, typecheck, warning baseline 0.

- [ ] LT-235: Wave-4 type-level design session — IR discriminated unions, pass contracts (review §2.6–2.7). **Grilling first; produces an ADR + tasks.**
  **Skill:** architect
  **Context:** The one band that is design work, not cleanup — it changes the IR contract
  `LE_TRUC_COMPILER.md` §4 documents, so it wants an ADR (via adr-keeper) and a Tech
  Writer pass on that doc. Grill before scheduling implementation: (a)
  `ForIR.listSignal: string | null` discriminating two entirely different lowerings →
  `ServerForIR | ReactiveForIR`; (b) `try.pendingChildren: TemplateNode[] | null`
  discriminating error-vs-async boundary (with the immediate cast back at
  `effects.ts:1081`); (c) `SignalIR.init` meaning different things per `constructor`;
  (d) consolidating the four parallel `first()` collections on `ComponentIR`
  (`refReasons`, `unmatchedOptionalRefs`, `deferredComposeRefs`, `optionalRefs` — a Map,
  two differently-shaped arrays, a Set) and the seven parallel `expose()` fields; (e)
  **carved out as LT-244** (the reflection §6 free option — landed ahead of this session so
  the IR's leaf property holds while it designs against the IR); (f) typed pass contracts for
  `AnalysisContext` (`analysis/plan.ts:389`) — loops-before-harvest, byte-stable query
  registration order, `composeRegistry === undefined` silently disabling a pass,
  `ambiguousComposeNodes` as the already-reported channel — the hardest item: failure
  modes today are silent WRONG TIERS, not errors. **Coordinate with LT-212** (P4:
  `@for`'s `@empty` arm adds ForIR surface) — this redesign should land first or
  LT-212's shape gets reshaped under it; LT-212 is not urgent.
  **Deliverable:** ADR, amended LE_TRUC_COMPILER.md §4, and LT-236+ implementation tasks
  with the channel/tier fields the ADR 0028 process requires.
  **ADR 0037 rider (2026-09-21):** the conditional-over-signal IR node (and the boundary's
  arm-template shape) joins the discriminated-union inventory this session designs;
  [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md)'s LT-274 should land
  through or after it, not before.

- [ ] LT-212: `@for`'s `@empty` arm (LT-210 item 1, re-anchored). **Gate: before P5's first wave-4 migration (owner sequencing, 2026-09-17); not urgent — no migrated component uses it today.**
  **Skill:** le-truc-dev
  **Context:** Spec: optional arm after the template block. New IR (an empty arm on
  `ForIR`), both emitters, analysis addressing. `.tsx` needs no new spelling — an
  empty state is already `{items.length === 0 ? … : items.map(…)}` — so decide
  whether `@empty` lowers to that shared conditional+loop shape or earns its own IR
  (keys and addressing may differ). Dual-surface story per ADR 0032 s6: paid in both
  surfaces (the `.tsx` lowering is the conditional+map shape) or the s6 exception
  recorded.
  **Acceptance:** parity extended for the empty case; goldens unchanged for untouched
  behavior; warning baseline 0, census 20/2/0 hold.
  **ADR 0037 rider (2026-09-21):** `@empty` stays on the toggle path, out of the keyed arm
  space ([ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md) sub-design 5 —
  it shares the item container's `data-key` namespace); coordinate arm-extraction vocabulary
  with LT-274.

- [ ] LT-213: Dynamic `<{expression}>` tags (LT-210 item 2, re-anchored). **Gate: before P5's first wave-4 migration; not urgent.**
  **Skill:** le-truc-dev, with architect ruling the tier story if it needs one
  **Context:** Spec: closing tag repeats (`</{expression}>`). Not expressible in
  standard TSX — if the capability stays `.tsrx`-only, ADR 0032 s6's exception
  mechanism records it. The server semantics are the hard part: a tag name unknown at
  compile time folds only when the expression is server-known; decide which tier
  renders the unknown case and what the client does at connect. Also check the
  `.tsx` collision: a capitalized local-variable tag reads as compose (PascalCase =
  compose), so a `.tsx` spelling via a local tag variable must not blur compose
  dispatch.
  **Acceptance:** the unknown-tag case has a ruled tier and a pinned fixture;
  compose dispatch unaffected.

- [ ] LT-188: Load the composed-children closure before the simulation pass renders (LT-169 review finding). **Land before P5 adds composition across tiers. Gate discharged: LT-239 kept the Simulated tier ([ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s1), so this runs.**
  **Skill:** docs-server-dev
  **Context:** `server/effects/simulate.ts` loads a client module for each Simulated-tier
  component and nothing else. Children-first replay needs every composed child's tag DEFINED in
  the realm before its ancestor upgrades — `RegistryEntry.composesTags` exists for exactly this,
  and its own JSDoc states the case: a child that a parent's client module never imports (pure
  server-splice composition, no `pass()`/`first()` binding) is never pulled in by the import
  graph. A Simulated-tier parent composing a **Folded**-tier child therefore renders that child
  un-upgraded, and the served markup is silently wrong with no assertion to catch it. Today's
  corpus hides the hole: the only composing Simulated parent is `form-combobox` →
  `form-listbox`, and both are Simulated. Wave 4 (P5) will break that coincidence.
  Fix: the LOAD set becomes the subjects plus the transitive `composesTags` closure over the
  registry, children-first and de-duplicated against `realm.definitions` (the load-once
  assertion). The RENDER set stays Simulated-tier only, so `assertSimulatedTier()` and the
  no-realm-work-for-another-tier invariant are untouched — defining a tag is not simulating a
  component, and the ADR 0029 saving is unaffected.
  Second gap, same file: captured host-console output reaches `realm.diagnostics` but is only
  PRINTED on the normal path, through `gateOnSimReport`/`formatSimReport`. If the pass throws
  earlier (a `load()` assertion, an importer error), those lines die with the realm — print what
  was captured before rethrowing.
  **Channel:** the build report, unchanged; no new diagnostic kind and no TSRX code moves.
  Acceptance: a fixture with a Simulated parent server-splicing a Folded child renders the child
  UPGRADED, and removing the closure fails that test (pin the negative — a fixture whose child
  happens to be Simulated proves nothing); the existing "no realm render for another tier" pin
  stays green; a pass that throws during load still prints its captured diagnostics;
  `bun test server` green.

- [ ] LT-237: Move the spike's `.tsx` fixtures into their example component folders. **Depends on LT-238.**
  **Skill:** le-truc-dev
  **Context:** `spike/tsx/` is not spike residue — it is the live corpus for
  `server/tests/compiler/tsx/parity.test.ts`, `tsx/typecheck.test.ts` and
  `dual-corpus.test.ts`, and the only `.tsx` source in the repo. `spike/` implies disposable;
  these are permanent gates. Move the four ported components beside their `.tsrx` twins —
  `spike/tsx/basic/counter/basic-counter.tsx` → `examples/basic/counter/`, likewise
  `basic/pluralize`, `form/listbox`, `form/combobox` — which is what LT-238's rule change
  makes legal. The synthetics, negatives, probes and four tsconfigs
  (`sync-el`, `async-el`, `combobox-bad-args`, `async-bad-arms`, `bad-host-typo`,
  `jsx-probe`, `jsx-probe-neg`) are test fixtures, not examples: move them to
  `server/tests/compiler/fixtures/tsx/` instead, which also shortens their relative paths
  into `server/compiler/frontend/tsx/host-profile.d.ts`. Update the three test files' path
  constants, the four tsconfigs' `include`/`exclude`, and the `spike/tsx/` references in this
  file and `adr/archive/0032-spike-findings.md`; delete `spike/` once empty.
  **Watch:** the parity suite pairs `examples/**.tsrx` against the `.tsx` copy. Once the four
  live in one folder under LT-238's rule, the pair is a folder-local fact rather than a
  cross-tree one — keep the test asserting byte-identical server output and CSS, since that
  is the standing equivalence contract `ARCHITECTURE.md` § Authoring Surfaces names.
  **Verification:** `bun test server/tests` green with no fixture-path skips; the four tsc
  gates keep their exit codes (0 positive, 2 negative); check:links.

- [ ] LT-096: Migrate `module-codeblock` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** Smallest hand-written example (~43 lines). **Known pre-existing bug to fix during
  this migration** (LT-117 review): the twin calls `copyToClipboard(code, copy, {...}` bare — the
  `EffectDescriptor` is created and discarded, so the copy-click listener never attaches (label
  stays "Copy" on click; verified at HEAD). Per AGENTS.md it needs registration —
  `watch(() => true, copyToClipboard(...))` — plus a spec assertion that click actually
  copies/toggles the label. **Perf:** this is one of the two components that move page chrome
  into the simulated corpus (~299 occurrences in the built docs). Record the simulated build
  stage's wall time before and after, and record the tier and reason. (LT-193 has since removed
  the render cache this entry originally said to verify engaging — the cache no longer exists
  by the time wave 4 runs.) Its `first('code')`/`first('button.overlay')`/`first('basic-button.
  copy')` refs predict Simulated, but ~299 occurrences make that ~0.33 s — not a blocker.

- [ ] LT-258: Make the partial-readiness invariant a compiler check.
  **Skill:** le-truc-dev
  **Context:** ADR 0034 s4. The invariant — folded output depends only on the component's own
  props plus a closed, enumerable set of page-ambient values — is checkable **now**, before the
  emitter exists, and it must be, because the failure mode is a design landing between now and
  LT-257 that quietly forecloses template emission. The closed ambient set today is the reserved
  `i18n` parameter's five members ([ADR 0030](adr/0030-internationalization-as-build-time-server-data.md) s2).
  **Deliverable:** a check in the fold path that a folded expression's inputs are the component's
  own args or a member of the declared ambient set, and nothing else; the ambient set declared in
  **one** place the check reads, so adding to it is a visible, reviewable act rather than a
  diffuse one. Violations are a compile-time diagnostic (channel: compiler; tier 1 Prevented);
  new code, Tech Writer owns the copy.
  **Check:** the corpus passes unchanged; a fixture that reaches page context outside the
  declared set fails the build with the ruled message.
  **ADR 0037 rider (2026-09-21):** the check classifies a reactive condition's initial
  winner as prop-dependent output — legal, but the emitted backend conditional must be one of
  the invariant's named representations (see the LT-257 rider).

- [ ] LT-207: Stop the simulation realm's dependency-wait timers from leaking past teardown (LT-202 NOTES residue).
  **Skill:** le-truc-dev
  **Context:** `bun test server/tests` exits 0 or 1 nondeterministically at HEAD: 3
  unhandled `DependencyTimeoutError` "errors between tests" with 0 failures (verified
  pre-existing on the clean base, f4d66be0). Mechanism (hypothesis from LT-202): the
  parity suite's sim-realm disposal leaves the library's 200 ms dependency-resolution
  timer running; its rejection then lands on the torn-down window (`customElements.get`
  on a disposed realm) and bun fails whichever test is awaiting when it arrives.
  Timing-dependent — corpus-order failed twice in a 3-file subset run, passed in both
  full-suite runs. The realm should cancel or absorb in-flight dependency-resolution
  timers on `dispose()` (or the driver should drain them before teardown) so a disposed
  realm can never emit an unhandled rejection into the next test.
  **Acceptance:** three consecutive full `bun test server/tests` runs exit 0; the
  3-file subset that failed during LT-202 exits 0 repeatedly; no test asserts on the
  leaked rejection today, so fixing it changes no pinned behavior.
