# DONE

Done-and-reviewed tasks since the last release, compacted per the 3-file mini-kanban (owner,
2026-09-18). Each entry keeps only what is still load-bearing: rulings recorded nowhere else,
live handoffs into open tasks (referenced by LT-ID), and the changed-artifact facts Changelog
Keeper needs at release planning. Verification transcripts, changed-file line inventories and
review narratives are dropped — the full record stays in `git log -p`. Entries still carrying
`— done, pending review ⏳` are finished but not yet reviewed; their review pass happens in a
future iteration. At release planning Changelog Keeper consumes this file alongside
`CHANGELOG.md [Unreleased]`; the Architect then prunes entries whose context no live task needs.

---

- [x] LT-265: Define and document the front-end contract; designate its export surface. — reviewed ✓
  **Skill:** le-truc-dev + tech-writer
  **Changed:** `server/compiler/contract.ts` designates the export surface — `compileFromIR`,
  the IR vocabulary, both refusal channels, the consumer half,
  `EmitPaths`/`DEFAULT_EMIT_PATHS`, and the bundled `compileComponentTsx` (3 values + 26
  types; `.tsrx`'s `compileComponent` deliberately absent until `@tsrx/core` 1.0) — with the
  stability policy in the module doc: semver over the set and nothing else; emitted artifact
  BYTES are not contract; new optional IR fields and new `DiagnosticCode`/`RoutingSignalOrigin`
  members are additive-minor; a diagnostic number is never reused (`VOCABULARY_LEDGER.md` is
  the spent-number ledger); component-model connectors are third-party by name. Exports map
  entry and version stamp ride LT-254. `contract.test.ts` pins the set (runtime value keys +
  textual type re-exports — widening or shrinking fails a test). `scripts/contract-check.ts` +
  `check:contract` institutionalize the task's Check: a toy front end outside the repo imports
  ONLY `contract.ts`, compiles all three tiers, and proves both refusal channels — and
  doubles as the enforcer of the "new IR fields are optional" rule (a new REQUIRED field
  breaks the toy's literal). Docs half (Tech Writer): LE_TRUC_COMPILER.md §2 "The front-end
  contract", all seven required points — a §2 subsection, not a new numbered section, because
  §4–8 are cited by number from ADRs (renumber forbidden); §1/§3/§8 wiring; drive-by: two
  stale "LTC001–048" claims now state the two-prefix rule. Riders: the two `line?` JSDoc
  fields now read "authored source (either front end)".
  **Owner rulings in-session (2026-09-21, recorded in 6b92ec42):** the refusal vocabularies
  are CLOSED — `DiagnosticCode` and `RoutingSignalOrigin` are the compiler's; a third-party
  front end reuses the nearest existing member rather than minting its own. The tier-corpus
  "1 error" fixed (1179455b): the census describe body builds lazily per test — the block's
  3 tests register again and the suite's long-standing "1 error between tests" is gone.
  **Review:** Approved (architect, 2026-09-21). Gates re-run at 6b92ec42: `check:contract`
  11/11; scoped server suite 91 files / 1683 tests, 0 real failures (only the artifact-404
  set) and 0 errors; src suite 491/0; typecheck clean; biome clean. Coordination with LT-271
  holds — the contract and its docs speak the two-prefix LTC/TSRX vocabulary.
  **Handoffs:** LT-279 (updated in this review: TESTS.md's re-pin target is now 91/1683, with
  rows for both new test files).

- [x] LT-256: jsdom as an optional peer dependency; `unavailable substrate` as a tier-census reason. — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** the simulation pass routes Simulated-tier components Static when no substrate
  is installed (ADR 0034 s5, ADR 0029 s6 amendment) — tier set directly (classifyTier would
  re-yield simulated from the realm-answerable signals), an `unavailable-substrate` routing
  signal appended per component, `generated/registry.json` rewritten so the tier census
  reports the outcome, the reason carried in the pass log; the build stays green. One-shot
  builds only — the pass never runs on watch, so a watch session's on-disk registry keeps
  the simulated tiers until the next substrate-less one-shot. The resolver's catch narrowed
  to genuine resolution failures for the driver or jsdom itself (`isSubstrateAbsence`:
  ERR_MODULE_NOT_FOUND / Bun `ResolveMessage` AND the failing specifier is the driver file
  or the substrate package; a broken install — an init throw, a missing transitive dep —
  surfaces with its real cause). jsdom joins typescript as an optional peerDependency
  (devDependency kept). CI gains `test-no-substrate` (delete node_modules/jsdom, one-shot
  build, grep the census token). New `server/tests/compiler/simulation-resolve.test.ts`
  (absence discrimination in both Bun and Node error shapes) + reroute tests in
  `simulate.test.ts` (reroute scoped, registry untouched when the substrate is present).
  **Review:** Approved (architect, 2026-09-21). Re-proven live at the commit in a clean
  worktree: without jsdom the one-shot build exits 0 with exactly 2 components
  (form-combobox, form-listbox) rerouted Static and named in the census; with jsdom restored
  the registry returns to 2 simulated and the realm runs; a jsdom stub that throws at init
  FAILS the build naming the real cause — the silent-degradation class the narrowed catch
  exists for is closed. Typecheck clean; scoped suite green. The handoff's flagged design
  decision — rewriting the generated registry on absence — is ratified: registry.json is
  the census's input and reflects the last build's routing outcome by design.
  **Handoffs:** LT-279 (tech-writer: SERVER.md's simulation section predates the routing —
  state the absent-substrate behavior, the one-shot scope and the registry semantics;
  re-pin TESTS.md's count 89/1668 → 90/1678 and add the simulation-resolve.test.ts row).

- [x] LT-267: Make the build's file IO runtime-neutral — Node, Bun and Deno. — reviewed ✓
  **Skill:** docs-server-dev
  **Changed:** new `server/runtimes/` seam — `RuntimeIO` (`types.ts`), ONE shared glob
  translator (`glob.ts`), Bun and Node implementations both loadable under any runtime
  (`bun.ts`, `node.ts`), selected once at module load via `typeof Bun` (`index.ts`) — now
  carrying every file IO, glob and spawn on the build path. `compileCorpus` moved to
  `server/corpus-compile.ts` so the published build path imports without the reactive
  machinery (`effects/compile.ts` is the `compileEffect` wrapper only). New
  `scripts/corpus-portability-check.ts` + `check:portability` (bundles the corpus build once,
  runs the SAME bundle under Bun/Node/Deno, diffs emitted trees byte-for-byte — the release
  gate). New `server/tests/runtimes.test.ts` (glob grammar, the Node impl exercised under
  Bun, Bun↔Node parity on the real trees). Migrated onto the seam: `io.ts`,
  `corpus-sources.ts`, `file-watcher.ts`, seven `effects/` modules, `check-corpus.ts`,
  `i18n-sync.ts`; every `import.meta.dir` anchor on the build path →
  `dirname(fileURLToPath(import.meta.url))` where repo-anchoring is by design.
  **Review:** Approved (architect, 2026-09-21). Gates re-run independently at the commit:
  `check:portability` 3/3 runtimes byte-identical, typecheck clean, `bun test server/tests`
  89 files / 1668 tests green (TESTS.md's pinned count is exact); the outside-the-repo
  scratch run reproduced (config discovered at the scratch root, census lists ONLY the
  scratch key under one locale, Bun and Node emit byte-identical trees) — the i18n lesson's
  failure mode is structurally gone. Two behavior notes ratified: scans return SORTED
  relative paths (registry/census entry order deterministic across runs and runtimes;
  per-file emitted bytes unchanged), and `file-watcher.ts`'s activation rescan is debounced
  (`scheduleFlush`) because the sync seam scan removed the async boundary that kept a direct
  flush re-entrant.
  **Handoffs:** LT-277 (seam edge hardening from this review: glob dot-rule divergences,
  `fileExists`'s regular-file contract, SERVER.md's exception enumeration, i18n-sync's
  `.tsrx`-only glob), LT-278 (record the runtime-neutrality decision as an ADR — no ADR owns
  it yet; only SERVER.md and the queue carry it).

- [x] LT-255: Generalize the corpus scan — glob the consumer's components, not `examples/` — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** three new modules split by what each may depend on —
  `server/compiler/corpus-config.ts` (pure: `CorpusConfig`, the defaults, `resolveCorpusConfig`,
  `outDirPrefix`, `emitPathsFor`), `server/compiler/emit-paths.ts` (`EmitPaths` +
  `DEFAULT_EMIT_PATHS`; no `node:` import, because the CI-pinned browser bundle reaches it), and
  `server/corpus-sources.ts` (config read + globbing — the only place the corpus scan touches
  `Bun.Glob`). Threaded through `pipeline.ts`, both front ends' `compileSource*`/`compileComponent*`,
  `imports.ts` (`parsePlainImports`), `effects/compile.ts` (`compileCorpus`), `effects/i18n.ts`
  (`collectI18n`), and both runner scripts. Docs: `LE_TRUC_COMPILER.md` § 7.1 (field table, worked
  example, depth rule, registry contract in consumer terms), `SERVER.md`, `TESTS.md`,
  `registry.ts`. Tests: `server/tests/compiler/corpus-config.test.ts` (10).
  **Config surface:** a **`le-truc.config.json`** at the project root, found by searching upward
  from the working directory; the directory holding it IS the project root. Five optional fields,
  every one defaulting to this repo's paths so the docs build carries no config file: `sources`
  (**both** extensions — closes the LT-271 ledger gap), `siblingModules`, `outDir`, `i18nDir`,
  `runtimeImport`.
  **The find:** the output root's DEPTH was load-bearing and was what made it un-configurable in
  practice. `GENERATED_DIR_DEPTH_PREFIX = '../../../'` in `imports.ts`, the same literal in
  `handwrittenExampleModules()`, and `pipeline.ts`'s hard-coded
  `runtimeImport: '../../compiler/runtime'` are now all derived from the configured root
  (`emitPathsFor`). `compileCorpus`'s "the test directory must sit at the same depth" caveat is
  retired.
  **Second find, and the one that justifies the Check as written:** the first outside-the-repo
  compile read THIS repo's `i18n/` catalogs and censused ~30 `form-tokenbox.*` keys as another
  project's orphans. `i18nDir` is now configured. The in-repo half of the Check is byte-identical
  either way — only the scratch-project half surfaces this class of defect.
  **Architect rulings taken at review (2026-09-19):**
  - **The config location decision stands** — `le-truc.config.json`, JSON rather than a `.ts`
    module (nothing for LT-267 to inherit), upward discovery. Recorded as
    [ADR 0036](adr/0036-corpus-configuration-surface.md); LT-254 no longer gates it.
  - **A malformed config is a thrown startup error, not a diagnostic. Channel: none.** It is read
    before any component is parsed, so there is no source span and no author-fixable component
    mistake in the [ADR 0028](adr/0028-tiered-error-surfacing.md) sense. No `LTC` code, no Tech
    Writer handoff — which is why the *message* is the whole UX and why **LT-273** exists.
  - **`runtimeImport`'s default flips to the package specifier at LT-254** — recorded in LT-254's
    own entry so it survives this one.
  **Handoffs into open tasks:** **LT-273** (config validation + the last hard-coded glob);
  **LT-267** inherits the watch path (`file-signals.ts`/`config.ts` still fix `COMPONENTS_DIR`)
  and the i18n lesson; **LT-254** inherits the `runtimeImport` default flip.
  **Review (Architect, 2026-09-19): approved.** Byte-identity reproduced independently rather
  than taken from the handoff — stashed the tracked changes, clean-rebuilt the pre-LT-255 tree,
  rebuilt again after restoring, `diff -r` clean across all 69 artifacts. Census 20 folded / 2
  simulated / 0 static and warning baseline 0 both unmoved; `bun test server/tests` 1612/13, the
  13 the known sandbox port-bind and debounce failures.
  - **The module split is the quality of this task.** Two standing constraints had to hold at
    once — LT-267's finding that `server/compiler/` contains no Bun API, and the CI-pinned
    browser purity of `imports.ts`/`pipeline.ts` — and they pull in opposite directions the
    moment path math enters. Three leaves instead of one is the right answer, and
    `emit-paths.ts` earns its existence rather than padding the map.
  - **Threading `EmitPaths` as one trailing optional argument was the right shape.** The
    alternative — a module-scoped active-config holder — would have put mutable global state
    under a compiler whose whole claim is that it is a pure function of its inputs.
  - **Leaving the watch path alone was correct**, not a gap: half-wiring it for a consumer that
    does not exist before pioneer 1 would be speculative. Recorded against LT-267.

- [x] LT-272: Propagate the `LTC###` rename into the skill files; state the two-prefix rule where the namespace lives — reviewed ✓
  **Skill:** tech-writer
  **Changed:** `.agents/skills/le-truc/references/errors.md` (every renamed code re-prefixed;
  the two-prefix rule stated in the tier cell, the compiler-diagnostics intro and the Retired
  idioms paragraph, with the ledger pointer; new rows `LTC047`–`LTC050` — Template structure /
  Source shape and imports), `.agents/skills/le-truc-dev/references/non-obvious.md` (`LTC012`),
  `.agents/skills/tech-writer/workflows/error-message-lifecycle.md` (`LTC031`; new *Which
  prefix a new code gets* section; a prefix step in the new-error event),
  `server/compiler/diagnostics.ts` (module doc names the compiler surface-neutrally and states
  the two-prefix rule — the LT-271 review finding, discharged).
  **Two copy fixes rode along** (message strings only, no logic): `LTC049`'s "not
  FactoryContext member(s)" → "not FactoryContext vocabulary"; `LTC011`'s message/JSDoc name
  both `.tsrx` and `.tsx` imports (`imports.ts` has resolved both since LT-202). No test
  asserts either old fragment.
  **Review (Architect, 2026-09-19): approved** — verified independently of the handoff: no
  `TSRX0NN` outside the six kept codes anywhere under `.agents/`; all 48 codes named in
  errors.md exist in the `DiagnosticCode` union (`TSRX022`/`023` covered by the 021–024
  range); the repo-wide sweep found only kept codes in every live tracked file; the
  `diagnostics.ts` diff is module doc + the two message strings and nothing else; affected
  tests re-run green (54/0); `check:links` 504/504 re-run.
  **Riders fixed in review:** `NOTES.md`'s parity-pin note re-pointed `TSRX008` → `LTC008`;
  the local `docs-src/api/_media/0028` mirror (untracked, hand-copied, no build mechanism —
  pre-existing staleness class, not this task's residue) refreshed to the amended ADR.

- [x] LT-271: Prune TSRX-only vocabulary from the compiler — **reviewed ✓** (closure waited on LT-272)
  **Skill:** le-truc-dev (Tech Writer owns the copy of anything renamed)
  **Canonical disposition:** `server/compiler/VOCABULARY_LEDGER.md`; the two-prefix rule is
  stated where the namespace lives (`diagnostics.ts` module doc), in ADR 0028 sub-design 1 as
  amended, and in the tech-writer workflow.
  **The ruling (owner, during the task): diagnostic codes split by ownership.** The 44
  surface-neutral codes became `LTC0NN` with numbers preserved (ADR 0028's rows and the
  spent-number ledger re-pointed mechanically); `TSRX018`/`TSRX020`/`TSRX021`–`TSRX024` keep
  `TSRX` because they diagnose `.tsrx` grammar with no `.tsx` counterpart (the React idioms
  are `.tsx`'s correct spellings) and none is in the published package. Codes become public
  API at first publish, so the vocabulary was settled before P6 by design.
  **Renamed:** `check:tsrx`→`check:corpus`; `scripts/build-tsrx.ts`→`scripts/build-corpus.ts`
  (+ the never-existing `build:corpus` script entry); `server/effects/tsrx.ts`→`compile.ts`
  (`compileTsrxCorpus`→`compileCorpus`, `tsrxEffect`→`compileEffect`);
  `server/generated/tsrx/`→`server/generated/components/`. The 21 machinery modules now type
  on a machinery-owned `AstNode` (`server/compiler/ast-node.ts`) instead of `@tsrx/core`'s
  `TsrxNode` — also deleting the `.tsx` front end's duplicate declaration and narrowing the
  pin's entire footprint to `core.ts`+`core-shim.d.ts` (values and types). Kept with reasons
  in the ledger: `build:tsrx:browser` and its bundle, `core.ts`/`core-shim.d.ts`, the
  `@tsrx/core` pin, `scripts/codemod-react-jsx.ts`.
  **Review rulings:** the split-by-ownership call ratified as implemented; NOTES item 3 — the
  ADR 0028 amendment stands, the table is not rewritten (ADRs amend, not rewrite). Review
  findings: the two-prefix rule missing from `diagnostics.ts` → **LT-272**; the forward queue
  (TODO/BACKLOG) unswept — fixed in review; DONE/CHANGELOG/COMPILER_*/ADR bodies correctly
  left as records.
  **Check results (release-relevant):** corpus output byte-identical in 67/69 artifacts (the
  two diffs are the renamed vocabulary itself — provenance header, one registry origin
  string); census 20 folded / 2 simulated / 0 static and warning baseline 0 unmoved; the 13
  failing tests on the sandbox tree pre-existing (verified identical pre-sweep).
  **Changelog note:** the diagnostic-code namespace (`LTC###` default, six `TSRX###`
  exceptions) is release-notes material at first publish — the ledger is the source.

- [x] LT-263: The simulation seam — build report out of `sim/`, patch table split by audience, realm interface DOM-free — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** new `server/compiler/census.ts` (`Census`/`CensusEntry`/`CensusKind`/
  `TierCensusSubject`/`TranslationGap`/`tierCensus`/`translationCensus`/`formatCensus`),
  `server/compiler/build-report.ts` (`SimReport`/`reportDiagnostics`/`classificationFor`/
  `classifyDiagnostic`/`formatSimDiagnostic`/`formatSimReport`), and
  `server/compiler/simulation/{contract,capabilities,resolve}.ts`. `sim/report.ts` deleted;
  `sim/classifications.ts` keeps `CLASSIFIED_DIAGNOSTICS` only. `render()` now answers
  `{ html, diagnostics }`; `window`/`document`/`definitions` left `SimulationRealm`
  (`loadedTags` replaced the only read of `definitions`) and the wider `JsdomSimulationRealm`
  stays in `realm.ts`. `SuppressedSite`/`SUPPRESSED_HOST_SELECTOR` moved off `tier.ts` to the
  contract. `effects/simulate.ts` resolves the driver instead of importing it and splits
  occurrences with parse5. New `check:nosubstrate` script + `tsconfig.nosubstrate.json`, and
  `server/tests/compiler/simulation-seam.test.ts`. Docs updated: `server/SERVER.md`,
  `server/TESTS.md`, `server/compiler/LE_TRUC_COMPILER.md`.
  **Rulings made at review:**
  1. **The channel/registry split is correct, and ADR 0035 s3 limb 1 was amended to say so.**
     The ADR listed `CLASSIFIED_DIAGNOSTICS` among what moves compiler-side while its next
     sentence said only realm classification stays behind — a contradiction. Resolved the
     developer's way: the channel moves, the registry stays with the driver and reaches the
     channel as `SimulationProvider.classifications`, because which notices a substrate emits
     is a fact about that substrate (s6's future substrate would invalidate a compiler-side
     list). `reportDiagnostics` takes them as a required second argument.
  2. **The two new build-time errors are channel `build`, tier 1 Prevented, no `TSRX` rule.**
     Neither is statically decidable — both are facts about the install, not the author's code.
     `SimulationSeamVersionError` (driver present, wrong `seamVersion`) is permanent. The
     "no driver installed" throw in `simulate.ts` is a **deliberate placeholder** that LT-256
     replaces with the `unavailable substrate` routing outcome.
  3. **ADR 0035 s4 gained the resolver's two decided properties**: the specifier the
     typechecker does not follow (this, not the type surface alone, is what makes the opt-out
     typecheck), and absence-answers-`null` vs mismatch-throws.
  **Fixed during review:** a stale orphaned JSDoc block left above `createRealm` in
  `SimulationPassOptions`, and an internal task ID (`LT-256`) leaking into build-facing error
  copy in `simulate.ts`.
  **Live handoff:** **LT-256** — carries the placeholder-throw removal and a defect raised
  here: `resolveSimulationProvider()` catches every dynamic-import error, so a broken driver
  is indistinguishable from an absent one. Harmless today (the build fails either way, with a
  misleading message); a silent wrong-HTML degradation once LT-256 routes on it.
  **Known gap, pre-existing and unrelated:** `bun run check:sim` fails on the parent commit
  too — `renderFormColorgraph` destructures a null i18n record. The cross-runtime portability
  gate has been dark for a while.

- [x] LT-239: Grill the Simulated tier against the framework goal — **tier kept and SSG-scoped; ADR 0035 written; ADR 0027/0029/0034 amended; the seam scheduled as LT-263** — reviewed ✓
  **Skill:** architect
  **Three facts from the code that reframed the task** (the entry inherited the reflection's
  framing; all three contradict it):
  1. **`sim/` has two consumers, not two components.** ADR 0029 s7's equivalence audit renders
     every **Folded**-tier component through the realm in CI and pins the per-component connect
     diff. It is the Folded tier's only hydration-boundary check and it caught a real instance of
     the dangerous class on first run (LT-185, form-tokenbox's input removed at hydration).
     Retiring the tier without retiring the audit saves the routing code and
     `server/effects/simulate.ts` (~330 lines) — not `sim/` (1,687), not jsdom, not the ~4 s.
  2. **Substrate pluggability has no candidate.** The reflection's §5 defers the happy-dom/linkedom
     evaluation; ADR 0027 had already run it (`scripts/substrate-evaluation.ts`). linkedom has no
     custom elements; happy-dom **fails DOMPurify open**. Under simulation that is a security
     result, not a harness detail: the realm executes the client module at connect, so a
     consumer's `sanitize` hook runs *inside the substrate*.
  3. **ADR 0034 s5's premise was false.** `tier.ts:62` imports `sim/patch-table` (the classifier
     consults the simulation, and `tier.ts:243` sources the census reason from it);
     `sim/report.ts` is the build report, imported by three non-simulating modules; and
     `SimulationRealm.window` is typed `JSDOM['window']`, so the published `.d.ts` names jsdom and
     an opted-out consumer cannot typecheck.
  **Rulings (owner, 2026-09-19) that live nowhere else:**
  1. **Keep the Simulated tier** — fact 1 is half the justification. The reflection's falsifiable
     question is answered in ADR 0035 s1 so it is not re-opened: two components ship a skeleton
     instead of their options' initial state, *and* the other twenty lose the LT-185 detector.
  2. **Scope it SSG-only for all of 3.x.** A simulated component's output is computed by executing
     code against concrete args and concrete parsed markup, so it cannot be a template with holes
     and never travels through M27; its fold also reads light-DOM content, so ADR 0034 s4's
     invariant does not hold for it. The tier's claimed CMS differentiator does not exist —
     pioneers 2 and 3 get a Static partial either way. Recorded as scope, not defect.
  3. **Ship it with 3.0** rather than deferring it like `.tsrx` — pioneer 1 is an SSG project and
     is the release gate, so the tier is on the showcase's path.
  4. **Build the seam** (report out of `sim/`; patch table split by audience; DOM-free realm
     interface), and **shape it as a versioned package boundary**, not an in-process one — the
     owner chose the package boundary explicitly for the flexibility it preserves. Activation is
     intended to become *installation*.
  5. **Do not split `@zeix/le-truc-simulation` at 3.0.** Deferred to a later 3.x: the split's
     saving over the optional peer dependency is ~50 KB of JS, against a third release process on
     a release already gated on two external projects plus permanent version lockstep.
  6. **No pluggability mechanism until a candidate passes the sanitizer criterion**, which is now
     a standing acceptance criterion rather than a one-off verdict. **Speed is not a qualifying
     argument.** The evaluation harness is retained as scripts.
  **Changed:** `adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md` (new,
  ✅ Accepted, 6 sub-designs); ADR 0027 (status note + s2 gains the substrate acceptance
  criterion); ADR 0029 (s6 — the reason needs a substrate-free classifier; s7 — the audit is the
  realm's second consumer; s8 — the tier is SSG-scoped); ADR 0034 (s5 — decision stands, premise
  corrected, the seam is its prerequisite); REQUIREMENTS (scope note → 0024–0035, M20, M28, §5,
  §6); BACKLOG (LT-263 and LT-264 added to P1 above LT-256; LT-256 gains a hard dependency on
  LT-263; strategic framing consequence (3) rewritten; LT-188's gate discharged; the wave-3
  sequencing sentence no longer holds items behind LT-239).
  **Handoffs:** **LT-263 blocks LT-256** — ADR 0034 s5's opt-out is unimplementable until the seam
  lands, and the failure mode is silent (a build that simply cannot run without jsdom). **LT-188
  runs** now that the tier survives. **LT-264** is explicitly out of 3.0. Any tier- or
  report-adjacent task touching `sim/report.ts`, `sim/patch-table.ts` or the realm's type surface
  must coordinate with LT-263. **M20 is now a Must-Have two of three target personas structurally
  cannot use** — flagged in ADR 0035's Consequences as a legitimate thing for a later reviewer to
  re-open.
  **Changelog note:** nothing integrator-visible yet — decisions and scheduling only. At release
  the user-facing facts are that the Simulated tier is an SSG capability and that jsdom is an
  optional peer dependency.
  **Unplanned follow-up in the same session — the pluggability brainstorm (owner, 2026-09-19).**
  The owner asked whether input format, simulation, bundler and output format could all be
  pluggable. Outcome, recorded in the [ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md)
  amendment and four tickets:
  - **Bundler: no interface at all.** The emitted `.ts`/`.css` *are* the interface. What is
    wanted is runtime neutrality (Node/Bun/Deno), and the survey found `server/compiler/` already
    free of Bun APIs — the coupling is entirely in `server/effects/`. **LT-267.**
  - **Output format: the interface is the 3.0 commitment, the target set is not.** LT-257 is
    rescoped from "the Twig emitter" to "the target-emitter interface, Twig first", decided
    *before* the first emitter rather than extracted from it afterwards; its check now requires a
    second trivial target so the claim is tested. This was the only item with a deadline.
  - **Input: the interface already exists** — `source → { component, diagnostics, routingSignals }`
    into `compileFromIR`, with both front ends the same shell over it. Front ends are cheap
    (3,731 lines for two, against 16,751 of shared machinery). Its defect is that it is internal,
    unversioned, undocumented and unexported: **LT-265**, documentation and versioning only, not a
    plugin API. Component-model connectors (React/Vue/Solid) are **third-party by name**.
  - **The size bet is unmeasured.** Owner ruling: everything a framework does is representable
    (subtree variance as inert `<template>` tags, non-rendering state as a component-local
    attribute payload), and the combinatorial case costs a framework the same n templates, so the
    ceiling is **economic, not expressive** — and it becomes the acceptance criterion for any
    future connector. **LT-266** measures it. M19 was reworded accordingly: a serialized payload
    is avoided by default, component-local authored config via `asJSON` is the allowed form, and
    what is forbidden is an automatically synthesized hydration blob.
  - **A foreign-runtime "Mounted" tier is parked, not adopted.** It is a fourth tier that changes
    distribution (a foreign runtime in the consumer's bundle), not a reuse of the refusal channel.
    Useful as a migration ramp and a measurement baseline; the worst case as a permanent state,
    since the consumer pays for every framework at once. The owner's note that this configuration
    is *common* in corporate settings is recorded in the ADR as the strongest form of the motive:
    the value is compiling several surfaces away to one runtime, not adding support for each.
  **Not done by this session (sandbox):** the `adr-keeper` index row for ADR 0035.
  `.claude/skills/adr-keeper/references/adr-index.md` is hardlinked to the write-denied
  `.agents/skills/…` path, so the row must be added by the user.

- [x] LT-241: Declare the general-purpose framework goal and schedule the packaging track — **ADR 0034 written; REQUIREMENTS §1/M27/M28 amended; BACKLOG P1 band opened** — reviewed ✓
  **Skill:** architect
  **The fact the session surfaced, which reframed the task:** the compiler emits `*.client.ts`,
  `*.css` and `*.server.ts` — a TypeScript module only a JS build can execute — so the Folded
  and Simulated tiers had exactly **one consumer runtime**, this repo's SSG docs site. The §1
  target backends (Java/PHP/Python/C# CMS) cannot run it, and the mismatch is not only language
  but **time**: folding is build-time, CMS markup is request-time. That is the sharp form of the
  reflection's ratio test, and it made LT-241 a capability question rather than a packaging one.
  **Rulings (owner, 2026-09-19) that live nowhere else:**
  1. **SSG-first for 3.0, but folding must travel.** The SSG path is where the compiler pays off
     today. Emitting folded partials plus pre-bundled JS/CSS is a stated 3.x goal and **must not
     require an authoring change**; per-request SSR stays out of scope for all of 3.x and is
     reconsidered no earlier than 4.0.
  2. **For a CMS, a folded partial and a template are the same artifact.** Content-driven props
     are unbounded, so pre-folding per prop signature is combinatorially dead. Folding resolves
     everything prop-independent and leaves the props as **holes** — which is a template. The
     rejected alternatives are recorded in ADR 0034: the default-state partial (no content in the
     initial HTML — Static tier with nicer structure, so it would verify nothing at pioneer 2)
     and the per-instantiation manifest (solves the easy half, adds a public API surface).
  3. **Template emission is pulled into v3.0**, not 3.x — it is on pioneer 2's critical path, and
     it must be verified against a Zeix Craft project **before release**.
  4. **`@tsrx/le-truc` is dead.** The package is `@zeix/le-truc-compiler` (npm availability
     verified 2026-09-19). **v3.0 publishes the `.tsx` front end only**; `.tsrx` stays first-class
     in-repo under ADR 0032's parity contract and publishes in a later 3.x gated on `@tsrx/core`
     reaching 1.0.
  5. **jsdom becomes an optional peer dependency**, orthogonal to SSG vs SSR. Absent substrate is
     a **routing outcome**: affected components route Static with an `unavailable substrate`
     census reason — never a failed build, never a warning.
  6. **The adoption sequence is three pioneers**: Zeix SSG migrated from 2.x (live as the release
     showcase, via pre-releases) → Zeix Craft/PHP (verifies template emission) → client AEM/Java.
     Outside adoption expected only after these three.
  7. **The codemod is real but not push-button.** Owner's read: conversion is always possible —
     JSX reflects the static HTML, the factory body copies verbatim and already runs, and
     deterministic transforms do ~80%; the ~20% residue (chiefly `first()` selectors → structural
     JSX) needs judgement and is affordable at ~50 components. Its second job is instrumentation:
     the 2.x baseline is captured **before** it runs.
  **The invariant this session added, which binds every band:** a component's folded output may
  depend only on its own props and a **closed, enumerable set of page-ambient values** (today the
  `i18n` parameter's `lang`/`t`/`timeZone`/`currency`/`dir`). It is what keeps template emission
  reachable without an authoring break, and a 4.0 per-request path reachable after that. LT-258
  makes it a compiler check rather than a remembered rule.
  **Changed:** `adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md` (new,
  Accepted); `adr/0029-tiered-server-evaluation.md` (s6 gains the `unavailable substrate` census
  reason; s8 gains template emission as the designed alternative to an SSR runtime);
  `adr/0032-adopt-tsx-as-the-authored-component-surface.md` (parity contract is repo-internal at
  3.0; published package is TSX-only); `REQUIREMENTS.md` (scope note → ADRs 0024–0034; new §1
  subsection "The v3 goal: a general-purpose framework, not repo tooling"; a second success-
  criteria block that can fail; **M27** backend-neutral template emission; **M28** distribution
  and dependency weight; §5 Required, §6 Dependencies, §7 Out of Scope); `BACKLOG.md` (new **P1**
  band, LT-254…LT-262; strategic framing records the three consequences); `TODO.md` (LT-241
  removed; next free ID → LT-263).
  **Handoffs:** LT-254…LT-262 in BACKLOG P1. **LT-239's floor is set** by ruling 5 — it decides
  substrate pluggability and tier survival, not whether the tier is mandatory downstream. Any
  open task naming `@tsrx/le-truc` or assuming `.tsrx` ships at 3.0 is stale (ruling 4).
  **Changelog note:** nothing integrator-visible yet — ADRs, REQUIREMENTS and planning only. The
  package rename becomes release-notes material when LT-254 lands.
  **Not done by this session (sandbox):** the `adr-keeper` index row for ADR 0034 —
  `.claude/skills/adr-keeper/references/adr-index.md` is write-denied in the agent sandbox.

---

- [x] LT-240: Decide the i18n message model — **ICU MessageFormat 1 adopted** (ADR 0030 s1/s4/s5/s6/s8/s9 + M24 amended) — reviewed ✓
  **Skill:** architect
  **Ruling (owner, 2026-09-19):** a message value is an **ICU MF1 pattern**; `t.<key>` is a string
  when the pattern takes no arguments and a function of its arguments when it does. Rulings that
  live nowhere else:
  1. **The client-render premise narrows deliberately.** ADR 0024 s1's "never client-renders" was
     about not shipping template+data twice and not re-rendering DOM subtrees. Substituting a text
     node from an already-parsed pattern is neither — same category as `basic-number`'s
     `Intl.NumberFormat` call. Recorded in ADR 0030 s6.
  2. **MF1, not MF2** — decisive reason: MF2 spells placeholders `{$token}` where MF1 spells them
     `{token}`, so MF2 would break LT-197's already-ruled pattern channel on day one; TMS tooling
     also speaks MF1 natively. The exit is kept open and *tested* (LT-253), since
     `@messageformat/icu-messageformat-1` + `messageformat@4` make the migration mechanical, and
     `messageformat@4` is itself the `Intl.MessageFormat` polyfill — so MF2 never waits on browsers.
  3. **Parse, don't compile; own the evaluator.** `@messageformat/parser` at build time;
     `@messageformat/core` is a **test oracle only**. One evaluator serves the server fold AND the
     client, so the two sides cannot disagree — the reason a third-party compiler was rejected.
  4. **What ships is the parsed AST**, not a pattern (would need a client parser) and not a compiled
     function (is code, cannot ride the JSON attribute, forces per-locale client bundles). Keeps one
     universal client bundle; evaluator inlined narrowed to the constructs each component uses.
  5. **Build-time diagnostics only for v3**; `t` stays `string | ((args) => string)` and authors must
     not rely on the wider type — per-key `.d.ts` precision is deferred and will tighten it.
  6. **Delete, don't preserve**, the per-category vocabulary: exotic variance has ternaries and
     `@if`/`@switch` on both surfaces.
  7. **A format migration is a sanctioned manifest rebaseline** (ADR 0030 s5) — sources,
     translations and hashes in one commit, so a meaning-preserving rewrite marks nothing stale.
  8. **The per-request seam is declared** (ADR 0030 s1 + M24): per-locale SSG pages are the
     docs-site path; locale is a parameter of the render boundary, and the CMS targets' per-request
     model must not be foreclosed.
  **Changed:** `adr/0030-internationalization-as-build-time-server-data.md` (s1, s2, s4, s5, s6, s8,
  s9, Context fact 3, Alternatives +8 entries, Consequences); `REQUIREMENTS.md` M24.
  **Handoffs:** new **LT-250** (build half), **LT-251** (deletion sweep, 86 refs / 25 files),
  **LT-252** (corpus + catalog migration, manifest rebaseline), **LT-253** (MF2 round-trip
  insurance). Reframed: **LT-218** (gate discharged; serializes the AST), **LT-219** (three census
  cases replace placeholder-preservation), **LT-220** (scope widened to the message model),
  **LT-249** (joins the `malformed` family). **LT-189 item 2 withdrawn** — TSRX008 retires in LT-251.

## P0 — TSX surface adoption (ADR 0032) — reviewed ✓ (closed 2026-09-18)

**LT-183, LT-202, LT-203, LT-204, LT-205, LT-206, LT-208/209, LT-210, LT-211** — all landed and
reviewed: the `.tsx` spike (verdict GO), the production merge (shared front-end modules, the dual
`.tsrx`+`.tsx` corpus with TSRX048, the `css` template tag), the strict per-element host profile
(`server/compiler/frontend/tsx/host-profile.d.ts`, taught in `server/compiler/HOST_PROFILE.md`),
the `server/compiler/` tree with `frontend/{tsrx,tsx}/` inside, the branded three-arm `boundary`
types plus the annotated `FactoryContext`/`FormFactoryContext` second parameter, the `@tsrx/core`
0.2.3 pin (TSRX020 retired; ADR 0033 drafted), and the stale arm removed end to end (the
`isPending` arrow idiom). LT-205's stale-arm asymmetry ruling is superseded as history by
LT-211's withdrawal. **What wave 4 and later inherit:** migrations author `.tsx` by default, extend
the strict `IntrinsicElements` table in the same commit, annotate a typed second context
parameter, and use the three-arm boundary — the authoring rules live in AGENTS.md,
`HOST_PROFILE.md` and ADR 0032; ADR 0033 stays Proposed with LT-214 parked alongside it
(style composition is a ROADMAP backlog item, likely 3.1).

**Decisions that live nowhere else:**
- **Packaging-time deferrals (LT-206) — deliberately NOT renamed with the tree:** the
  `check:tsrx`/`build:tsrx` script names, the `server/effects/tsrx.ts` filename, the
  `server/generated/tsrx/` output directory, `@tsrx/core` package names, and TSRX diagnostic
  codes. (LT-241 now schedules this as the packaging track; the list is restated there.)
- **Changelog verdict (2026-09-18): P0 owed CHANGELOG.md nothing.** The whole band touched
  `server/` (unpublished) and docs; `@tsrx/core` is a devDependency, so the pin bump is not
  integrator-visible.

## P1 — Tiered server evaluation (ADR 0029) — reviewed ✓ (closed 2026-09-06)

**LT-165, LT-185, LT-184, LT-180, LT-169** — all landed and reviewed: the eight ADR 0029 steps,
form-tokenbox's hydration regression fix, the severe `TSRX034` scoped per-expression,
library-contained connect failures reaching the build report, and the simulation driver inside
`build:docs`. Post-LT-190 census **20 Folded / 2 Simulated / 0 Static**; compile-warning baseline
**0**; simulation build-report baseline **0 unclassified**. (The Simulated tier is now S0
LT-239's grilling subject.)

**Review decisions that live nowhere else (2026-09-06).** The simulation pass renders each
component's authored demo HTML (`examples/**/<tag>.html`), not the server render function over
fixture args — the fixture args are a test artifact, the demo markup is what the docs serve. The
pass runs for one-shot builds only — one module cache per process makes a second load of the same
generated client unsound (ADR 0027 sub-design 10), so a watch session never sees the gate. It
captures every host `console.error`/`warn` during a load/render window, not only the library's
containment messages — the console carries no separating marker, and `CLASSIFIED_DIAGNOSTICS` is
the designed escape hatch.

## P2 — Internationalization follow-ups (ADR 0030)

- **LT-201** (adr-keeper) — done ✓. ADR 0030 amended in place (unpublished on v3): s1 gained the
  pages/fragments output split; s3 the full locale-precedence chain (own server arg > compose-graph
  inheritance > authored default > page locale; `lang` is config-only — the IDL guard makes it
  structurally un-exposable — materialized at connect, fixed for the connection); s4 the
  per-category key rules; s5 the census reachability rule.
- **LT-193** — reviewed ✓. LT-166's render cache and LT-175's locale containment removed (review
  caught the stale `RenderStats` re-export — bun test does not typecheck). Standing posture: no
  render cache; the registry's `declaresI18n` survives for compose-graph inheritance; simulated
  stage measured 60→61 ms (no regression).
- **LT-195** — reviewed ✓. Six surveyed accessibility strings route through `{t.key}`
  server-folded sites across five components; de carries real translations (pinned). Rulings on
  falsified premises: `t` in a reactive thunk is TSRX005 (client-only watch; no catalog ships) —
  superseded by the LT-197/LT-218 client-string channel; tokenbox's `Remove` exposed the
  reactive-list gate → LT-215. En-route fix: `i18n:sync`'s `""` placeholder resolved as EMPTY
  text; `i18nRecord` now falls back on empty overrides (pinned). Render fns throw without an
  i18n record (corpus-args `inlineI18n`).
- **LT-215** — done ✓ (Architect ruled; landed same day). Server-static expressions are admitted
  inside reactive-list `@for` bodies in BOTH front ends. The ruling (cited by `validateListBody`):
  the invariant is ADR 0017's slot-fill contract, and "statics only" was sufficient but not
  necessary — an expression whose free identifiers are all server-known folds identically into
  every item and bakes into the served `<template>` per render call; item-derived expressions
  stay rejected (per-item VALUE, no slot channel). `listTemplateLines` bakes admitted attrs/text
  as esc'd Parts. Diagnostic rewording → LT-189 item 7.
- **LT-196** — reviewed ✓. The translation census walks both directions: `TranslationGap['status']`
  gains `'orphaned'`; `i18n:sync` prunes orphans from catalog AND staleness manifest. Channel
  posture ratified: census records never fail the build (a catalog is data, not source).
  The LT-190 probe test injects catalogs (with the inverse walk live, a synthetic corpus against
  the real catalogs would report every committed key).
- **LT-198** — reviewed ✓. The four LT-174 review minors landed. **Ruling recorded (pinned by
  tests, so a reversal is not free): legacy root URLs (`/guide.html`, `/blog/<slug>`, …) 404 is
  ACCEPTED** — a serve.ts redirect map cannot reach the static host that actually serves the
  site, and the locale layout is unreleased, so no population of broken external links exists.
  `serve.test.ts`'s mirrored test server stays in lockstep with serve.ts's routes.
- **LT-217** — reviewed ✓ (Architect, 2026-09-18). The orphan walk checks DECLARATION before
  reachability: undeclared residue (a renamed key, a deleted component) reports and prunes in
  EVERY locale (de/lv/zh included — their category sets lack `few`); the wholesale protection
  for declared keys is unchanged. **Review:** approved — verified against the diff at 1b537c32
  and re-proven live on the committed catalogs (planted `stray.few` reported orphaned in de
  specifically, pruned by sync, `i18n/` byte-clean). Accepted nit: `pluralCategories` is
  computed per declared-category-key, not hoisted per locale as the task text sketched —
  build-time negligible. One finding filed: **a non-string (malformed) catalog value is silent
  in both the census and sync** (falsified en route) → LT-249.
- **LT-194** — reviewed ✓; defect fixed in review commit 27652642 (`class`/`id` stripped from
  forwarded args — they address the host, LT-090). The document-level page renderer
  (`server/effects/page-render.ts`) server-renders qualifying occurrences via parse5
  source-offset splicing; qualification is Folded + `declaresI18n` only (the lang-arg arm was
  withdrawn on basic-number emptiness evidence — page-rendering it would EMPTIFY authored text);
  LT-191's acceptance fixture is served at its home. `emit-server.ts` emits `argsFromAttrs`;
  `paramProps` sits on the IR; parse5 pinned ^7 NOT v8 (jsdom requires CJS).
- **LT-197** — done ✓ (ruled; owner concurred; ADR 0030 sub-design 9 amended in place).
  Client-side runtime strings ride a per-instance root `i18n` attribute: the compiler classifies
  `t.<key>` reads in client positions and serializes only those keys onto the root per render
  call (`i18nRecord(tag, lang)`) — locale stays build-time server data, one universal client
  bundle. Client-referenced keys only; the carrier-span idiom retires; `{placeholder}` patterns
  with `t.key({ … })` call syntax (s4 stage-2 pulled forward). Implementation: LT-218/219/220.

## P2b — Compiler partitioning & hardening (external review; re-scoped by the reflection)

- **LT-221** — done ✓ (commit 7a118afb). All five review §1 defects fixed TDD-first plus a sixth
  found en route (quoted class-map keys never extracted): the `offenders`-array truthiness bug,
  author-data interpolation now `jsString()`-escaped at all `emit-client.ts` sites (the
  source-injection payload emits inert; LT-234 supersedes with the shared kit), bracket access
  for non-identifier keys via `memberAccess()`, `resolveComposeRefs` idempotent (name-aware
  claimed check). Rulings: the `keyName === 'first'` arm is grammar asymmetry, not drift; the
  compose-in-`@pending` gap is unreachable (`singleRootOf` filters to elements).
- **LT-222** — done ✓. The dead surface deleted (every target grep/probe-verified before
  deletion). `class:`-prefix ruled and executed: silently wrong on BOTH spellings, so
  `classifyAttribute` rejects it outright (TSRX006; the emitter branch deleted) — wiring
  Svelte-style `class:x={thunk}` sugar remains an open feature decision (LT-235 agenda).
  **`style:x={…}` and `on:click={fn}` cousins still fall through as server attrs — flagged, not
  fixed.** Retired-spelling tombstones kept deliberately (they power live diagnostics; revisit at
  packaging). `serverKnown` computed once in `seedExtractionContext`.
- **LT-223** — done ✓ (one ruling reversed). `diagnostics.ts` strictly code-ordered with band
  comments; retirement treatment standardized to the lifecycle doc's keep-member form (TSRX020
  restored as kept, TSRX031's note expanded; TSRX004/013/043 left the union for tier.ts's named
  `RoutingSignalOrigin` — a diagnostic with those codes is now unrepresentable); `invalidSource`
  threads offsets (malformed `export const i18n` reports its line). Voice-check → LT-189 item 10.
- **LT-224** — done ✓ (commit 94dd786a). `front-end.ts` (1,799 lines) split into six flat modules
  (`module-scans`/`params`/`setup-extraction`/`template-output`/`validate-lowered`/
  `assemble-ir`); public surface unchanged; `readModuleDecls` rode assemble-ir (LT-235 may
  re-home). Goldens byte-identical.
- **LT-225** — done ✓ (commit 5db7be77). `emitServerModule`'s five closures lifted to module
  scope behind `EmitContext` (10 fields); `emitAsyncBoundary`/`emitCompose` split out; the
  ~600-line assembly tail diff-untouched via stable-collection destructuring. The
  context-passing pattern is the precedent the remaining splits follow.
- **LT-226** — reviewed ✓ (Architect, 2026-09-18; commit 94207592). `runEffects` (1,537 lines) →
  a ~60-line context builder + module-scope units behind `EffectsContext` (21 fields); the
  compose-`id` scan lifted as `validateComposeIds`; the lazy-text gate is one shared
  `emitLazyTextChildren` (the review's recorded drift was STALE — LT-115 had already converged
  both copies strict; one real convergence: the doubled per-child diagnostic now fires once).
  **Review:** approved — verified against the diff, not the handoff: the context's callables are
  AnalysisContext's own passed through (no new function members); both `emitLazyTextChildren`
  call sites carry the right label/selector/`addressHost`; the once-only diagnostic is
  STRUCTURAL (the second code path no longer exists, so the old double-fire cannot silently
  return — unpinned by a test, accepted on that basis). Goldens re-proven: regenerated the
  generated dir from source, `git diff` byte-clean. GOTCHA for all compiler tasks: a compiler
  crash in build-tsrx makes typecheck's `&&`-chained tsc silently not run — check the exit
  code, never grep for "error TS".

## P3 — Gate-wave residue

- **LT-216** — done ✓. TESTS.md's hand-maintained tree (missing 53 of 84 files) replaced by a
  directory-level skeleton plus the authoritative `find server/tests -name '*.test.ts' | sort`
  command; the count line is re-pinned with a date. `bun test --list` is not a real flag — it
  silently runs the suite.

## P7 — Backlog

- **LT-014** — retired as moot ✓ (architect, 2026-09-17; ADR 0032). The Volar span-table plugin's
  premise was `.tsrx`-everywhere authoring; `.tsx`-authored code gets editors through plain
  tsserver. **Re-open conditions (either):** `.tsrx` authoring resurges as a dominant surface; OR
  precise EDITOR feedback on authored `.tsx` is demanded — tsserver cannot do per-file programs,
  so the wide `host` overlay stays in editors until a per-file language-service projection exists.
