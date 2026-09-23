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
must be grilled before any migration lands — **ruled 2026-09-21: build-selected variants,
[ADR 0039](adr/0039-canonical-plus-variants-authored-surfaces.md); the gate is now carried by
its implementation tasks LT-283 → LT-285**). **LT-235** runs before LT-212's implementation
per its own sequencing note and lays the IR foundation the ADR 0037 chain and LT-280 both
coordinate against — **ruled 2026-09-21:
[ADR 0040](adr/0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md); the
type-level gate is carried by LT-286**. **LT-212 and LT-213** are the owner-sequenced gates in front of the
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
its spec passes against each, and LTC048 still fires for two canonical sources
(LT-283–LT-285, the LT-238 ruling's implementation);
the IR ADR is recorded (LT-235) and `@empty` + dynamic tags land with parity green, the
warning baseline at 0 and census 20/2/0 (LT-212, LT-213); a Simulated parent
server-splicing a Folded child renders the child UPGRADED (LT-188); `spike/` is deleted
and the parity suite, tsx typecheck gates and dual-corpus test run from the new fixture
homes (LT-237); module-codeblock serves as compiled `.tsx` with its spec green, the
copy-click bug fixed and pinned, zero warnings and tier + reason recorded (LT-096); a
fixture reaching page context outside the declared ambient set fails the build while the
corpus passes unchanged (LT-258); three consecutive full `bun test server/tests` runs exit
0 (LT-207).

**Next free task ID: LT-295.** (LT-280/281/282 are filed in BACKLOG.md — LT-280 gates the
wave's loop-heavy composites, LT-281/LT-282 are the LT-179 review riders. The LT-238 and
LT-235 sessions consumed LT-283–LT-285 and LT-286–LT-289 respectively for their
implementation tasks. The 2026-09-23 compiler review filed LT-290; the LT-238/LT-283/LT-235
review filed LT-291–LT-294.)

**Iteration amendment (Architect, 2026-09-23 review of LT-238, LT-283, LT-235).** All three
are reviewed ✓ and moved to `DONE.md`. Three tasks join the iteration, ahead of the in-flight
LT-284 → LT-237 → LT-285 chain: **LT-290** (pulled from BACKLOG P3 — `check:corpus` exits 2
at HEAD, so no task's gate can read green until it lands), **LT-293** (the LT-283 Tech
Writer handoff, never executed — the exit criterion's LTC048 must read true in the docs as
well as the build), and **LT-294** (the CEM reads a stale output directory, so LT-285's CEM
proof would prove nothing). LT-291 and LT-292 (LT-283 review follow-ups) are filed in
BACKLOG P3. LT-291 is latent today, but it gates the first wave-4 migration that retains a
twin that a compiled parent references. The exit criterion gains: `check:corpus` exits 0
(LT-290).

**Working-tree state at review (2026-09-23).** Uncommitted LT-284/LT-237/LT-285 work:
`bun test server/tests/compiler` has 9 failures (0 at HEAD — LT-237 rider); `typecheck`
has 2 errors in `server/serve.ts` (LT-284 rider); `serve.test.ts` could not be run in the
review sandbox (no port binding).

---

- [ ] LT-290: `argsFromAttrs` re-emits Parser fallbacks that read `first()` refs out of scope (LT-194 defect; filed from the 2026-09-23 compiler review). **Pulled into the iteration 2026-09-23: `check:corpus` exits 2 at HEAD, so every task's gate reads red.**
  **Skill:** le-truc-dev
  **Context:** `emit-server.ts` (the `argsFromAttrs` builder beside the render function)
  copies each Parser-backed prop's fallback text as-is:
  `${parser.parser}(${parser.fallbackText})(${attrVar})`. When the fallback reads a
  `first()` ref, the emitted helper names a binding that exists only inside the render
  function (`const input: any = refStub`). Live case: `form-spinbutton`
  (`asNumber(asNumber(0)(input.value))(valueAttr)`, and likewise for `min`/`max`/`step`/`bigStep`),
  the only corpus module affected today (checked across `server/generated/components`).
  Three consequences:
  (1) `check:corpus` reports 5 × TS2552 "Cannot find name 'input'" remapped onto
  `form-spinbutton.tsrx` and exits 2. This was already true at 4d15eac6, even though LT-283's
  gate line reported check:corpus green. The "warning baseline 0" line is not the gate; the
  exit code is.
  (2) At runtime, `server/effects/page-render.ts` calls `argsFromAttrs` without a guard, so
  an authored page occurrence of `<form-spinbutton value=…>` (or `min`/`max`/`step`) throws
  a ReferenceError during the page render.
  (3) Even if the scope were fixed, a ref-reading fallback would put a `refStub` value into
  the render args, and from there into the markup. That breaks LE_TRUC_COMPILER.md § 8
  "Server stubs never reach the markup". § 5.3's "fallbacks and their ref reads included"
  describes the defect as design.
  Fix direction (le-truc-dev decides): a Parser prop whose fallback's free names include a
  `first()`/`all()` ref gets no attribute channel in the helper. It is omitted when it is
  optional or defaulted, and otherwise the whole helper is withheld, so the component stays
  authored and is never page-rendered (the export's PRESENCE is the renderer's
  qualification). This follows the existing "suppressed harness emits no helper" rule.
  Tech Writer amends § 5.3 in the same commit.
  **Channel:** none new. This is an emitter fix, and the page renderer's existing
  `skipped` channel (`unrenderable-args`) records the withheld case.
  **Check:** `check:corpus` exits 0 with 0 remapped diagnostics; a page-render fixture
  with a spinbutton occurrence carrying `value` renders or skips without throwing; an
  emitter pin asserts no `argsFromAttrs` body references a `refStub` name; goldens change
  only in `form-spinbutton.server.ts`; census 20/2/0.

- [ ] LT-293: Propagate the LT-283 variant-set rule and LTC051 through the docs and the error copy (LT-283 review rider — the commit's Tech Writer handoff was never executed).
  **Skill:** tech-writer
  **Context:** 4d15eac6 landed LTC048's narrowing and the new LTC051 with draft copy in
  `server/compiler/diagnostics.ts`. Its handoff list has not been executed anywhere:
  (1) review both messages (`duplicateTag`, `variantCssDrift`) per the ADR 0028 lifecycle;
  (2) `.agents/skills/le-truc/references/errors.md`: the LTC048 row still says "Keep exactly
  one authored file per tag", and LTC051 has no row;
  (3) `server/compiler/HOST_PROFILE.md` intro: "one component tag has exactly one authored
  source";
  (4) `server/compiler/LE_TRUC_COMPILER.md`:
  - § 1 (the corpus-scan paragraph);
  - § 6 "Corpus-level" (add LTC051);
  - § 7 "Corpus orchestration" (variant sets compile together, only the selected surface
    writes canonical artifacts, the unserved client lands in `variants/` once LT-284
    commits);
  - § 7.1: add `variantSurface`/`variantOverrides` to the field table and to the
    accepted-key list, and fix the LTC048 sentence in "The registry, in consumer terms".

  Follow the error-message lifecycle checklist in the tech-writer skill.
  **Check:** `git grep -n "exactly one authored"` returns no hits outside ADR history;
  check:links green.

- [ ] LT-294: Point the CEM at the corpus output directory — it still globs the pre-LT-255 `server/generated/tsrx/` (review finding, 2026-09-23).
  **Skill:** docs-server-dev
  **Context:** `custom-elements-manifest.config.mjs` globs `server/generated/tsrx/*.client.ts`.
  Since LT-255 (609923e0) the corpus writes to `server/generated/components/`
  (`corpus-config.ts` `DEFAULT_OUT_DIR`). Locally the old directory survives, last written
  2026-09-19, so `cem analyze` reads stale clients, and the committed `custom-elements.json`
  carries `server/generated/tsrx/…` paths. On a clean checkout the directory does not exist,
  every compiled tag would vanish from the manifest, and `verify-cem`'s REQUIRED_TAGS guard
  would fail. Derive the glob from the corpus configuration's `outDir` rather than hard-coding a
  second copy, and update the config's header comment. LT-285's variant-twin CEM exclusion
  (working tree) edits the same file, so land this first or together with it.
  **Check:** after deleting `server/generated/tsrx/`, `bun run build:cem` and `verify-cem`
  pass; the regenerated manifest's paths name `server/generated/components/`; the manifest
  diff is otherwise empty.

- [ ] LT-284: Per-surface test-route serving + the variant spec matrix (LT-238/ADR 0039 s2).
  **Skill:** docs-server-dev
  **Context:** ADR 0039's runtime equivalence contract: the same Playwright spec runs
  unchanged against each spelling of a variant set. `/test/:component`
  (`server/serve.ts` `handleComponentTest`) gains a surface selection —
  `?surface=ts|tsrx|tsx` — serving, for a variant-set component, a page that registers
  exactly that surface's module: the hand-written twin module from the example folder
  (`ts`), the generated client (`tsrx`/`tsx`). The page must define the tag exactly once
  (the default layout bundle keeps registering the selected surface; a surface page must
  not double-define — the twin-served page is the pre-migration serving mode rebuilt as an
  explicit selection). Keep `serve.test.ts` in lockstep (it mirrors `serve.ts` routes).
  Then the runner: a script (e.g. `test:variants`) that exercises the variant-carrying
  examples' specs once per surface — scoped to those specs, not the whole suite ×3.
  **Check:** a variant-set component's spec passes against all three surfaces locally
  (against a stub fixture if LT-285 has not landed yet); the default route is unchanged
  for non-variant components; no page load defines a tag twice.
  **Depends on** nothing compiler-side (can land parallel to LT-283); **LT-285 gates on it.**
  **Review rider (2026-09-23, working tree in progress):**
  (a) `typecheck` fails in `server/serve.ts`. At :341 there is TS2532: `result.outputs[0]`
  can be undefined under `noUncheckedIndexedAccess`. At :798 there is TS2484:
  `SurfaceSpelling` is exported both at its declaration (:139) and again in an export list.
  Add typecheck to this task's Check.
  (b) The `variants/` client write in `server/corpus-compile.ts` rewrites only side-effect
  imports (`import './x'`) to `../`. Any `from './…'` import, or an author's relative import
  already rewritten with `outDirPrefix`, would resolve one level too shallow from
  `variants/`. No generated client carries one today, so this is latent. Either rewrite
  every relative specifier, or pin with a test that variant clients carry only side-effect
  child imports.

- [ ] LT-285: The three-spelling exemplar — restore `basic-counter`'s `.ts` twin as a variant. **The LT-238 exit criterion.**
  **Skill:** le-truc-dev
  **Context:** Restore the deleted hand-written twin from history
  (`git log --oneline -- examples/basic/counter/`) as `examples/basic/counter/basic-counter.ts`
  beside its `.tsrx` (in place) and `.tsx` (LT-237 moved it in) — the first corpus folder
  carrying all three spellings of one component. Apply the ADR 0039 conventions: the twin
  owns the `declare global` `HTMLElementTagNameMap` entry (the compiled members dropped
  theirs at LT-237); the twin stays the artifact of record, byte-for-byte its deleted self
  except the map-entry ownership if history differs; the twin leaves the CEM globs while
  its component is compiled (`custom-elements-manifest.config.mjs` — derive the exclusion
  from the variant set so `verify-cem` stays green; first live proof of the CEM rule).
  The same `basic-counter.spec.ts` must pass against all three surfaces through LT-284's
  selection.
  **Check:** `test:variants` (LT-284) green ×3 for basic-counter; LTC048's narrowed pins
  proven live (a same-surface duplicate fixture fails the build naming both); census
  20/2/0 (the twin adds no registry entry); warning baseline 0; typecheck green (the
  absence of a TS 2717 error proves the declaration convention).
  **Depends on** LT-283, LT-237, LT-284.
  **Review rider (2026-09-23, LT-283 review):**
  (a) the CEM half of this task's Check is only meaningful after LT-294, because today the
  CEM reads a stale output directory;
  (b) restoring the twin puts `basic-counter` into `childImports` as the TWIN's module.
  `compileCorpus` keeps a sibling module over the generated client ("dual state keeps the
  twin"), so any compiled parent referencing the tag would import the twin, while
  `examples/main.ts` registers the generated client. That is LT-291. No compiled component
  references `basic-counter` today, so this task is unaffected, but add a pin that
  none does, so the first one fails loudly until LT-291 lands.

- [ ] LT-286: ForIR → `EachForIR | ReconcileForIR`, with the `@empty` reservation and the key-clause rule (LT-235 item (a); ADR 0040 s1). **The type-level gate in front of LT-212's implementation.**
  **Skill:** le-truc-dev
  **Context:** [ADR 0040](adr/0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md)
  s1 (owner rulings, LT-235 grilling 2026-09-21). `ForIR` splits into
  `EachForIR | ReconcileForIR` on a `kind: 'each' | 'reconcile'` discriminant; fields live on
  the member that uses them (`hoisted`/`indexName` each-only; `keyName`/`keyText`
  reconcile-only — `keyText` has zero consumers anywhere today). The plan maps tighten to
  `Map<EachForIR, ForClientPlan>` and `Map<ReconcileForIR, ReconcilePlan>`; the truthiness
  dispatch in `analysis/loops.ts`, `analysis/effects.ts` and `emit-server.ts` becomes
  narrowing. `emptyArm: TemplateNode[] | null` rides the union base — LT-212's reserved
  surface; populate nothing yet (the `.tsx` production story is LT-212's ruling). A
  server-data `@for` carrying a `key` clause — silently collected and dropped today —
  becomes a compile diagnostic: **channel compiler, tier 1 Prevented** (ADR 0028 s1), next
  free LTC code, mirroring the `.tsx` surface's existing "the key clause is a reactive-List
  concern" message; **Tech Writer reviews the copy**, and flips the LE_TRUC_COMPILER.md
  §4 ForIR passage from *target shape* to present tense in the same commit (LT-235 review).
  **Check:** goldens + parity byte-identical (no emission change); a fixture with `key` on a
  server-data `@for` fails the build with the new code; `bun test server/tests`, typecheck,
  warning baseline 0, census 20/2/0. **Unblocks LT-212.**

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
  live in one folder under LT-238's rule (ADR 0039), the pair is a folder-local fact rather
  than a cross-tree one — keep the test asserting byte-identical server output and CSS, since
  that is the standing equivalence contract `ARCHITECTURE.md` § Authoring Surfaces names.
  Apply the ADR 0039 declaration convention in the same move: each ported `.tsx` DROPS its
  `declare global` `HTMLElementTagNameMap` block (the `.tsrx` twin owns the entry; duplicate
  entries are a TS 2717 error under the examples typecheck).
  **Verification:** `bun test server/tests` green with no fixture-path skips; the four tsc
  gates keep their exit codes (0 positive, 2 negative); check:links.
  **Review rider (2026-09-23, working tree in progress — basic-counter moved, three to
  go):** the first `.tsx` in `examples/` breaks corpus loaders outside the three test
  files named above, because they assume every corpus file is `.tsrx`:
  - `server/tests/compiler/emit-tier.test.ts` (6 failures) compiles every
    `loadCorpus()` file with the `.tsrx` `compileSource`;
  - the client golden has no `basic-counter.tsx` snapshot handling;
  - `corpus compile order invariance` fails.

  Dispatch per extension in `server/tests/compiler/corpus-fixture.ts` (or in each
  consumer), the same way `compileCorpus` does. Also regenerate the parity client snapshot:
  its path changed, and the `declare global` drop is intended. Add "0 failures in
  `bun test server/tests/compiler`" to Verification. The remaining three moves will hit the
  same loaders.
  **Review rider (2026-09-23, LT-283 review):** ADR 0039 s1 leaves cross-surface markup
  equivalence to "the parity suite for its fixtures". Once the pairs are folder-local, make
  the suite discover every variant set in the corpus instead of listing fixtures, so a new
  set cannot escape it. The build-time check covers CSS only (LTC051). The server render
  and the registry entry (`exposedProps`, props type) of the unserved member are proven
  equivalent nowhere else, and the compose registry validates `pass()` legality against
  whichever member a parent's import names.

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
