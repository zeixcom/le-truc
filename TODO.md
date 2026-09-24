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

**Next free task ID: LT-299.** (LT-280/281/282 are filed in BACKLOG.md — LT-280 gates the
wave's loop-heavy composites, LT-281/LT-282 are the LT-179 review riders. The LT-238 and
LT-235 sessions consumed LT-283–LT-285 and LT-286–LT-289 respectively for their
implementation tasks. The 2026-09-23 compiler review filed LT-290; the LT-238/LT-283/LT-235
review filed LT-291–LT-294; the LT-284 review filed LT-295/LT-296; LT-290's close-out filed LT-297; the first `test:variants` run filed LT-298.)

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

**HEAD state after 640922d5 (LT-284 review, 2026-09-23).** That commit, titled LT-284,
also carries LT-293 (error copy + compiler docs) and the in-progress LT-237/LT-285 work
(`basic-counter.ts` twin, `examples/tsconfig.json`, CEM twin exclusion, the parity/typecheck
test edits). It is pushed, so history stays; attribute by file, not by title. HEAD is red:
`bun test server/tests/compiler` has the 9 LT-237 rider failures. tsc is clean. The
`serve.test.ts` route legs and the Playwright matrix need port binding, which no review
sandbox has.

---

- [x] LT-298: The `.tsx` front end drops the args parameter's type annotation, so every arg reads as untyped (found by the first `test:variants` run, 2026-09-23). **Pulled into the iteration: `basic-counter` is served from `.tsx`, so the default `bun run test` is red too.** — done ✓
  **Skill:** le-truc-dev
  **Context:** `server/compiler/frontend/tsx/to-estree.ts` converts no type-only children
  ("annotations … are NOT converted"), so the args `ObjectPattern` carries no
  `typeAnnotation`. Everything the shared stages derive from that annotation then silently
  takes its no-annotation default on `.tsx` only:
  - **the harvest parser:** `inferType` → `'unknown'` → `asString`. The live failure:
    `basic-counter.tsx`'s client harvests `count` with `asString()`, so a click gives
    `"42" + 1 = "421"`. Both `basic-counter.spec.ts` tests fail on the `tsx` surface in
    Chromium and WebKit, while `ts` and `tsrx` pass;
  - **`paramPropsOf` (`assemble-ir.ts`):** `typeText: 'unknown'`, `optional: true`
    (`isOptionalBinding` says optional when it cannot see a type), and `isString: false`.
    So a plain `string` arg loses its `argsFromAttrs` channel, and required args read as
    optional;
  - **LTC032** (a default on a non-optional prop) can never fire on `.tsx`.

  The parity suite missed it because it pins client modules structurally, and its
  snapshot records `asString()(span.textContent)` for `basic-counter.tsx` (since LT-183).
  Fix direction: convert the args parameter's annotation to the estree-TS shapes that
  `infer-type.ts` reads (`TSTypeAnnotation` → `TSTypeLiteral` → `TSPropertySignature` with
  `optional`, plus the `TSStringKeyword`/`TSNumberKeyword`/`TSBooleanKeyword` keywords;
  anything else as a spanned passthrough, so `text()` still slices `typeText`). Scope it to
  the component's args parameter unless converting annotations everywhere is free.
  Walks must not start counting type names as value reads (check `freeIdentifiers`'s
  skip-list).
  **Channel:** none new. This is a front-end conversion gap, and LTC032 starts firing on
  `.tsx` as designed.
  **Check:** `bun run test:variants` green on all three surfaces; `bun run test` green for
  basic-counter; regenerate the parity snapshot, which should now say
  `asInteger()(span.textContent)` and `defineComponent<BasicCounterProps>` if the
  `.tsrx` output has it; a new parity pin asserts that each variant pair's
  `paramPropsOf` output and harvest parser kinds are equal; an LTC032 `.tsx` fixture fails
  the build; goldens and census 20/2/0 unchanged apart from the corrected `.tsx` client.
  **Related:** LT-237's LT-283 review rider (the unserved member's equivalence is proven
  nowhere) covers the general gap. This task closes the instance and adds the pin.
  **Changed:** `server/compiler/frontend/tsx/to-estree.ts`, three conversion gaps with one
  root, each making `.tsx` diverge from `.tsrx` silently:
  (1) parameter annotations: `withParamAnnotation` attaches an estree-TS `typeAnnotation`
  (`convertType`: type literals and property signatures with `optional`, the primitive
  keywords, named references, everything else a spanned passthrough) and extends the
  pattern span over it, as `.tsrx` does. That fixes harvest parsers (`asInteger`), arg
  optionality and `string` channels, LTC032, and the typed server render signature;
  (2) exported `type`/`interface` declarations were converted by unreachable branches
  (`convert`'s statement dispatch came first), so their `id` was lost and `.tsx` clients
  never got `defineComponent<Props>`. Moved into `convertStatement`;
  (3) renamed and nested destructures (`i18n: { t }`) took their key from the value
  pattern, so `.tsx` never saw the reserved `i18n` arg: `declaresI18n` was false and
  `basic-pluralize` withheld its `argsFromAttrs` helper. The key is now `propertyName`.
  `server/tests/compiler/tsx/parity.test.ts`: per-pair pins on the derived client facts
  (props type argument + Parser calls), the `argsFromAttrs` helper, and the render
  signature, with a self-pruning `AUTHORED_ARGS_DRIFT` set (listbox/combobox's spike
  fixtures author different args; LT-237 reconciles them). Plus LTC032, the no-false-
  positive case and a renamed-destructure case on `.tsx`. All the new pins fail against
  HEAD's converter. The parity snapshot is regenerated: counter `asInteger` + props
  generic + the LT-237 path, and the props generic for pluralize, listbox and combobox.
  **Gates:** typecheck 0; `check:corpus` exit 0, warning baseline 0, census 20/2/0; parity
  50/50; `bun test server/tests` 1674 pass / 22 fail = 14 `serve.test.ts` port-bind +
  8 LT-237 loaders (the 9th, the parity counter snapshot, is fixed here). The generated
  `basic-counter` `.tsx` client is now identical to the `.tsrx` one apart from its header.
  **Not run here:** `bun run test:variants` and `bun run test` (no port binding in the
  sandbox). Run them to close the Check.

- [x] LT-294: Point the CEM at the corpus output directory — it still globs the pre-LT-255 `server/generated/tsrx/` (review finding, 2026-09-23). — done ✓
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
  **Changed:** `custom-elements-manifest.config.mjs` — the client glob is now
  `${corpusOutDir}/*.client.ts`, where `corpusOutDir` is `loadCorpusConfig().outDir` asked of
  `server/corpus-sources.ts` via a `bun -e` subprocess (the loader is TypeScript and `cem` runs
  under Node), so a `le-truc.config.json` `outDir` is honoured too; header comment updated
  (also the stale `scripts/build-tsrx.ts` → `build-corpus.ts`). Verified with
  `server/generated/tsrx/` deleted: `build:cem` + `verify-cem` pass (70 declarations), all 66
  generated-module paths name `server/generated/components/`. Note: `custom-elements.json` is
  gitignored, not committed, so there is no manifest diff to review. Two example demo comments
  (`form-radiogroup.html`, `form-colorgraph.html`) still name `server/generated/tsrx/` — out of
  this skill's scope.

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
