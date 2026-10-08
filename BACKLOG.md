# BACKLOG

Planned tasks out of scope for the current iteration. The bands are priority-ordered — the
planned pick order for future iterations, not a schedule. This file is a built view: the store
is `queue/` (one `LT-NNN.md` per task, plus `ITERATION.md`, `BANDS.md`, `LEDGER.md`); only the
Architect moves tasks between files, contributors annotate in place through
`bun run scripts/queue.ts`, and a task may not be started from here while it is outside the
current iteration's chain in `TODO.md`.

**Where landed work went.** Compacted records live in `DONE.md`; the rationale in `adr/`,
`ARCHITECTURE.md` and the compiler docs; the user-facing summary in `CHANGELOG.md
[Unreleased]`; the full record in `git log -p`. Do not re-derive a decision from a task
entry — read the ADR.

**Standing framing.** The governing premise is the general-purpose framework (REQUIREMENTS §1,
ADR 0034): the published package is `@zeix/le-truc-compiler`, TSX-only at 3.0; template
emission is a v3.0 requirement; and the partial-readiness invariant (ADR 0034 s4) — a fold may
depend only on its props and a closed, enumerable set of page-ambient values — constrains every
design in every band. Server evaluation is three tiers, Folded / Simulated / Static, decided
per component with unresolvability per expression; the compile-warning baseline's target is
zero, and routing signals ride the tier census rather than the diagnostic channel (ADR 0029).
The Simulated tier is kept, SSG-only for all of 3.x (ADR 0035).

## P1 — The v3.0 release track (ADR 0034)

Everything v3.0 does not ship without: the publishable TSX-only `@zeix/le-truc-compiler`
package (LT-254), template emission against the ruled target-emitter interface (LT-257,
ADR 0043), the 2.x codemod (LT-259), and the two Zeix pioneer projects that are the release
gates (LT-260, LT-261). The owner has ruled the first publish waits for the P6 cleanup round —
publishing a package its consumers cannot yet use is not a milestone — so this band sits above
the others in priority but behind P6 in practice. Inside the band the order is LT-254 →
LT-257 → the pioneers, because a pioneer cannot start before the package exists and emission
is proven. LT-377 (no TypeScript types in the published declarations, ADR 0034 s8) lands with
or after LT-254's declaration build. The D-32 design session (LT-471, the public contract) gates LT-254
and runs during the P6 round, so the band opens unblocked.


- [ ] LT-254: Stand up the publishable package `@zeix/le-truc-compiler` (TSX-only) and discharge the LT-206 packaging deferrals. **Gated on LT-370, LT-371 and LT-375** (the pre-publish reshapes of what stays public: the IR leaves the contract, the diagnostic record takes its published shape, the root-is-host dialect is enforced) **and on the D-32 design session** (which compiler entry points and result types are public, `COMPILER_SPEC.md` §12). *Re-gated 2026-10-01:* the IR is internal (ADR 0034 s8, D-25), so the ADR 0040 reshapes (LT-288, LT-274, LT-276) no longer gate the publish.
  **Area:** compiler
  **Needs:** LT-370, LT-371, LT-375, LT-471, LT-480
  **Re-scoped by D-32 (LT-471 design session, owner 2026-10-06; `COMPILER_SPEC.md` §12):** the
  package's one entry point is the **corpus pass**. It writes the artifacts to `outDir` and
  returns the diagnostics and a summary. `compileComponentTsx` is not published. LT-480 does the
  reshape first: it moves `compileCorpus` into the compiler, narrows `RegistryEntry` and
  rewrites the stability policy. This task then publishes whatever `contract.ts` names. The
  D-32 rider below is discharged as follows:
  - the generated-module API is under semver (ADR 0034 s8 stands; LT-480 rewrites the policy);
  - `RegistryEntry` is narrowed (LT-480);
  - Appendix B is refreshed.

  The `typescript-estree` rider stays here: its answer does not depend on the entry-point
  shape, since the converter leaf is the same under every option.
  The `./macros` subpath, the peer floor and the `runtimeImport` default stand as written.
  **Check, amended:** the tarball installs into an empty project and builds a two-component
  corpus through the published entry point, one component composing the other, with no
  `@tsrx/core` in the dependency tree.
  **Rider (LT-429 design session, 2026-10-05):** the package exports a `./macros` subpath (ADR 0034
  s1): the compile-time markers, types plus throwing stubs, built in-repo by LT-442 as
  `server/compiler/macros.ts` behind a `tsconfig.json` `paths` entry. It must resolve without
  loading the compiler's dependencies (typescript, jsdom).
  **Rider for the D-32 session (LT-370 copy review, 2026-10-02):** ADR 0034 s8 counts the
  generated-module API as public (a change is a major), but `contract.ts` and
  `LE_TRUC_COMPILER.md` §2 say semver applies to the designated set "and to nothing else", and the
  generated-module API is not in it. D-32 rules which way it goes: add it to the policy, or amend
  the ADR. Also there: `RegistryEntry` names `RenderedShape` and `SuppressedSite`, and neither is
  exported. `COMPILER_SPEC.md` Appendix B ("as of 2026-09-29") is stale beyond the two cells
  LT-370 fixed; refresh it in the same session.
  **Rider (LT-243 review, 2026-10-01):** `@typescript-eslint/typescript-estree` becomes a runtime dependency of the package. Weigh it under M28 with its closure: semver, debug, minimatch, ts-api-utils and the `@typescript-eslint/{types,visitor-keys,tsconfig-utils,project-service}` siblings. Record the `typescript` peer range the package inherits (`<6.1.0` at 8.71.0). Weigh it against D-33's stated goal (TypeScript 7.1 or a native parser behind the converter, ADR 0032 s4): the peer range must be able to follow TypeScript, and LT-377 pins that no TypeScript type reaches the published declarations.
  **Context:** ADR 0034 s1–s2. The compiler ships separate from the browser-only
  `@zeix/le-truc`, named for its function rather than its input format. **v3.0 publishes the
  `.tsx` front end only** — `.tsrx` stays a first-class repo-internal surface under ADR 0032's
  parity contract and publishes in a later 3.x gated on `@tsrx/core` 1.0, so the published tree
  must not carry the pinned pre-1.0 parser as a runtime dependency.
  **Deliverable:** (a) register `@zeix/le-truc-compiler` on npm **before the first pre-release**
  — verified available 2026-09-19, and a package name is the one decision that cannot be revised
  after first publish; (b) the package manifest, entry points, and a build that excludes the
  `.tsrx` front end from the published artifact without deleting it from the repo; (c) the
  LT-206 deferrals, now scheduled rather than parked: the `check:tsrx`/`build:tsrx` script names,
  `server/effects/tsrx.ts`, the `server/generated/tsrx/` output directory, the `@tsrx/core`
  package names in internal APIs, and the `TSRX###` diagnostic codes — each either renamed to
  surface-neutral vocabulary or consciously kept, with the reason recorded. **Diagnostic codes
  become public API on first publish**: a code that keeps the `TSRX` prefix while the published
  surface is `.tsx` needs a stated rationale, and the copy of anything
  renamed follows `writer` → error-messages (channel: compiler; the error-message-lifecycle sweep applies).
  **Check:** `npm pack` on a clean checkout produces a tarball that installs into an empty
  project and compiles a single `.tsx` component, with no `@tsrx/core` in the dependency tree.
  **Added 2026-09-24 (ADR 0034 s8):** declare `@zeix/le-truc` as a peer dependency with a
  floor, and add a build check that every runtime export the emitted client modules import
  exists at that floor (resolve the imports against the floor version's published export
  list). ~~State in `contract.ts`'s stability policy that adding a member to an IR union is a
  minor~~ — obsolete 2026-10-01: the IR is not public (ADR 0034 s8; LT-370 removes it from `contract.ts`).
  **Re-scoped 2026-09-19 (owner):** deliverable **(c) — the LT-206 deferral sweep — is carved out
  as LT-271** and runs now, because stripping TSRX-only vocabulary from a compiler whose published
  surface is `.tsx` is a shape problem, not a distribution problem, and it should not wait on a
  publish date. What remains here is (a) and (b): the npm registration and the package manifest,
  entry points and `.tsrx`-excluding build. **Gated behind the P6 cleanup round** — the namespace
  is owned, so the name cannot be taken, and there is no value in publishing a package an outside
  consumer could not yet use. LT-259, LT-260 and LT-261 inherit that gate.
  **Carried in from the LT-255 review (2026-09-19):** LT-255 shipped the corpus configuration
  surface without waiting for this task ([ADR 0036](adr/0036-corpus-configuration-surface.md)),
  so "where the config lives" is settled and no longer gates it. One line comes back here:
  **`runtimeImport`'s default must flip** from this repo's relative
  `'../../compiler/runtime'` to the published package specifier
  (`DEFAULT_RUNTIME_IMPORT` in `server/compiler/emit-paths.ts`), at which point consumers stop
  having to set the field at all. Until then every installing project must set it by hand —
  which is the single most visible "this is not published yet" seam in the config surface, and
  a reason the first pre-release should not be demoed without it.


- [ ] LT-257: Template emission — **build the target-emitter interface ([ADR 0043](adr/0043-the-target-emitter-interface-for-template-emission.md)) with Twig as its first implementation** ([M27](REQUIREMENTS.md#m27-backend-neutral-template-emission)). **Release-gating; pioneer 2's critical path.**
  **Area:** compiler
  **Needs:** LT-254, LT-274, LT-373
  **Re-scoped (Architect, 2026-10-01):** the interface was designed in LT-360 and is ADR 0043.
  This entry is the build half. Read the ADR first; this text only names the deliverables.
  **Context:** ADR 0034 s3. For a CMS, a folded HTML partial and a template are the same
  artifact: page props are *content*, so pre-folding per prop signature is combinatorially dead.
  The fold resolves everything prop-independent and leaves each server arg as a **hole**.
  **Deliverable:**
  - The shared template walk over the settled IR, writing through `HtmlWriter` (LT-234): the
    emission-operation vocabulary, portable-subset classification (ADR 0043 s1), escaping-context
    assignment and the shared refusals (s3), emittability per component (s2), and the
    `conditional` node's initial winner as a backend conditional beside inert arm templates (s4,
    built by LT-274).
  - The Twig target: syntax table, exhaustive escaping map, `{% include … only %}` composition
    (s5), one partial per component × locale (s6), the declared host helpers — URL allowlist
    check, `le_truc_sanitize_html`, `le_truc_format` over `MessageFormatter` — listed in the
    manifest for the integrator.
  - Census: per-component tier per target, with the routing reasons (`non-portable initial`,
    Simulated → Static).
  - The trivial second target in `server/tests/compiler/targets/` only: an operation dump plus an
    in-process interpreter, compared byte-for-byte with SSG (s8).
  - CI: a PHP job (`twig/twig`, `intl`) running Twig equivalence, the adversarial escaping
    corpus and the ICU equivalence corpus; local runs skip without `php`.
  - Spec sweep (`COMPILER_SPEC.md`): §3.8 drops "calls to functions marked pure"; §9.2's mapping
    table follows ADR 0043 (message calls as pattern-literal formatter calls, `Compose` with the
    closed-scope include); D-23 and O-6 close; §3.7's "the library ships no sanitizer" is
    corrected for the fail-closed escaping default. *Done 2026-10-01 by the Architect in the §13
    team review* — the spec now follows ADR 0043 in §3.7, §3.8, §6.3, §9.1 and §9.2; nothing left here.
  - **`Try` in template targets is undecided** (D-28, deferred to a design session that amends
    ADR 0043). Do not build a placeholder mapping; until the session rules, a `Try` in a
    template-target build has no defined output, so sequence the Twig target's boundary handling
    after that session.
  **New diagnostics (compiler channel, Prevented; only when a template target is configured):**
  LTC057 — a non-portable expression in a hole position (one face for `Intl` formatting over a
  hole, naming the ICU-pattern fix); LTC058 — a hole in a refused position (faces:
  `<script>`/`<style>` content or comment, `on*`/`srcdoc`, attribute or tag name, whole-string
  `style`). LTC056 is taken by the authored-`<script>` refusal (LT-358 rider). Copy follows
  `writer` → error-messages.
  **Depends on** LT-254 (where it ships), LT-274 (the `conditional` node), LT-373 (the reactivity
  class the hole classifier reads), and the D-28 session for `Try`. LT-258, LT-313 and LT-234 have landed.
  **Check:** every corpus component emits a Twig partial in its tier; the escaping corpus passes,
  negative cases included; the test-only second target passes the same equivalence with no
  change to the Twig target or the shared walk; Twig renders are byte-identical to SSG for every
  fixture × locale; zero-warning baseline unchanged for builds with no template target.

  **Added 2026-10-01 — the `COMPILER_SPEC.md` §13 team review** (decisions D-07, D-20, D-25,
  D-26, D-30, D-33; recorded in ADRs 0032, 0033, 0034, 0040, 0044 and `HOST_PROFILE.md` the same
  day). D-04 is parked, D-28 and D-32 are deferred to design sessions, section 15 is open; none of
  those has a task yet.
  **Added (Architect, 2026-10-06, from LT-453's review, ADR 0047 s4):** a key-alias harvest is
  not emittable to a target: classify it as a census routing outcome (ADR 0043 s2), because a
  backend template cannot carry the render witness. `key-alias.ts`'s `isAliasHarvestable` and
  `aliasScopeOf` identify the lists.

- [ ] LT-259: The 2.x → 3.0 codemod, and the drift-cost measurement it instruments.
  **Area:** compiler
  **Context:** ADR 0034 s6. Pioneer 1 is a Zeix SSG project migrated from Le Truc 2.x, and
  nothing in the queue covered `.ts` + `.html` + `.css` → `.tsx` until now. The owner's read,
  recorded because it scopes the task: the conversion is always possible — JSX reflects the
  static HTML, the factory body copies over verbatim and already runs, and deterministic
  transforms (inline event handlers, 1:1 effects) do ~80%.
  **It is codemod-assisted, not push-button, and must be documented as such.** The residue is
  chiefly resolving `first()` selectors to structural JSX — the hard cases land exactly where the
  old code was sloppiest, which is the drift the compiler exists to eliminate. Deliverable shape:
  a compiling `.tsx` plus a **report of what it could not resolve**, for judgement. At pioneer
  scale (~50 components) that residue is affordable; sold as push-button it disappoints on
  pioneer 1.
  **Second job — it is the measurement instrument.** The drift-cost data point is a before/after
  on the same components, so the 2.x baseline must be captured **before the codemod runs**.
  Define what is measured (the metric is the task's first decision, not an afterthought) and
  record it where REQUIREMENTS §1's criterion can cite it.
  **Check:** the codemod run over this repo's remaining hand-written twins, and over pioneer 1,
  produces compiling sources plus an honest residue report; the baseline exists before either run.


- [ ] LT-260: Pioneer 1 — take the Zeix SSG project live on the published package, through pre-releases. **Release gate.**
  **Area:** design
  **Needs:** LT-254, LT-259
  **Context:** ADR 0034 s6; REQUIREMENTS §1 success criteria. This is the criterion that can
  actually fail: until a project outside `examples/` compiles through the published tool, every
  compiler line amortizes over 22 demo components. Verified through a **series of pre-releases**,
  so the feedback arrives while the API can still change.
  **Deliverable:** the migration executed with LT-259; the pre-release cadence and what each one
  is meant to learn; the drift-cost number captured and written into REQUIREMENTS §1; a recorded
  list of everything the engagement forced back into the compiler, since that list is the honest
  measure of how repo-shaped the tool still was. **Blocks the v3.0 release.**
  **Check:** the project is in production as the release showcase and builds from a published
  version, not a workspace link.


- [ ] LT-261: Pioneer 2 — verify template emission against the Zeix Craft (PHP) project. **Release gate.**
  **Area:** design
  **Needs:** LT-257
  **Context:** ADR 0034 s3/s6. LT-257 is the mechanism; this is the proof, and the owner has
  ruled it must pass **before v3.0 releases**. What is being verified is not that Twig files are
  produced but that a CMS page carries **real content in its initial HTML with no JavaScript**.
  **Deliverable:** the Craft integration — where partials land, how the build fits their
  pipeline, how the `i18n` ambient set is passed through the include; the escaping contract
  exercised against real content, adversarial cases included; a recorded list of what the
  emitter had to grow. **Depends on LT-257. Blocks the v3.0 release.**
  **Check:** JavaScript disabled, a Craft-rendered page shows content-bearing folded markup from
  a compiler-emitted partial; enabling JavaScript corrects nothing that was already right.


- [ ] LT-377: Pin that no TypeScript type reaches the published declarations (D-33).
  **Area:** compiler
  **Context:** ADR 0034 s8 (2026-10-01): no TypeScript type appears in the public API, so the
  engine can move to TypeScript 7.1 or a native parser without a major. ADR 0032 s4 already
  confines `typescript` API use to the converter. Add a contract check that the package's
  emitted `.d.ts` files import nothing from `typescript` or `@typescript-eslint/*`. Lands with or
  after LT-254's declaration build.
  **Channel/tier:** none (a build check).
  **Verification:** the check fails on a planted `ts.Node` in a public type; full gates.


- [ ] LT-480: Reshape the compiler's public contract to the D-32 ruling — the corpus entry point moves into the compiler, `RegistryEntry` narrows to a public projection, and the stability policy names the generated-module API.
  **Area:** compiler
  **Needs:** LT-471
  **Gates:** LT-254
  **Area:** compiler
  **Filed (Architect, LT-471 design session, 2026-10-06):** D-32 is ruled (`COMPILER_SPEC.md`
  §12). This is the pre-publish reshape it implies, in the pattern of LT-370, LT-371 and LT-375:
  the package (LT-254) publishes whatever `contract.ts` names, so the set must be right first.
  **Rulings (owner, 2026-10-06):**
  1. **One entry point, the corpus pass.** `compileCorpus` moves from `server/corpus-compile.ts`
     into `server/compiler/` along with what it needs to run in an installing project:
     - the config loader (`loadCorpusConfig`, `resolveCorpusConfig`);
     - the sibling-module collection;
     - the `i18n` module writer;
     - the census.

     It must not depend on `REPO_CONFIG`, `REPO_ROOT` or the dev server's `io` runtime shim
     beyond a file-system seam the package owns. It **writes** the artifacts, `registry.json`
     and the `i18n` modules to `config.outDir`, and **returns** the diagnostics and a summary.
     Name the summary type. The repo's `server/corpus-compile.ts`, `scripts/build-corpus.ts`,
     `scripts/check-corpus.ts`, `scripts/i18n-sync.ts` and the build effect become thin callers.
     `compileComponentTsx` leaves `contract.ts`: it stays exported internally for the corpus
     pass and the tests.
  2. **`RegistryEntry` narrows.** The public type is the projection a consumer reads: `tag`,
     `name`, `source`, `serverModule`, `clientModule`, `css`, `propsType`, `exposedProps`,
     `tier` and `composesTags`. `renderedShapes`, `suppressedSites`, `composeReadTags` and
     `routingSignals` move to an internal type the corpus pass and compose validation use.
     `registry.json` serializes the public projection only. Check first that no in-repo
     consumer of `registry.json` (CEM build, docs pipeline, dev server) reads a dropped field.
     If one does, move it to the internal type or, if it is genuinely consumer-facing, flag it
     in `NOTES.md` instead of widening the set.
  3. **The stability policy names the generated-module API.** Rewrite the policy in
     `contract.ts`'s header so that semver applies to the designated set **and** to the
     generated-module API, by name and signature, never by bytes:
     - `render<Name>` in each `*.server.ts`;
     - the client module's default export;
     - the `i18n` module's shape;
     - the `registry.json` schema.

     Say that `argsFromAttrs` is internal. The "and to nothing else" sentence goes. ADR 0034 s8
     already reads this way; this brings the policy in line with it.

  **Out of scope:** the incremental API (a later minor, D-32); the input source map (LT-376);
  the package manifest and `exports` map (LT-254).
  **Contract set after this task** (`contract.test.ts` pins it):
  - the corpus entry point and its config, result and summary types;
  - the public `RegistryEntry`, `ExposeKind`;
  - the five `Diagnostic*`/`CompileDiagnostic` shapes;
  - `EvaluationTier`.

  Settle whether `RoutingSignal`, `RoutingSignalOrigin`, `Resolution` and `UnresolvableLimb` stay.
  They stay only if a public type still names them once `routingSignals` leaves `RegistryEntry`.
  Otherwise they leave too: shrinking the set before first publish is free. Do the same for
  `CompiledComponent`, `CompileFileResult`, `SourceSpan`, `EmitPaths` and `DEFAULT_EMIT_PATHS`,
  which belong to the per-file front end.
  **Docs:** `LE_TRUC_COMPILER.md` §2 (the public-contract table and the "result" paragraph) and §7
  (where the corpus orchestration lives) follow the code. Hand the copy to `writer` if the
  rewrite is more than the table.
  **Channel/tier:** none. This task is a contract reshape and adds no new check.
  **Verification:** `contract.test.ts` pins the new set. The corpus builds byte-identically
  before and after (the goldens are unchanged). `registry.json` carries only the public fields.
  Full gates.
## P2 — Internationalization follow-ups (ADR 0030)

Residue of the ICU MessageFormat switch: LT-352 pins the examples' hand-copied `i18n`
attributes against the real render, and LT-362 reports client-message bytes per page with the
dedupe trigger. The standing ruling: serialized-message growth is per instance, per non-source
locale, per adopting component — measured, not argued, and deduplication only pays when a tag
repeats on a page. Small and independent; nothing here gates another band.


- [ ] LT-352: Pin the hand-copied `i18n` attributes on the examples test pages against the real render (LT-219 review).
  **Area:** compiler
  **Needs:** LT-354
  **Context:** `/test/:component` serves each example's `.html` raw — the page renderer never
  runs there — so `form-tokenbox.html`'s `#german-test` instance carries an `i18n` attribute
  copied by hand from `renderFormTokenbox()` at `de` (LT-219). A later edit to a tokenbox
  pattern or to the de catalog leaves that copy stale, and the Playwright spec then passes
  against wording the build no longer serves. Add one server test that renders the instance's
  args at its `lang` and compares the attribute bytes with the page's. Prefer a small table of
  (page, instance id, tag, args) over a per-component test, so the next hand-copied instance
  is one row. (LT-252's six `basic-pluralize.html` locale instances are gone with the example,
  LT-467. module-todo's `pl` spec leg swaps in a real server render, so it holds no hand copy.)
  **Runs after LT-354**, which rebaselines these bytes. Add
  `module-coloreditor.html`'s pre-rendered form-colorgraph and form-spinbutton (`:22`) as rows:
  they carry no attribute, which is correct at en once LT-354 omits source-equal keys, and the
  pin keeps it so. **Channel:** none (a test). **Check:** editing `form-tokenbox.added` in de.json
  without touching the page fails the test.


- [ ] LT-362: Report client-message bytes per page in the build report, with the dedupe trigger (LT-351 follow-up, re-ruled 2026-10-01).
  **Area:** server
  **Context:** ADR 0030 s9's per-instance `i18n` attribute costs bytes per instance, per
  non-source locale, per adopting component (basic-pluralize cy: 957 bytes after LT-354). Today
  the only measurement is one pinned component in `gate-wave-verification.test.ts`, so growth
  as components adopt the channel is invisible. Add to the build report, per served page: the
  total raw and gzipped bytes of `i18n` attributes, and the largest repeat (the same tag with
  byte-identical attributes, N instances). **Trigger, recorded here so nobody has to argue it
  later:** when any served page carries the same tag's identical attribute on 3 or more
  instances, or the page's `i18n` attributes exceed 2 kB gzipped, the Architect opens the
  cross-instance dedupe design (one per-page, per-tag carrier that the instances reference). Per-locale client modules stay
  declined (LT-351 ruling 2). **Channel:** build report (not a warning, no code); the warning
  baseline is untouched.
  **Check:** the report lists basic-pluralize's test page at cy with the LT-354 byte figure. A
  fixture page with three identical instances shows the repeat.

## P2b — Compiler product-readiness

The equivalence contract between the authored surfaces, the diagnostics, and the shared walks
— from the external review and COMPILER_REFLECTION. Two standing rules: adopt a maintained
library where one exists instead of authoring version twelve, and two review proposals stay
declined (memoising the redundant estree traversals; restructuring `sim/`) so future reviews
do not re-propose them. The CSS-departures cluster (LT-405, LT-407–LT-409) was struck on
2026-10-07: ADR 0033's rewrite to authored `@scope` removed the departures it policed. LT-460 sits
above its P6 consumers on purpose: a compose site in an async-boundary arm is an equivalence
gap, and the composition batch below is about to multiply compose-site call sites. LT-381
changes the tier census and warning baseline by design and needs the owner's sign-off; LT-246
waits for the corpus-port migrations to settle the census.


- [ ] LT-134: LTC035 and LTC042 give opposite advice on the same construct (LT-131 review finding). — closed as moot (Architect, 2026-10-02)
  **Area:** compiler
  **Ruling:** LTC035 retired at LT-275 — template-cloned arms keep every non-winning arm
  out of the document, so the diagnostic loop this task described cannot arise. LTC038
  (duplicate compose-site ids) never had the loop: its fix ("distinct ids, or address the
  instances by class") names no per-arm shape. Nothing to do; the residual LTC042 advice
  stands on its own row in `errors.md`.


- [ ] LT-246: Make tier contamination legible at the compose edge — the census names the re-routing edge.
  **Area:** compiler
  **Needs:** LT-109, LT-110, LT-111
  **Context:** Reflection §3's recommendation, promoted under the framework premise: the
  compose contamination fixpoint (LE_TRUC_COMPILER.md §5.2) means a parent that *reads* a
  child — `first()` addressing a compose site, or `truc:pass` into it — inherits the child's
  tier, so "I added a `first()` and my component left the Folded tier" is a different-tier
  outcome whose only footprint is the census. In-house that is an inconvenience; for
  thousands of external users it is a support ticket generator. The fixpoint already knows
  the edge it traverses — record it: the census reason for a contaminated component names the
  compose edge (parent file/tag → child tag) that caused the re-route.
  **Channel (ADR 0028/M23 posture):** build report / census record — not a warning, no new
  TSRX code; the warning baseline and the census's regression signal are untouched.
  **Verification:** a fixture whose parent re-routes via a compose edge shows the edge in the
  census reason; the corpus census stays 20/2/0 with reasons extended, not changed; goldens
  byte-identical (census text is not emitted code); full gates.


- [ ] LT-247: Adopt `magic-string` under `spans.ts` (reflection §5). — **parked 2026-10-01** (Architect): demand-gated only
  **Area:** compiler
  **Needs:** LT-234
  **Context:** Reflection §5 table: replaces `spans.ts`'s hand bookkeeping (~−150 lines) and
  buys **real source maps free** — which M25's span-table remapping and the playground
  (ADR 0025, Proposed) both want eventually. Runs after LT-234 (which settles `CodeBuilder`
  and `commonIndent()` so this swap touches one settled surface, not two in-flight ones).
  **Demand note, stated so this doesn't jump the queue:** the payoff is contingent — source
  maps matter when editor/playground tooling consumes them, and ADR 0025 is Proposed. Do it
  when that demand arrives OR as a small output-neutral swap if it retires code without
  changing bytes; goldens byte-identical is the gate either way.
  **Verification:** goldens + parity byte-identical; the span table's remapped positions
  unchanged on a diagnostic-sample fixture; full gates.
  **Ruling (2026-10-01, from the contributor's evaluation):** the "output-neutral swap that
  retires code" route is closed. `magic-string` edits one original string, but a generated
  statement is emitter glue with source slices interpolated and reindented over the assembled
  text, so the swap would add a `Bundle` and a mappings → `SourceSpan` conversion (every
  consumer reads `SourceSpan`) instead of deleting the recorder. LT-234's `CodeBuilder` already
  took the span bookkeeping. It also turns a transitive dependency (via `@tsrx/core`, repo-
  internal) into a direct one of the published `.tsx` compiler. **Reopens only when** a real
  source-map consumer exists: ADR 0025 (playground) accepted, or editor tooling that reads
  standard source maps. The task is then "emit a standard source map", and `magic-string` is one
  candidate among several (deriving a v3 map from `SourceSpan` directly is the other).
  Struck from the current iteration's exit criterion.


- [ ] LT-363: Harden the shared estree walk for constructs the corpus never saw (LT-229 review).
  **Area:** compiler
  **Needs:** LT-243
  **Context:** LT-229's guarantee that the borrowed keys reach everything the old walks reached
  rests on a one-off audit of 51 corpus files. Nothing pins it, and the corpus is exactly the
  input the framework premise says to distrust. Three parts:
  (1) **Pin the key-coverage invariant.** Add a construct-zoo fixture for both parsers (classes
  with `implements`/decorators/parameter properties, enums, namespaces, `satisfies`, generics,
  overloads, `declare`, abstract members, accessors, labeled loops) plus the corpus. Assert that
  every node-valued key on a type `eslint-visitor-keys` knows is in KEYS, `TYPE_POSITION_KEYS`,
  or a comment key. An exception needs an explicit allowlist entry with a decision. A
  `@tsrx/core` bump that adds a key then fails a test instead of silently dropping a subtree.
  (2) **Make `'skip'` mean "erased".** Today it only drops type-position *keys*, so TS type-only
  declarations nested in code still leak. `freeIdentifiers` over
  `() => { type Row = {…}; interface Box { width: number } … }` returns `Row`, `Box`, `width` on
  `.tsrx`, and only `Row`, `Box` on `.tsx`. Under `'skip'`, skip `TSTypeAliasDeclaration`,
  `TSInterfaceDeclaration`, `TSDeclareFunction` and `declare`-flagged nodes wholesale. Keep the
  runtime-bearing TS nodes walked: `TSEnumDeclaration`, non-`declare` `TSModuleDeclaration`,
  `TSParameterProperty`, and the expression wrappers `as`/`satisfies`/`!`/`<T>x`/instantiation.
  (3) **Complete the scope walk.** `ClassDeclaration`/`ClassExpression`/`TSEnumDeclaration`
  bind their id. Non-computed `MethodDefinition`/`PropertyDefinition`/accessor keys are not
  reads (today `class K { m() {} }` reports `K` and `m`). **Mostly landed under LT-231
  (2026-10-01):** class ids, member keys, labels, function hoisting, named function
  expressions and parameter defaults are done and pinned in `converged-answers.test.ts`. What
  remains: `TSEnumDeclaration` binding its id, and a class declared later in a block but read
  from an earlier closure (`function f() { return new C() }; class C {}`), which is legal JS
  and still reports `C`. That is the same sequential-binding model `const` uses, so fix both
  or neither, and state which.
  Then add a surface-parity assertion: `freeIdentifiers` agrees on every zoo construct across
  `.tsrx` and `.tsx`.
  **Sequencing:** after LT-243. typescript-estree replaces `to-estree.ts`, which today drops or
  flattens several zoo constructs on `.tsx`. Weigh `@typescript-eslint/visitor-keys` (a
  superset of eslint-visitor-keys with TS node keys) for the fallback path then. It is the same
  maintainer and the same pure-data shape, and would turn the TS fallback into borrowed keys too.
  **Channel/tier:** none. No diagnostic is added; each changed answer is a correctness fix to an
  existing analysis, pinned per site as LT-229 did.
  **Verification:** goldens + parity byte-identical (the corpus has no nested type-only
  declarations; prove it); the invariant and parity tests; full gates.


- [ ] LT-369: Converge the `.tsrx` in-template client-statement name check onto the setup one (LT-231 review).
  **Area:** compiler
  **Context:** A bare client-only statement beside conditionally rendered `.tsrx` markup
  (`frontend/tsrx/lower-template.ts`, the `client-stmt` lowering) accepts only `JS_GLOBALS`,
  `CONTEXT_NAMES` and signals. The same statement at top level goes through
  `setup-extraction.ts`'s `clientKnownName`, which also accepts refs, setup consts, authored
  imports, expose ambients and the `CLIENT_ONLY_PRIMITIVES`. LT-231 left them apart on purpose.
  Widening the narrow one is only sound if the client module actually EMITS what the statement
  reads at its guarded position, and `computeClientNeededNames` does not walk `client-stmt`
  nodes today. So: extend the client-need walk to `client-stmt` nodes, then share one
  predicate. Pin a ref read and a plain-import read, each compiling and running in the
  generated client. Check the `.tsx` surface's equivalent (an expression statement in a branch)
  for the same answer; ADR 0032 s6 parity applies.
  **Channel/tier:** compiler. This removes false rejections; no diagnostic is added. Any reworded
  rejection copy follows `writer` → error-messages.
  **Verification:** corpus byte-identical; diagnostic parity; the new pins; full gates.


- [ ] LT-372: JSON and SARIF diagnostic reports (D-30, ADR 0044 s4).
  **Area:** compiler
  **Needs:** LT-371
  **Context:** ADR 0044 makes reports views of one diagnostic stream. The terminal reporter is
  the only one today. Add a JSON report (the records as data, censuses as separate records) and a
  SARIF report for CI code scanning, both selectable from the build's CLI. Additive: neither
  changes the record, so this may land after the first publish. A TypeScript language-service
  plugin is a further view and not part of this task.
  **Depends on** LT-371 (the record shape).
  **Channel/tier:** none.
  **Verification:** the SARIF output validates against the 2.1.0 schema; a JSON snapshot of a
  failing fixture build; locations match the terminal view; full gates.


- [ ] LT-381: Widen `first()` verification — authored selectors verified against the materialized probe (LT-245/ADR 0045).
  **Area:** compiler
  **Needs:** LT-379
  **Context:** [ADR 0045](adr/0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md) Decision 5 stages this deliberately apart from the engine promotion (LT-379): once the probe is the engine, an authored `first('nav a.active')` — descendant combinators, `:not()`, attribute operators, all shapes `parseSimpleSelector` returns "cannot verify" for — can be structurally verified by querying the SAME materialized probe, and then used as the addressed contract verbatim (LT-316's authored-first rule) instead of falling back to synthesis. **Authoring-visible change:** selectors that previously fell back to synthesis become the addressed contract, and a verified-but-unmatched authored selector fires LTC026 where a silent miss (and synthesis fallback) happened before — the census and warning baseline change BY DESIGN, so this task enters an iteration only by iteration planning, with the owner's sign-off on the behavior. Scope the first landing to descendant combinators, `:not()` and attribute operators; child/sibling combinators (`>`, `+`, `~`) cannot cross the probe's exclusivity wrappers (ADR 0045 Consequences) — keep them "cannot verify" unless a follow-up first extends the wrapper model. Gate: LT-379 landed.
  **Channel/tier:** no new runtime check; verification widening strengthens tier 1 (Prevented). LTC026's existing wording stands unless it must distinguish verified-miss from unverifiable — if it does, the copy follows `writer` → error-messages.
  **Verification:** new pins (authored selector used verbatim when verified; LTC026 on verified-miss; synthesis fallback unchanged for child/sibling and unparseable); goldens change ONLY where a corpus component's authored selector newly verifies — assert none today, or enumerate the delta in the handoff; full gates.

- [ ] LT-483: '`handleAsyncBoundary` checks client positions against `badFreeNames` where every other arm-set handler uses `fx.scopeBadNames` — align it.'
  **Area:** compiler
  **Gates:** test:server
  **Area:** compiler
  **Filed (Architect, 2026-10-07, from LT-481's residue 2):** in
  `server/compiler/analysis/effects.ts`, `handleAsyncBoundary` destructures
  `badFreeNames: badNames` and passes it to the ok arm's construct effects and, since LT-481, to
  the pending and catch compose roots' pass entries. `handleReactiveConditional` and the other
  Mount Scope handlers read `fx.scopeBadNames`, which, inside a reactive-list item, refuses the
  names a list body cannot read on the client (setup consts and imports: LTC005's server-only
  face). The review probed an item-nested boundary whose pending compose root passes
  `() => item.get()`: it plans correctly, so item names are not affected. A setup-const or
  import read in an item-nested boundary's client position was not probed. It may compile clean
  and then fail at runtime in the cloned item.
  **Change:** probe the setup-const read in an item-nested boundary on both surfaces (ok-arm
  construct and pending compose root pass entry). If it compiles clean, switch
  `handleAsyncBoundary` to `fx.scopeBadNames`. If it is already refused upstream, still align
  the reader for consistency and record the probe here.
  **Check:** a both-surface test pins the probed shape's diagnostic (LTC005 server-only face),
  and host-level boundaries are unchanged (`test:server`). CHANGELOG Fixed only if the shape
  compiled clean before.
  **Channel/tier:** compiler check, tier 1 Prevented; no runtime check.

- [ ] LT-484: An element root of an async boundary's pending or catch arm refuses every client construct, while a reactive conditional's element arm root plans them — decide whether boundary arms gain parity.
  **Area:** design
  **Area:** design
  **Filed (Architect, 2026-10-07, from LT-481's residue 3):** the two arm-set kinds treat their
  element roots differently. A reactive `@if`/`@switch` arm root plans its client constructs in
  the arm's mount through `emitConstructEffects`. An async boundary's pending or catch element
  root refuses every client construct except the catch-parameter text channel (LT-449). LT-481
  made a compose root in those same arms plan its `truc:pass` entries, so an author can now pass
  a reactive value to a composed pending root but cannot bind a reactive attribute on an element
  pending root. Both lowerings are arm mounts under `reconcile()`.
  **Question for the session:** should pending and catch element roots plan constructs the way
  reactive-conditional arms do? Or is the refusal deliberate (ADR 0041's three-arm boundary,
  with the in-flight state as the `isPending` idiom outside the boundary) and should be kept,
  with a sharper message that names the idiom? Read ADR 0037, ADR 0041 and LT-449 before
  ruling. Out of the session comes either a `compiler` task or a recorded refusal.
## P3 — Gate-wave residue

Latent correctness and diagnostic-precision items, independent of the release track and of
each other. The one ordering rule inside the band is LT-148 after LT-147 (the `internals`
routing builds on LT-147's reverse IDL name table); everything else is freely pickable and
safe to interleave with any band. None blocks the publish — they exist because the gate wave
found them, and they are cheap to pick when a band above stalls.


- [ ] LT-147: Lower reactive `aria-*` on element targets to `bindAria()`, with a reverse IDL name table.
  **Area:** compiler
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
  Playwright example specs stay green (they assert on the ARIA *attributes*, which native
  reflection still mirrors for element targets); the post-ADR-0029 zero-warning gate holds (use
  the gate, not a hand-maintained expected count).


- [ ] LT-148: Route the component's OWN host ARIA to `internals`, and diagnose CSS that depends on host ARIA attributes. **Depends on LT-147's mapping table.**
  **Area:** compiler
  **Needs:** LT-147
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


- [ ] LT-170: Strengthen two gate-wave assertions in `gate-wave-verification.test.ts` that don't test what they claim.
  **Area:** compiler
  **Context:** Filed by the LT-144/LT-145 review (2026-09-03), re-confirmed present 2026-09-17.
  Two tests in `server/tests/compiler/gate-wave-verification.test.ts` pass today but don't verify
  the behavior their name/comment claims — a regression in the underlying compiler behavior
  would fail neither.
  1. **`'the reactive spelling plans a client binding the static spelling does not'`** (line
     ~440) only asserts `hostVariant.spans`/`bareVariant.spans` are truthy — true of any
     compiled component. Fix: assert on the actual compiled `clientCode`, e.g.
     `hostVariant.clientCode` contains a `watch(...host.count...bindText(` call and
     `bareVariant.clientCode` does not (confirmed by hand at review: the distinction is real and
     present today).
  2. **`'composed under form-combobox, initial render stays hermetic'`** (line ~483) only
     asserts the string `<form-listbox` appears in the composed output — trivially true.
     `form-combobox` composes its listbox with `filterable={false}`, so there is no clear button
     to check; the acceptance-relevant behavior is the other known composed-filter case from the
     LT-154 review (the combobox's selected-but-`hidden` inner option is authored `truc:pass`
     filter wiring). Assert the first option renders both `aria-selected="true"` AND `hidden=""`
     in the initial (pre-`truc:pass`) render, matching `sim-driver.test.ts`'s own corpus
     snapshot for `form-combobox`.
  Acceptance: both tests fail if the underlying compiled/rendered behavior regresses;
  `bun test server/tests` stays green.


- [ ] LT-297: `argsFromAttrs` keys attributes by the arg's camelCase name (LT-290 close-out; latent).
  **Area:** compiler
  **Context:** the page-occurrence helper reads `attrs["bigStep"]`, but HTML attribute
  names are case-insensitive and serialize lowercase, so an authored `big-step`/`bigstep`
  occurrence never matches. A camelCase string or Parser arg would silently lose its
  channel and render the default. Not live today: LT-290 removed spinbutton's only
  camelCase channel, and no other corpus arg is camelCase. Key by the attribute name the
  client parser reads (the same mapping `expose()`'s Parser reads at connect), and pin
  it with a camelCase fixture.
  **Check:** a fixture with a camelCase Parser arg renders its authored attribute value;
  goldens unchanged.


- [ ] LT-340: LTC033 sees only the expression written at the site, so an impure read through a setup const, helper or loop const folds (LT-326 review).
  **Area:** compiler
  **Context:** confirmed at review on `.tsx` (`.tsrx` is the same code path). All of these
  compile clean and bake one build-time reading into the page:
  `const shuffled = [...items].sort(() => Math.random() - 0.5)` then a loop over `shuffled`;
  `const shuffle = (xs) => [...xs].sort(() => Math.random() - 0.5)` then `shuffle(items)`;
  a `const id = crypto.randomUUID()` hoisted inside an `@for` body; `{id}` or `{rid()}` as a
  static text child over such a const or helper. Only the inline spelling fails LTC033,
  because `containsImpureAmbient` checks the site's own node. The setup-const and helper forms
  are how a shuffle is usually written, so LT-326 closes only the least common spelling.
  **Rule:** report LTC033 at the server-evaluated position that *reads* the impurity, not at
  the declaration. A setup const whose value never reaches markup is harmless. Reuse LTC054's
  mechanism in `fold-inputs.ts`: the `tainted` fixpoint over setup helpers, extended to
  non-function setup consts and hoisted loop consts, with impure-ambient causes in place of
  page-context reads. Keep the `Intl` scope rule: a helper's locale argument resolves in the
  caller's scope. Static positions only. A reactive thunk reading a tainted const keeps
  today's omit-and-correct behaviour (LT-165 step 5).
  **Channel:** compiler. **Tier:** 1 Prevented (existing LTC033). **Copy:** follows `writer` →
  error-messages, if the builders need a "through `name`" clause naming the carrier. LTC054 reports
  reads through helpers without one, so decide by consistency with it.
  **Check:** the five probes above fail LTC033 on both surfaces. A resolvable-locale `Intl`
  helper still folds. A setup const holding `Math.random()` that is read only in client code
  compiles. Corpus output byte-identical; census unchanged.


- [ ] LT-365: Move the discriminated-compose probe to the positive config as an in-place `@ts-expect-error` (LT-364 review).
  **Area:** compiler
  **Context:** `server/tests/compiler/fixtures/tsx/discriminated-compose.tsx` (LT-346, pins LT-343)
  is a must-fail file in `tsconfig.neg.json`. Its point is that line 27 (`collapsed` without `id`)
  errors and line 26 doesn't. The test pins this by line number and message text in
  `tsx/typecheck.test.ts`, and the editor shows the intended error as a live squiggle. A JSX-comment
  directive on the line before the element says it in place, and was verified 2026-10-01:
  `{/* @ts-expect-error — LT-343: collapsed ⇒ id */}` suppresses the error. An unused directive
  is TS2578, so a regression to a flattening `Omit<P, 'i18n'>` fails the positive config.
  The attribute-line form (`// @ts-expect-error` between attributes of a multi-line tag) does
  NOT work: a missing-prop error is reported at the tag name, so that directive goes unused.
  **Do:** add the directive above the line-27 element; drop the file from
  `tsconfig.json`'s `exclude` and from `tsconfig.neg.json`'s `include`; delete the two
  `discriminated-compose.tsx(…)` assertions from the negative test; update the file's header
  comment (it says "must FAIL tsc") and the positive-config comment in `typecheck.test.ts`.
  **Trade-off accepted:** `@ts-expect-error` accepts *any* error on that line, so the exact
  `LibraryManagedAttributes<` message is no longer pinned. The probe is about which line fails,
  so that's acceptable. The other negative probes (`async-bad-arms`, `bad-host-typo`,
  `i18n-bad-reads`, `combobox-bad-args`) depend on their exact messages and stay in the neg config.
  **Verification:** `bun test server/tests/compiler/tsx/typecheck.test.ts` green. Then, temporarily,
  swap `LibraryManagedAttributes`'s distributive omission in `host-profile.d.ts` for a plain
  `Omit`: the positive config must fail with TS2578. Revert.

## P4 — Migration guards for 2.x authors

Guards for hand-written 2.x components migrating to 3.0: today only LT-281 (flag a non-void
factory return, authored-surface rule plus DEV_MODE warning). The Cause & Effect 2.0 re-export
rewrite joins this band when CE 2.0 ships; it is blocked upstream, not by us. The band grows
only if migration feedback surfaces new sharp edges — deliberately small, so it never competes
with the release track.


- [ ] LT-281: Flag a non-void factory return — authored-surface rule + DEV_MODE warning (LT-179 residue).
  **Area:** compiler
  **Context:** TypeScript's void-return assignability means a legacy 2.x `return [...]`
  factory still compiles against LT-179's `(context) => void` factory type while its value is
  silently ignored — a migration trap the types cannot catch (pinned by the "a factory return
  value is ignored" test in `component.test.ts`). ADR 0028 sub-design 1: a factory
  `return`-with-value is statically decidable, so a runtime check owes a compiler rule.
  **Channel and tier (ADR 0028 s1):** compiler — an `LTC` rule for a `return` statement
  carrying a value in factory-body position on authored surfaces, tier 1 Prevented; runtime —
  a `DEV_MODE` warn in `connectedCallback` for hand-authored `.ts` consumers, tier 2
  Contained (the component still enhances; the return is ignored). Not urgent for the
  compiler-authored corpus (generated clients never return); aimed at prerelease early
  adopters migrating 2.x hand-authored components.
  **Check:** catalog rows added; compile-warning baseline 0 holds; batch the copy with the
  LT-275/LT-189 rounds.

## P5 — Migration-review residue

Compose-site and setup-const ergonomics the wave-4 example migrations surfaced (LT-309,
LT-331, LT-333, LT-336, LT-337). LT-310 (reactive attributes on the component root) is the
band's one design session: it needs an ADR 0024 s3 check and an owner ruling before any
implementation. The band's old compose-site event-handler item is absorbed by LT-461's ruled
handler-args design in P6 and carries only its tombstone.


- [ ] LT-309: module-codeblock follow-through from the LT-096 review
  **Area:** examples
  **Context:** Two changes, both on `module-codeblock` (both surfaces where applicable).
  (a) The overlay's `on(overlay, 'click', …)` in `.tsx` setup is a workaround that LT-096's own
  selector fix made unnecessary. Its comment is now false. Inline it as `onClick={() => ({
  collapsed: false })}` on the overlay button and drop the explicit `overlay` ref if nothing
  else reads it. Verified in review: it lowers to `first('button:not(basic-button *)')` plus a
  guarded `on()`. Also fix the emitter printing an empty `if (overlay) {}` guard when a ref's
  only use is a setup `on()`.
  (b) The copy messages are read from the COMPOSED child's host (`copy.getAttribute(
  'copy-success')`). `copy-success` is not an attribute basic-button declares, so this reaches
  past the child's boundary (HOST_PROFILE § data account, bullet 3). The page chrome is also
  inconsistent: `fence.markdoc.ts` writes the pair on both hosts, while `fragments.ts`
  `tabPanel` writes it on the codeblock host only, so tab panels silently fall back. Make
  `copy-success`/`copy-error` module-codeblock's own config attributes: optional args with the
  current defaults, rendered on the root, read from `host`. Drop the duplicate on the inner
  basic-button in both chrome generators, and update the twin in the same commit. This is a
  contract reshape, approved here (the LT-095 checkpoint pattern). Spec: add a tab-panel-shaped
  fixture carrying custom messages on the host only.


- [ ] LT-310: Reactive attributes on the component root element
  **Area:** design
  **Context:** `collapsed={() => host.collapsed}` on a template root is LTC005 today ("reactive
  constructs on the component root"). So reflecting a Parser-exposed prop back onto the host
  stays a hand-written setup `watch('collapsed', bindAttribute(host, 'collapsed'))`, the last
  non-template statement module-codeblock needs besides the copy wiring. The pattern recurs
  (open/collapsed/expanded state on hosts). Design first: the server renders the root attribute
  from the arg, the Parser seeds from it at connect, and the thunk rebinds it. That is one
  channel, but LTC039's root-attribute exemption and the fold of `host.<prop>` on the root need
  checking against ADR 0024 s3 before implementation. Needs an ADR amendment or a short ADR;
  new diagnostics' copy follows `writer` → error-messages.


- [ ] LT-311: Event handlers on compose sites — closed as absorbed — LT-461's ruled handler-args design owns this ground (2026-10-06)
  **Area:** design
  **Closed as absorbed (Architect, 2026-10-06):** LT-461's owner-ruled handler-args design
  covers this task end to end — the compose-site `onClick={…}` spelling maps to the child's
  declared `on[A-Z]` function arg and lowers to a parent-side `on()` on the placed element,
  typed as an ordinary prop (LT-461 rule 8), so the `ComposeSiteAttrs` typing question is
  answered there too. The module-codeblock copy-wiring case this task came from is one of
  LT-461's verification legs. The context below records the pre-ruling proposal.

  **Context:** A PascalCase compose site has no event-attribute kind (only arg/pass/ref), so a
  parent's reaction to a composed child's event must be a setup `on(childRef, …)` or a raw
  `EffectDescriptor`. module-codeblock's copy wiring is the case: a guarded
  `watch(() => true, copy ? copyToClipboard(…) : () => {})`, because `if` is LTC005 and
  `watch()` in a const-call is LTC045. Proposal: `onClick={…}` on `<BasicButton>` lowers to
  `on(<compose-ref>, 'click', …)` on the child's host. The listener attaches to the child's
  public element, not its internals, so it respects the boundary; the compiler's optional-ref
  guard replaces the hand-written ternary. `copyToClipboard` then becomes a plain click-handler
  factory. Decide the typing: the `.tsx` host profile needs `on*` in `ComposeSiteAttrs`, and
  `.tsrx` needs the same classification. Depends on LT-309(b) for the message channel.


- [ ] LT-331: Compose-site JSX children must type-check against the child's `children` server arg (LT-303 review).
  **Area:** compiler
  **Context:** To make `<truc:try>`'s `children: JSX.Element` a `tsc` fact, LT-303 declared
  `JSX.ElementChildrenAttribute` in `server/compiler/frontend/tsx/host-profile.d.ts`. That
  declaration is global, so `tsc` now also checks a compose site's JSX children against the
  child's args. But a content-substituting child declares `children?: string`: the server
  renders the markup to a string and forwards it (ADR 0024 s10, `validateComposedChildren`).
  The result, verified 2026-09-25: `<ModuleScrollarea><p>…</p></ModuleScrollarea>` in a `.tsx`
  parent now fails with TS2322 "Type 'Element' is not assignable to type 'string'", although it
  type-checked under the old profile. module-dialog and module-codeblock have the same shape.
  No `.tsx` parent composes one yet. The declaration also fixed a bug that was there before
  LT-303: a child with a *required* `children` arg could not be composed with JSX children at
  all, because `tsc` reported the prop as missing.
  **Design (Architect):** keep `ElementChildrenAttribute`, and have `LibraryManagedAttributes`
  map the child's string `children` arg to JSX content:
  `Omit<P, 'i18n' | 'children'> & ComposeChildren<P> & ComposeSiteAttrs`. `ComposeChildren<P>`
  is `{}` when `P` has no `children`, `{ children?: JSX.Element }` when it is optional, and
  `{ children: JSX.Element }` when it is required. That makes JSX content the authored
  spelling and keeps the markup string out of it. It also keeps the new `tsc` error for JSX
  children passed to a child that declares no `children` arg. That error is correct: the
  compiler has no `{children}` site to substitute them into. Rejected alternative: dropping
  `ElementChildrenAttribute` and making `TrucTryAttrs.children` optional. That brings back
  the required-children bug and gains nothing, because the compiler already enforces the
  async boundary's single-root rule.
  **Channel/tier:** TypeScript, tier 1 Prevented. No runtime or compiler check changes.
  **Check:** a positive fixture composing `ModuleScrollarea` with JSX children and a negative
  one (JSX children passed to a child with no `children` arg), both in
  `server/tests/compiler/fixtures/tsx/` and asserted in `tsx/typecheck.test.ts`. The fixtures,
  negative-fixtures and examples `tsc` programs stay clean apart from the expected new
  negative errors.


- [ ] LT-333: Extend LT-323's client-only credit to plain setup consts (LTC013/LTC043 over-routing).
  **Area:** compiler
  **Context:** LT-323 stopped a *signal* whose consumers are all client-only from routing
  Simulated. A *plain setup const* gets no such credit. `const panels = all(…)` routes on
  LTC013, and `const setHTML = dangerouslyBindInnerHTML(contentEl, …).ok` routes on LTC043, even
  when the only readers are `on`/`watch`/`each` statements and no value reaches markup. That
  lands module-carousel (three LTC013) and module-lazyload (one LTC043) Simulated with no
  reactive render site. **Rule:** the same credit as LT-323, "at least one client-only read,
  none a render read". It must be transitive through consts (LT-327) and through `expose()`
  initializers, which the server module evaluates. A const read by `expose()` is a render read
  for this purpose. The Folded-tier emitter already drops an unreferenced unevaluable const
  (`dropUnreferencedUnevaluable`), so this is a routing change only.
  **Channel/tier:** none (routing).
  **Check:** lazyload and carousel route Folded, or the entry records the residual reason.
  Their sim-driver and equivalence snapshots stay append-only. The census moves from 30/5/0 to
  32/3/0 if both fold. carousel's inline `all()` in its `index` initializer stays, since that
  is an `expose()` read.


- [ ] LT-336: `argsFromAttrs` attribute lookup — the kebab-case convention's fallback and its documentation (LT-095 review).
  **Area:** compiler
  **Context:** **Ruling (Architect, 2026-09-25):** a server arg's page-occurrence attribute is
  its **kebab-case** name (`readingTime` ← `reading-time`), the HTML convention every Parser
  attribute already follows (`allow-scripts`). A `number` arg gets a numeric channel, where a
  blank value is absent and a non-numeric one leaves the occurrence unrenderable. LT-095 landed
  both. **Residue:** form-spinbutton's markup writes `bigStep`, which parse5 lowercases to
  `bigstep`, so the occurrence matches neither the old camelCase lookup nor the new kebab one.
  Either fall back to the lowercased name when the kebab name is absent (HTML's own
  case-insensitive matching), or port spinbutton's markup to `big-step`. The contributor decides
  from how many authored occurrences exist.
  **Docs:** state the convention in HOST_PROFILE (the i18n/page-render section) and
  LE_TRUC_COMPILER.md § page occurrences.
  **Channel/tier:** none.
  **Check:** a page-render test for the chosen spinbutton spelling; corpus output
  byte-identical.


- [ ] LT-337: A destructuring setup const is diagnosed at its reader, not at itself (LT-104 review).
  **Area:** compiler
  **Context:** `const { ok: setHTML } = dangerouslyBindInnerHTML(…)` compiled without a
  diagnostic at the declaration. The generic LTC005 "other than const declarations" message
  then fired at the *next* statement reading `setHTML`, the `watch`, which sends the author to
  the wrong line. Either accept object- and array-pattern consts in the setup subset (bind every
  pattern name as a setup init, which `collectBoundNames` already supports), or diagnose the
  declaration itself with a fix-it (`const x = expr.ok`). Prefer accepting them: the rewrite
  is mechanical and authors write destructuring by habit. **Channel/tier:** compiler, tier 1,
  if diagnosed; none if accepted. Any new copy follows `writer` → error-messages.
  **Check:** lazyload's original destructuring spelling compiles, or fails at its own line.

## P6 — Cleanup round and the composition batch

The cleanup round the first publish waits for (see P1), unblocked by the corpus port's close.
It carries two kinds of work: the standing cleanup items (LT-093, which absorbed LT-135;
LT-136, LT-282, LT-437), and the composition batch — convert the compiled corpus from raw
custom-element markup to sub-components (LT-463) on the compiler enablers LT-460 and LT-470
(kept in P2b) and LT-461's ruled handler-args design, beside LT-464, LT-466 and LT-467. The two
sites that need the children contract ride the design spine LT-465 → LT-462 (ADR 0048) and its
implementation tasks (split from LT-463, owner 2026-10-06). The section-menu chrome migration (LT-469, from
LT-446's ruled design) closes the last uncompiled example folder and interleaves freely.
Ordering matters: the design spine and
enablers before the corpus conversion, while the cleanup items interleave freely because none
of them touches the compose machinery.


- [ ] LT-135: Follow plain-const indirection when crediting client-only setup reads (LT-119 sharp edge). — merged into LT-093 (owner, 2026-10-06)
  **Area:** compiler
  **Merged into LT-093 (owner, planning 2026-10-06).** Same wall, one pass through the
  client-needed fixpoint; LT-093's entry carries this task's fix and its test flip.

- [ ] LT-487: module-todo's ar/cy/lv strings need a translator pass — six empty labels per locale and a doubtful `remaining` plural.
  **Area:** docs
  **Needs:** LT-467
  **Gates:** check:corpus
  **Area:** docs
  **Needs:** LT-467
  **Filed (Architect, 2026-10-07, from LT-467's doubt 2):** LT-467 added seven `module-todo.*`
  keys to every locale. de, pl and zh are translated. In ar, cy and lv the six labels (`addTodo`,
  `filter`, `all`, `active`, `completed`, `clearCompleted`) are empty `i18n:sync` placeholders,
  which fall back to the source string by design (HOST_PROFILE.md, "A missing translation is
  not your problem to fix"). The `remaining` patterns reuse the retired example's noun forms.
  lv `other {Atlikuši # uzdevumu}` uses the genitive plural where Latvian likely wants the
  nominative (`uzdevumi`), and cy `other {# tasgiau ar ôl}` may want the singular after a
  numeral.
  **Do:** a native or careful reviewer fills the ar/cy/lv labels and corrects each `remaining`
  arm per locale. Keep every plural category the locale's CLDR rules name, plus the `=0` arm.
  No code change.
  **Check:** `check:corpus` translation census stays at 0 gaps. The `pl` leg in
  `module-todo.spec.ts` is the model if a locale leg is wanted.

- [ ] LT-492: Lift LTC011 for `truc:html` in a composed element's content — the parent's own sanitized binding (ADR 0048 s1).
  **Area:** compiler
  **Needs:** LT-472
  **Gates:** test:server, check:corpus
  **Area:** compiler
  **Needs:** LT-472
  **Filed (Architect, 2026-10-07, from LT-463's review; owner ruling 2026-10-07):** `<div
  truc:html={start}/>` inside composed `<ModuleScrollarea>` children fails LTC011 through
  `composedElementUnsupported` ("`html` attribute in a composed element's content is not supported
  yet", ADR 0024 s10). That blocks module-splitview's conversion (LT-493).
  **Ruling:** content the parent passes as `children` belongs to the parent (ADR 0048 s1), so a
  `truc:html` on an element in that region is the parent's own binding, exactly like a
  `truc:html` in the parent's own template. It goes through the same sanitized channel (LT-025):
  the server render sanitizes and splices it into the children string, and a reactive thunk binds
  from the parent's client against the parent-owned element. **Rejected:** a markup-valued
  ModuleScrollarea prop. It would open a second HTML channel just for this one child and route
  markup through an arg that no sanitizer sees.
  **Change:** drop the `html`-attribute case from the composed-content refusal. Lower it through
  the existing `truc:html` emission, in the Children Region scope that LT-472's query re-include covers. The other
  constructs `composedElementUnsupported` names stay refused. Amend ADR 0024 s10's "not supported
  yet" list in place (it is unpublished) and cross-reference ADR 0048 s1.
  **Check:** `test:server` pins three things: a static `truc:html` arg in composed children
  renders sanitized server-side, a reactive thunk binds client-side, and a script in the markup
  is stripped. `check:corpus` green.
  **Channel/tier:** compiler — LTC011 narrows; no new check. The sanitizer's existing tier-2
  containment applies unchanged.

- [ ] LT-493: module-splitview composes `<ModuleScrollarea>` for its panes.
  **Area:** examples
  **Needs:** LT-492
  **Gates:** check:corpus, test:variants, test:server, typecheck
  **Area:** examples
  **Needs:** LT-492
  **Filed (Architect, 2026-10-07, from LT-463's review):** module-splitview's panes are LT-463's
  last named scrollarea site. The conversion was reverted there because `truc:html` inside
  composed children was LTC011-refused, and LT-492 lifts that refusal.
  **Change:** in `module-splitview.tsx`, each pane's `<module-scrollarea>` becomes
  `<ModuleScrollarea …>` with its `<div truc:html={…}/>` as children. Leave the `.ts` twin as it is,
  and keep the CSS byte-identical. Update the source header to name the composition (LT-463,
  LT-492).
  **Check:** `check:corpus` green; `bun run test:component module-splitview` green on all
  surfaces.
  **Channel/tier:** none — corpus conversion.

- [ ] LT-494: FormRadiogroup's `.split-button` variant hides its own legend and radios; module-todo composes `<FormRadiogroup>`.
  **Area:** examples
  **Needs:** LT-463
  **Gates:** check:corpus, test:variants, test:server, typecheck
  **Area:** examples
  **Needs:** LT-463
  **Filed (Architect, 2026-10-07, from LT-463's review; owner ruling 2026-10-07):** module-todo's
  filter radiogroup stayed raw. The composed render cannot carry the page-level `visually-hidden`
  class on the legend and the radio inputs. (Under ADR 0033 as revised 2026-10-07, the parent
  could style the child's internals without a limit, but LTC087 would flag it as a leak. The
  ruling stands: the presentation is the child's.)
  **Ruling:** that presentation belongs to the child's own `.split-button` variant. Every
  split-button usage hides the legend and the native radios (see `form-radiogroup.html`), so the
  variant's own stylesheet owns it. No new prop. **Rejected:** a presentation arg (`hideLegend`
  and similar), which would expose one variant's internals as API, and accepting a visible
  difference.
  **Change:**
  1. In FormRadiogroup's sheet, `&.split-button` visually hides `legend` and
     `input[type="radio"]` with the same declarations as the shared `.visually-hidden` utility,
     so the legend keeps its accessible name and the inputs stay focusable. The page-authored
     demo drops its now-redundant `visually-hidden` classes, or keeps them (harmless). Pick
     whichever leaves `form-radiogroup.spec.ts` unchanged. The hand-written `form-radiogroup.css`
     gets the same rule, so its CSS matches the compiled sheet.
  2. module-todo (`.tsx` and `.tsrx`) composes `<FormRadiogroup class="split-button" name="filter"
     legend={t.filter} options={…} value="all" />`, with the option labels from `t.all`,
     `t.active` and `t.completed`. Remove the raw markup's LT-463 comment.
  **Check:** `check:corpus` green; `bun run test:component form-radiogroup` and `module-todo`
  green on all surfaces, with no expectation changed. If a spec expectation must change beyond
  the composed root's attributes, stop and write it in `NOTES.md` (LT-463's rule for surprises).
  **Channel/tier:** none — corpus CSS and composition.
## P7 — Backlog (not scheduled)

Owner-parked designs, explicit 3.0 non-goals, and items gated on a real need. The non-goals
are recorded in their ADRs rather than as tasks — stage 2 of style composition (ADR 0042 s3),
Shadow DOM mode (ADR 0033 s8), the foreign-runtime tier (ADR 0032), publishing the `.tsrx`
front end (ADR 0034 s1) — so this band holds only what has an entry. The fetched-partials
family waits here as owner-gated design sessions: LT-448 (partials bringing new components —
script admission, loading, `allow-scripts`) beside LT-450 (HTML partials on demand).
Gated-on-need items (LT-214, LT-269, LT-270, LT-357) wake when a consumer appears; everything
else moves up only by owner direction. The corpus gates are parked here pending iteration
planning (ITERATION ruling 15): `check:dead-css` (LT-506) and `check:html` (LT-508 → LT-509,
LT-510). `check:html` runs html-validate and axe-core over every component's server render, held
to the REQUIREMENTS §4 Accessibility bar for the corpus.

- [ ] LT-076: Establish a dev-mode signal for generated `.tsrx` client code, then implement the hydration assertion (CHECKLIST §6).
  **Area:** compiler
  **Context:** Architecture decision 2026-08-29: generation-time inlining.
  `server/build.ts`/`server/effects/tsrx.ts` gain a dev/prod mode from the build pipeline (the
  docs site's examples bundle ships dev diagnostics today — `build:examples:js` already defines
  `DEV_MODE='"true"'`), pass it to the compiler as a `devMode` option, and the compiler INLINES
  the folded constant into generated client modules. Generated code must never reference
  `process.env` (bundler-agnostic, constant-folded at generation, same philosophy as the
  library's own `--define`). With that signal in place, implement CHECKLIST §6's hydration
  assertion: on upgrade, recompute each folded expression and `console.warn` on mismatch —
  emitted only under the generation-time dev flag and folded away entirely otherwise.


- [ ] LT-078: Implement conditional branch tree-shaking for `@try`/`@pending`/`@catch` (CHECKLIST §9).
  **Area:** compiler
  **Context:** Performance optimization, not a bug fix (LT-065 confirmed the current
  unconditional behavior is already safe). Needs a new usage-graph analysis: shake (emit no
  client task) only when the resolved value is read nowhere outside its own arm AND the guarding
  promise depends solely on server-definitive args. `form-listbox.tsrx` is the one real consumer
  of the async boundary — build fixtures around it, same caution as LT-077.
  **Re-pinned (LT-276 review, 2026-10-02):** with template-cloned arms every arm ships as a
  template and the client clones on demand; the question is now only whether to omit an arm
  template (and its mount) the client can never select. The form-listbox premise is stale —
  no corpus component uses the boundary (it is named in a comment only); a consumer comes
  with LT-390.


- [ ] LT-214: Dead-rule detection over the parsed stylesheet (ADR 0042 s1). **GATED on a real need** (ADR 0042 is Proposed): the selector-prefix half of this task moved to LT-304 with the ADR 0033 ruling (2026-09-24).
  **Area:** compiler
  **Needs:** LT-268
  **Context:** A rule under the component's own tag that matches **zero** elements of the
  rendered template warns: a typo, a renamed class, a rule left stale by a markup refactor.
  `matchesSelector`/`countForSelector` (`server/compiler/analysis/selectors.ts`) already
  answer it and are load-bearing for LT-118's branch-root collision check. **Channel
  compiler, tier 2 Contained**: light-DOM markup is not closed, so the check must
  **exempt** any subtree holding a compose node or `dangerouslyBindInnerHTML`, exempt
  `::slotted` and reaches into composed children, and respect LT-124's deliberate widening
  of class matching for page-authored enhancement. An over-eager version is worse than none.
  **Depends on LT-268.** **Coordinate with LT-245**: if the `css-select` + `parse5` spike
  lands, the check gets cheaper, so do not hand-roll a CSS matcher for it first.
  **Acceptance:** a fixture whose stylesheet names a class no element carries warns; a
  fixture with a compose site or `dangerouslyBindInnerHTML` in the matched subtree does
  **not** warn; corpus warning baseline stays 0.


- [ ] LT-262: AEM/HTL integration spike — ahead of pioneer 3, not during it.
  **Area:** design
  **Context:** ADR 0034 s3 and its Bad consequence: AEM is a build-**integration** problem, not
  an emit problem. Component dialogs, the authoring model and clientlibs are undesigned, and the
  HTL emitter is the smallest part of it. Pioneer 3 is a client engagement, which is the wrong
  place to discover the shape.
  **Deliverable:** a spike answering how a compiler-emitted HTL partial reaches an AEM component,
  how clientlibs consume the generated client module and CSS, what the dialog/authoring model
  demands of the server-args surface, and what HTL's escaping contract requires that Twig's did
  not; the verdict written as tasks or as a recorded limitation. **Not release-gating for 3.0**,
  but scheduled well before pioneer 3 commits.
  **Check:** the spike either produces the HTL target's task list or records, with reasons, that
  AEM needs something the current artifact set cannot give it.


- [ ] LT-264: Split `@zeix/le-truc-simulation` out of the compiler package. **Not a v3.0 deliverable — a later 3.x, once the seam has a consumer.**
  **Area:** compiler
  **Context:** [ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s4.
  With LT-263's seam in place the substrate can ship as its own package, so activation is
  installation: present or absent, no configuration flag, no dynamic import, no degradation path
  threaded through the compiler. Deliberately **not** scheduled for 3.0 — a third npm name, release
  process and changelog on a release already gated on two external projects (ADR 0034 s6), against a
  saving of ~50 KB of JavaScript over the optional peer dependency, since jsdom is the weight and an
  opted-out consumer never installs it either way.
  **Deliverable:** the package, an exact-range peer on `@zeix/le-truc-compiler`, and a CI matrix — the
  substrate executes *generated client modules*, so the two-phase load/render contract, the `define()`
  recording, the children-first compose ordering key and the emission shape all cross the boundary and
  the pair is in permanent version lockstep. **jsdom must be a regular `dependency` of the new package,
  not a devDependency** — a devDependency is not installed for consumers.
  **Check:** a consumer project installs the compiler alone and builds green with Simulated components
  routed Static; adding the substrate package alone re-enables the tier with no config change.


- [ ] LT-269: Typed custom-property seam — `@property` registration derived from the signal's type (ADR 0042 s2). **GATED on a real consumer**: `bindStyle`/`setStyle` appears **nowhere** in the corpus or the docs components today, so this must follow a use, not precede one.
  **Area:** compiler
  **Needs:** LT-268
  **Context:** `bindStyle` (`src/bindings.ts`) takes `string`, so every value crossing from
  a signal into CSS is stringly-typed at exactly the point where both sides are known at
  compile time — `infer-type.ts` has the signal's value type and the stylesheet is in the
  same file. Where a signal drives a custom property, check the two agree and emit
  `@property --x { syntax: '<number>'; inherits: false; initial-value: … }`, which hands
  enforcement to the browser too (invalid-at-computed-value-time instead of a silently
  dead declaration) and brings interpolation and animation along. **The hard part is the
  syntax, not the plumbing:** `inferType` returns only `string`/`number`/`boolean`/
  `unknown`, and `<length>` vs `<number>` is precisely the distinction CSS makes and
  TypeScript does not — so infer the syntax from the **CSS side**, where the property is
  consumed (`width: var(--w)` implies `<length>`), reusing LT-268's parse rather than
  inventing author-facing branded types. Channel: compiler; **tier 2 Contained** for the
  TS↔CSS disagreement, with the emitted registration carrying the runtime half.
  **Depends on LT-268.** **Check:** a fixture whose numeric signal drives a `<length>`
  property warns; the emitted `@property` block round-trips through the equivalence audit.


- [ ] LT-270: Typed style handle — stage 1 of style composition, unblocked from TSRX 1.0 (ADR 0042 s3).
  **Area:** compiler
  **Needs:** LT-268
  **Context:** ADR 0033 sub-design 6 parked the whole composition package on TSRX 1.0
  because `.tsx` "has no such construct". That holds for **standalone** blocks only — a
  `<style>` in a children list with raw CSS as template syntax, which JSX cannot spell and
  which Le Truc wants least anyway (one tag-scoped sheet per component leaves
  sibling-scoping no role). **Assigned blocks** (`const theme = <style>{css`…`}</style>`)
  and `class={theme.dark}` are ordinary TSX, and that is where the anti-drift property
  lives: the class map is minted from the sheet the compiler parsed, so `theme.dark`
  cannot name a class the sheet does not define — a typo becomes a compile error instead
  of a silently dead class. **Stage 1 is the whole benefit with none of the machinery:**
  `theme.dark` lowers to the literal `"dark"`, emission stays verbatim, output stays
  byte-identical, no hashing and no selector rewriting. The one real surface change is
  accepting a `<style>` in **setup** position — today the sheet must be a `<style>` child of
  the root (D-07; LT-375 migrates the fragment spellings) — and `.tsrx` must accept the same spelling or the two front
  ends drift (ADR 0032 s6). **Stage 2 (`apply={theme}`, several sheets merged, selectors
  regenerated into `my-element .dark` / `:host(.dark)`) stays backlogged on the original
  terms** — that is where sub-design 6's "CSS must be generated" cost actually sits.
  **Depends on LT-268.** **Check:** a fixture naming a class absent from its own sheet
  fails the build; corpus output byte-identical; both front ends accept the same spelling.


- [ ] LT-345: A generated fallback `id` for an element whose ARIA relation needs one (LT-308 review; owner, 2026-09-26).
  **Area:** design
  **Context:** LT-343 makes module-codeblock's `id` required when collapsed, so the overlay's
  `aria-controls` always points at something. The ergonomic alternative the owner named is the
  one several JS frameworks ship: derive a stable id when the author omits one. The
  hand-authored Markdoc fence (`server/schema/fence.markdoc.ts`) and the tab-panel fragment
  (`server/templates/fragments.ts`) would benefit most, because they render collapsed blocks
  with no id and no `aria-controls` at all. Design questions first. Where is the id minted:
  compiler, server runtime, or page renderer? What makes it stable across builds: a content
  hash of the tag, source path and occurrence index? How do we guarantee uniqueness per page
  when the same component composes twice? Does it serialize into the client, or is it
  DOM-is-truth once rendered? Is it opt-in per argument or a general facility? Not before a
  second consumer beyond codeblock appears, or the docs fence wants `aria-controls`.
  **Constraint (Architect, 2026-10-01):** the data account (`HOST_PROFILE.md` bullet 5, LTC042)
  and `COMPILER_SPEC.md` §3.3 rule out a compiler-generated id. A design either mints it outside
  the compiler (the page renderer or the Markdoc schema) or amends that rule explicitly.
  **Channel:** none until designed. The design names its own.


- [ ] LT-357: Trusted Types target state for `truc:html` (LT-138 review; gated).
  **Area:** runtime
  **Context:** **Gated on TypeScript's DOM lib declaring `TrustedHTML`.** As of 2026-10-01 it
  does not: TS 6.0.3, 7.0.2 and 7.1.0-dev.20260930.4 (whose `lib.dom.d.ts` ships in the
  `@typescript/typescript-<platform>` packages) mention it only in `Document.write` doc
  comments. When the gate lifts: (1) drop the `type TrustedHTML = object` placeholders in
  `src/bindings.ts` and `examples/test/audit/test-audit.ts` for the real type; (2) decide
  whether the server's `configureHtmlSanitizer` should accept a Trusted-Types-shaped policy
  config, so one config module serves both realms. The server already stringifies a
  `TrustedHTML` result (`server/compiler/runtime.ts` `sanitizeHtml`). LT-138 already settled the
  shared entry point and the fail-closed default; this task covers only typing and the
  policy shape. No new runtime check; channel: TypeScript.


- [ ] LT-376: The source-to-source adapter seam, experimental (D-17, D-18; ADR 0032 s6).
  **Area:** compiler
  **Needs:** LT-371, LT-480
  **Context:** ADR 0032 s6 (2026-10-01): the external extension point is an **adapter** that
  translates another format into host-profile `.tsx` plus a source map back to its input; the
  compiler remaps diagnostics through that map (ADR 0044 s2). Only a component translated with no
  error mixes with native ones; no plugin machinery; experimental until a first-class reference
  adapter ships. Deliverables: read an input source map from a `.tsx.map` sidecar next to the adapter's `.tsx` output (D-32: the public entry point is the corpus pass, so the map rides the file system, not a new parameter); remap
  diagnostic locations to the adapter's input; a declared host-profile version the adapter
  targets; a toy conformance adapter in the test suite (emits `.tsx` plus a map, compiles through
  every tier, proves errors remap to the toy source). This also gives LT-247 a real source-map
  consumer for its reopen condition (input maps, not output maps — check whether that changes its
  ruling).
  **Gated on** LT-480 (the corpus entry point the sidecar is read by; D-32 ruled 2026-10-06), LT-371
  (`location`), and section 15's O-1 (is there adapter demand), O-7 (diagnostic wording) and O-10
  (type access). D-04 is parked, so `.tsrx` is not the reference adapter by default.
  **Channel/tier:** none until designed; adapter-side refusals stay in the adapter's own channel
  (adapters never mint `LTC` codes).
  **Verification:** the toy adapter's conformance run; full gates.


- [ ] LT-413: `check:skills` — fail on retired diagnostic codes and removed API names in `skills/` (SKILLS_REPORT R4).
  **Area:** compiler
  **Context:** `skills/le-truc/` and `skills/cause-effect/` ship in the package, so drift in them
  is a product defect, and `check:links` does not scan `skills/`. Add `scripts/check-skills.ts`
  and a `check:skills` script. It fails when a skill file names an `LTC`/`TSRX` code that
  `server/compiler/diagnostics.ts` does not define or lists as retired (except in `errors.md`'s
  retired list), when `errors.md` lacks a row for an emitted code, or when a skill names an
  export that `index.ts` does not export (an allowlist covers prose words in backticks).
  Also check that relative links inside `skills/` resolve. Add it to the `docs` gates in the
  `contributor` skill (owner's `.agents/` pass, via `.agents-proposals/`).
  **Channel/tier:** build check, tier 1 Prevented.
  **Verification:** green at HEAD; a fixture skill file naming a retired code or a removed export fails it.


- [ ] LT-448: Design session — fetched partials that bring new components to the page (script admission and loading; the compiled `allow-scripts` gap; LT-334 residue).
  **Area:** design
  **Area:** design
  **Goal (owner, 2026-10-06):** allow a fetched HTML partial to bring *new* components to the
  page — components the build did not know. The origin constraint: partials come from the
  same origin, or from origins the page's CSP policy approves. Decouple-point: split out of
  LT-334 so the boundary migration (LT-449) does not wait on a security design.
  **Constraint the ruling must satisfy:** code-splitting for components. A rarely-used, huge
  component (a video player) must not be pulled into the main JS bundle; whatever mechanism
  rules must load component code lazily, on the partial's arrival.
  **Ground truth established in the 2026-10-06 dive** (verify before ruling; facts may have moved):
  1. The platform's free mechanism: `customElements` upgrades any matching element inserted
     into the document — a partial carrying *known* component markup needs no script at all.
     The script in `examples/module/lazyload/mocks/snippet.html` exists only because
     `shake-hands` is not yet *registered* (a guarded `customElements.define` shim).
  2. The runtime escape hatch (`dangerouslyBindInnerHTML({ allowScripts })`,
     `src/bindings.ts`) re-creates script nodes naively: `SCRIPT_ATTRS` copied, inline text
     re-created verbatim, appended after the content, **no dedup and no cleanup — every `ok`
     update re-executes every script** (snippet's define-guard is what keeps the demo correct).
  3. Sanitizer and `allowScripts` are mutually exclusive in the runtime: sanitization runs
     first, so a configured sanitizer (DOMPurify) strips `<script>` before the re-creation
     pass sees it; the escape hatch works only raw-passthrough. The compiled `truc:html`
     path always passes `sanitizeHtml` (fail-closed, ADR 0010), so scripts never survive it.
  4. `allowScripts` has exactly one consumer in the repo: `module-lazyload`. The demo page
     authors `allow-scripts`; `mocks/module-with-type.html` is a pure script-execution fixture.
  **Options discussed (no direction picked — rule, then record):**
  - **A. Registry pattern.** Behavior in partials = custom elements; the page pre-registers
    the tags its partials use; no script execution, no new mechanism. Fails the stated goal
    for genuinely build-unknown components and strains the code-splitting constraint
    (pre-registration means main-bundle weight).
  - **A′. Lazy registry.** A tag→chunk manifest; after a partial inserts markup, a loader
    fetches the unknown tags' component chunks and registers them — code-splitting native.
    Tension: the manifest is build-known; a partial bringing an unknown component needs a way
    to *declare* its components (a manifest beside the partial, fetched with it?) — that
    softening is part of the question, not settled.
  - **B. Policy-driven client loader.** The authored `allow-scripts` opt-in teaches the
    compiled `truc:html` a script policy running *inside* the sanitize step (mends finding 3):
    external-`src` re-created deduped by src, `type="application/json"` passthrough,
    `type="importmap"` refused, inline per policy. CSP cost: re-created inline scripts need
    `unsafe-inline` or a render-injected nonce.
  - **C. Arm-lifecycle execution semantics.** Orthogonal to B (foldable into its policy):
    scripts execute as arm effects — run on arm adoption, cleanup on arm exit, no
    re-execution on re-render. The compiler knows the arm boundary; the runtime never could.
  - **D. Build/serve-time extraction.** For same-origin partials the build can see, the
    server strips scripts and ships them as proper external, hashed module URLs; the client
    loads them as ordinary deferred scripts (CSP-clean, no `unsafe-inline`, browser-managed
    order and dedup). Genuinely dynamic URLs fall back to B/C.
  **Trust framing to carry:** no mechanism makes an untrusted script safe; sandboxing
  untrusted code is origin isolation (iframes), a different product. `allow-scripts` stays a
  page-author trust grant at the component boundary, origin-constrained per the goal. What a
  full-stack design adds over the runtime is hygiene and defaults, not safety.
  **Held state:** `shake-hands` stays broken until this rules (owner, 2026-10-06) — the
  lazyload demo shows it inert; do not paper over it with pre-registration (that is option A,
  and it strains the code-splitting constraint). `mocks/module-with-type.html` and the three
  script-execution spec legs (LT-449 re-scoped them here) are this session's test input.
  **Exit:** rule the direction (an option, a combination, or a new one); decide whether it
  needs an ADR (ADR 0047 if so) or an `ARCHITECTURE.md`/`HOST_PROFILE.md` record; write the
  follow-up implementation task — the one that transforms `shake-hands` from inert to alive
  per the ruled design (owner, 2026-10-06), absorbing the script-execution spec legs
  re-scoped from LT-449 — including the compiled-path wiring and the runtime binding's
  adoption of the same policy function (one policy, two hosts, no drift). Nothing in the
  lazyload track waits on this session: LT-449 and LT-390 proceed independently.

- [ ] LT-450: Design session — lists too large to server-render at once, as HTML partials of item blocks loaded on demand (optimistically, as the user scrolls).
  **Area:** design
  **Area:** design
  **Filed (Architect, 2026-10-06, from the LT-110 session):** ADR 0047's key-alias harvest
  needs the server to render every item once (its render witness fails a partial render by
  design), and the owner rejected client-side rendering from a page-level data block (ADR 0047,
  Alternatives). For a dataset too large to render at once, the owner's direction is the
  HTML-first answer: the server renders the first blocks, and further blocks arrive as HTML
  partials fetched on demand, optimistically as the user starts to scroll.
  **Questions for the session:** (1) **The data list's growth.** Items arriving in a partial are
  server-rendered markup after connect. ADR 0003 harvests at connect only, so does an arriving
  block harvest into the host-level list on insertion (a harvest-at-insertion rule), or is
  each block its own list? What about order and duplicate keys across blocks? (2) **The fetch
  contract.** URL scheme per block (page index, cursor, key range), who owns it (a component
  attribute, an authored template, a server route convention), and how the partial is
  rendered: the compiled component's own render over a slice of server args, so that one
  render produces both the page and its partials? (3) **Relation to existing machinery.**
  `module-lazyload`'s fetch-and-insert, `dangerouslyBindInnerHTML`'s sanitize path, and LT-448
  (partials that bring new components). Which of them carries this, and what does the
  sanitizer do to a partial's harvest sites? (4) **The witness.** A partial is a render with
  its own scope. Does ADR 0047's witness apply per partial (every item of the slice
  rendered)? (5) **Template targets** (ADR 0043): can a backend emit the partial route?
  (6) **The probe component**: `module-ticker` past BLOCK_SIZE × N, or a new corpus example.
  Traces to M17 (every pattern expressible), M19, M27.

- [ ] LT-456: Key alias reached through an arm scope — let the client harvest walk into a live arm, or keep the LTC005 refusal.
  **Area:** design
  **Area:** design
  **Filed (Architect, 2026-10-06, from LT-453's review):** ADR 0047 s3 harvests "from every
  alias-scope root in document order, across all enclosing scopes", but LT-453 reaches the alias
  roots through enclosing list items only. An alias scope behind a reactive conditional, an
  async boundary, a server-data loop or a composed child is refused with LTC005
  (`planKeyAliasHarvest`). **Problem:** a grouped view whose groups sit in an arm (a collapsed
  section, a tab panel) cannot use the key alias. **Better shape to decide:** the client path
  steps into the live arm root (`data-key` on the arm root, beside its `<template data-arms>`),
  proved unique by ADR 0045; the witness already covers an arm the server did not render.
  Open until a component needs it (ADR 0047: "Wider forms wait for a component that needs them").

- [ ] LT-457: A base URL for the simulation realm, so the arm-adoption audit stops pinning lazyload's realm-only `err` flip.
  **Area:** compiler
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from LT-390's review):** the realm's document is `about:blank`,
  so `module-lazyload`'s relative `src` fails `isValidURL` after adoption and the task rejects —
  the adopted `nil` arm flips to `err`, which no browser does at connect. LT-390's arm-adoption
  block in `server/tests/compiler/equivalence-audit.test.ts` therefore pins it in
  `SETTLED_IN_REALM` (`module-lazyload`, `module-listnav`). **Problem:** the pin hard-codes a
  realm artifact; a real adoption regression that happened to land on `err` would pass.
  **Better shape:** the realm takes a document base URL (an http(s) origin; the fetch itself
  never needs to resolve during the connect drain), so the relative `src` validates and the
  task stays pending — `nil` stays live. Then delete `SETTLED_IN_REALM` and let the final-key
  assertion compare against the server's live keys for every entry. Check that no sim-driver or
  build:docs snapshot depends on the `about:blank` behavior; re-pin any that move, by design.
  **Verification:** test:server; the adoption block passes for lazyload/listnav with no
  per-tag override.

- [ ] LT-458: A literal-initialized setup const is readable in a verbatim client derivation.
  **Area:** compiler
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from LT-110's review):** `module-ticker`'s host-level block
  derivation (`deriveList(() => Array.from({ length: Math.ceil(tickers.length / BLOCK_SIZE) }, …))`)
  cannot read `const BLOCK_SIZE = 100`: `substituteArgExpr` refuses any free setup-const name in a
  verbatim derivation, so `blocks` gets LTC004 (no harvest route) and the whole component routes
  Simulated. The corpus spells `100` out there and reads `BLOCK_SIZE` at three other sites.
  **Problem:** a pure literal constant is server- and client-known, yet reading it costs the
  component its tier; authors duplicate the literal and the copies can drift.
  **Better shape:** a setup const whose initializer is a literal (number, string, boolean, `null`,
  or a `const` chain of them; no call, no reference to args or signals) is inlined into the
  verbatim derivation by `substituteArgExpr`, exactly as an arg is substituted. Any other
  initializer keeps today's refusal and LTC004 wording. **Channel/tier:** compiler only; no new
  runtime check; the existing LTC004 narrows, its message unchanged.
  **Then:** restore `BLOCK_SIZE` in `module-ticker.tsx`/`.tsrx`'s block derivation, delete the
  spelled-out comment; the tier stays Folded and the clients stay identical.
  **Verification:** test:server with a unit leg (literal const inlined; a call-initialized const
  still LTC004); check:corpus; the ticker's tier-corpus entry unchanged.

- [ ] LT-459: A setup const referenced only from client positions stays out of the server module.
  **Area:** compiler
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from LT-110's review):** `module-ticker`'s random tick and its
  add-rows handler were first authored as setup consts (`const tick = () => …`,
  `const addRows = () => tickers.splice(…)`) referenced only from `watch` and `onClick`. They
  read no client-only name, so the server module kept them, and `check:corpus` failed its
  typecheck: the server harness's `ServerCell`/`ServerList` carry no `update`/`splice`. The
  corpus inlines both bodies into their client positions instead.
  **Problem:** the server module's membership is decided by what a const *reads*, not by where it
  is *used*; a portable helper used only by handlers is dead code on the server and, when it
  mutates a signal, a type error there.
  **Better shape:** a setup const (and its transitive setup-const dependencies) whose every
  reference sits in a client position — handler, `watch`/effect body, `expose()` method,
  client-only setup statement — is classified client-only and omitted from the server module,
  the same way a const that reads a client-only name already is. A const with any server-position
  reference keeps today's placement. **Channel/tier:** compiler only; no new runtime check and no
  new LTC rule (the change removes a failure, it diagnoses nothing).
  **Then:** optionally hoist `module-ticker`'s tick and add-rows bodies back to named consts.
  **Verification:** test:server with a unit leg (handler-only const absent from the server
  module; a const also read in a rendered thunk still present); check:corpus.

- [ ] LT-489: BasicButton's modifier shape — how a parent asks for `tertiary destructive small` — then convert module-todo's remove button to a handler arg.
  **Area:** design
  **Needs:** LT-461
  **Gates:** check:corpus, test:server, test:variants
  **Area:** design
  **Needs:** LT-461
  **Filed (Architect, 2026-10-07, from LT-461's review):** module-todo's remove button composes
  `<basic-button class="remove">` with the classes `tertiary destructive small` (pinned in the
  sim-driver snapshot). LT-461 gave BasicButton `onClick`, but a parent cannot express that
  class triple through the current props: `variant` is one enum (`secondary` | `primary` |
  `constructive` | `destructive`) and `size` another, and `tertiary` is not a `variant` value —
  the remove button gets its classes today because module-todo's template hard-codes them into
  the child's inner button through the class-ownership channel, not through any prop. Until a
  shape exists, module-todo's remove click stays on a hand-written `first('basic-button.remove
  button')` query instead of LT-461's handler arg.
  **Ruling needed (owner):** one of —
  1. `variant` widens to accept an array (`variant?: X | X[]`), with `tertiary` joining the
     vocabulary; `class={`${variant.join(' ')} ${size}`}`.
  2. Boolean modifier props (`destructive?: boolean`, `small?: boolean`, …), composing with
     `variant`; the combinatorics live in BasicButton alone.
  3. Leave the class-ownership channel as the documented answer for modifier combinations and
     drop the conversion idea.
  Recommendation: 2 — the modifiers are orthogonal (color × weight × size), the enum would
  otherwise grow `tertiary-destructive`-style cross products, and the props render as ordinary
  server args. Whichever wins, the CLAUDE-facing copy is HOST_PROFILE § Handler args' note that
  a parent needing classes on the child's INNER button uses the ownership rule.
  **Change (after the ruling):** BasicButton carries the ruled props; module-todo's remove
  button passes `onClick={e => …}` (or the equivalent) as a handler arg and drops its
  hand-written remove-button query; the sim-driver snapshot and any other pin re-write
  mechanically.
  **Check:** `bun run test:variants module-todo` green on all three surfaces; `test:server`
  and `check:corpus` green.
  **Channel/tier:** none — example-corpus API shape; no runtime check.

- [ ] LT-497: Name the cause when a parent's reference into its content is unaddressable because no region marks it.
  **Area:** compiler
  **Needs:** LT-472
  **Gates:** test:server, check:corpus
  **Area:** compiler
  **Needs:** LT-472
  **Filed (Architect, 2026-10-07, from LT-472's review):** in two shapes, ADR 0048 s1 gives the
  parent's content no marked region, and a parent `first()` into it falls through to LTC007's
  generic "matches nothing / unaddressable" message:
  1. **Mixed-content forward:** the child forwards the content beside its own markup
     (`<E><b/>{children}</E>`). E's region belongs to the forwarder, and no element encloses the
     original owner's content alone.
  2. **Declared, never inserted:** the child declares `children` but its template never inserts
     them.
  **Ruling:** both stay refused. Each is correct under s1: there is no region to re-include, and
  inventing a wrapper element would change the child's DOM. Only the message changes. Keep code
  LTC007 and add two message variants that name the cause and the fix:
  - for 1: "`<E>` forwards this content beside its own markup, so no region marks it as yours;
    wrap `{children}` in an element in E's template".
  - for 2: "`<C>` never inserts its children".
  The `childrenRegion.unmarked` flag and a missing `childrenRegion` already carry the facts.
  Final copy goes through `../writer/references/error-messages.md`.
  **Check:** `test:server` pins both messages, on both surfaces.
  **Channel/tier:** compiler, tier 1 Prevented (unchanged). No new code.

- [ ] LT-506: check:dead-css — a corpus gate listing component selectors that match nothing their template renders.
  **Area:** compiler
  **Needs:** LT-507
  **Gates:** test:server, typecheck, check:corpus
  **Area:** compiler
  **Needs:** LT-507
  **Filed (Architect, 2026-10-08; reframed by owner ruling the same day):** dead-CSS detection is
  a corpus-level check, not a compiler diagnostic. The compiler knows only the template, and the
  template is not the only source of a component's markup: page-authored content inside the host
  is a descendant like any other (ADR 0033 s2; form-listbox's grouped declarative example), and a
  client script may add classes and elements (module-todo's `.dragging` and `.drop-marker` from
  `examples/_common/reorder.ts`). So the compiler can show that a selector matches nothing in the
  template, but it cannot prove the rule dead. A gate over the reference corpus, with an allowlist
  that records why each surviving selector is alive, can. Same posture as `check:html` (LT-508):
  stand-alone, never part of the compile step or `bun test`, no `LTC` code.
  **Start from:** branch `task/LT-506` (`a34da93c`, unreviewed WIP from the diagnostic attempt)
  holds the matcher: `checkSheetDeadRules` in `css-scope.ts`, `renderedTreeOf`/`leakChildOf` in
  `analysis/selectors.ts`. Drop its `diagnostic.deadRule` and pipeline wiring. Rebase the branch
  onto `v3` when the task starts.
  **Do:**
  1. **The matcher.** Per selector-list member of each style rule in a component's `@scope`
     block: can the full selector, combinators included, match an element of the rendered tree?
     The tree is the component's own template (every arm, every list item template, the host as
     `:scope`) plus each composed child's shapes that no authored limit excludes, with
     compose-site attributes (LT-505). A `children` region or `any` shape in reach, a dynamic
     attribute or class, a state or structural pseudo-class, or a combinator into a child's
     subtree keeps the selector alive.
  2. **The gate.** `scripts/check-dead-css.ts`, wired as `check:dead-css`. It prints one line per
     template-dead selector, at its authored location in `check:corpus`'s `path(line,col)`
     format, naming the tag.
  3. **Allowlist.** `scripts/check-dead-css.allow.json`, entries `{ tag, selector, reason }`. A
     reason states the markup's source: `script` (naming the module) or `page` (naming the
     page). An unmatched finding fails, and so does a stale entry. If LT-508 has landed, share
     its allowlist matcher; otherwise build one LT-508 can reuse.
  **Check:** on `v3` after LT-507, the gate passes with exactly seven allowlist entries:
  module-todo `&.dragging` and `&.drop-marker` (script), form-listbox `module-scrollarea`,
  `[role="group"]` and `[role="presentation"]` (page, `form-listbox.html`), and form-spinbutton
  `fieldset > input` and `fieldset > button` (page, `docs-src/pages/data-flow.md`). Reverting
  LT-507 makes the gate fail on the six removed selectors. Unit tests cover the matcher (a combinator chain the template
  lacks is dead; a `children` region, a dynamic class or `:hover` keeps it alive) and the
  allowlist (unmatched fails, stale fails). Report the gate's wall time.
  **Channel/tier:** none. A corpus gate over authored sheets and templates; its verdict depends on
  page markup and scripts the compiler never sees, so no `LTC` code.

- [ ] LT-508: check:html — validate and axe-check every corpus component's server render.
  **Area:** compiler
  **Gates:** test:server, typecheck, check:corpus
  **Area:** compiler
  **Filed (Architect, 2026-10-08):** traces to REQUIREMENTS §4 Accessibility (the corpus's
  server-rendered markup is valid HTML and passes the fragment-applicable axe-core rules; the
  no-JS accessibility tree, ADR 0026). A probe run on 2026-10-08 rendered all 43 corpus tags and
  found real defects (form-colorgraph's slider labelled by an id the render does not contain,
  duplicate ids, `<meter>` without `value`), so the gate has something to catch.
  **Context:**
  1. **Shared render args.** Move the `ARGS` table out of
     `server/tests/compiler/server-render-smoke.test.ts` into
     `server/tests/compiler/corpus-args.ts` as an exported `CORPUS_RENDER_ARGS`; the smoke gate
     imports it. One table feeds both gates. A tag absent from the table renders from `{}`.
  2. **The gate.** `scripts/check-html.ts`, wired as `check:html` in `package.json`. It compiles
     the corpus with `compileCorpus` into a per-run temporary directory (never `config.outDir`,
     the LT-140 posture) and removes it on exit. Then it calls each tag's `render<Name>()` with
     its args and wraps the markup as
     `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>TAG</title></head><body><main>MARKUP</main></body></html>`.
  3. **HTML conformance:** add `html-validate` as an exact-pinned devDependency and use its
     programmatic API with the preset that checks conformance to the HTML standard only
     (`html-validate:standard`; confirm the name against the pinned version). No stylistic rules.
     Declare every registry tag as a custom element that accepts flow content, so a corpus tag
     is never reported as unknown.
  4. **Accessibility:** run axe-core (already a devDependency) inside a `jsdom` window
     (`runScripts: 'outside-only'`, evaluate `node_modules/axe-core/axe.min.js`), with
     `axe.run(document)`. Disable the rules that need real layout or a whole page:
     `color-contrast`, `landmark-one-main`, `page-has-heading-one`, `region`. Count only
     `violations`; `incomplete` is not a finding.
  5. **Allowlist:** `scripts/check-html.allow.json`, an array of `{ tag, tool, rule, reason }`.
     A finding the list doesn't match fails the gate, and so does an entry that matches no
     finding (a stale allowance never lingers). Seed it with every finding HEAD produces, each
     with the reason `untriaged at gate landing (LT-508)`. The Architect triages them at review
     into corpus follow-ups.
  6. **Output:** one line per finding, `TAG: <html-validate|axe>/<rule>: <message> (<selector>)`,
     using html-validate's `selector` and axe's `node.target`. Exit non-zero on any failure.
     Authored-source locations are LT-509's job.

  Out of scope: the inert `<template data-arms|data-list>` content (LT-510) and hydrated or
  interacted states (Playwright, the `runAxe()` fixture in `examples/test/fixtures/aria.ts`).
  Not part of the compile step or `bun test`: like `check:corpus`, the gate stands alone.
  **Check:** `bun run check:html` passes on HEAD with the seeded allowlist. A unit test under
  `server/tests/` covers the allowlist matcher: an unmatched finding fails, a stale entry fails,
  a matched finding passes. The handoff lists the seeded findings.
  **Channel/tier:** none. A corpus gate over rendered output, not a runtime check. Its result
  depends on render args the compiler never sees, so no `LTC` code.

- [ ] LT-509: check:html reports findings at the authored source location (data-lt-src render annotation).
  **Area:** compiler
  **Needs:** LT-508
  **Gates:** test:server, typecheck, check:corpus, check:contract
  **Area:** compiler
  **Needs:** LT-508
  **Filed (Architect, 2026-10-08):** LT-508 reports a finding by tag and selector. Composed
  children render inline, so a finding's element may belong to another component's source. The
  author needs `path(line,col)`, the format `check:corpus` prints.
  **Context:**
  1. **Annotation option.** Add an internal server-emit option, `sourceAnnotations` (default
     off), reached through `compileCorpus`. It isn't exposed through `contract.ts` or
     `le-truc.config.json`. When on, `emit-server.ts` adds
     `data-lt-src="<root-relative path>:<line>:<col>"` to every element open tag the render
     emits. That covers the host root, template elements, the content of arm and list
     templates, and a composed child's elements, each with its own module's authored file. The
     position is the authored element's start, from its IR `SourceRange`, mapped to a line and
     column the same way `check:corpus` does. `data-*` attributes are valid HTML and inert to
     axe, so neither tool reacts to them.
  2. **Off means byte-identical.** With the option off, every generated module is byte-identical
     to HEAD's: the goldens don't move.
  3. **Gate mapping.** `check:html` compiles with the option on. For each finding it resolves the
     selector (html-validate's `selector`, axe's `node.target`) in a jsdom of the checked
     document and takes the nearest ancestor-or-self `data-lt-src`. It prints
     `path(line,col): error <tool>/<rule>: <message> [TAG]`. A finding with no annotated
     ancestor keeps LT-508's line format. Allowlist matching stays on `{ tag, tool, rule }`.
  4. **Annotations change no finding.** The finding set is identical with and without
     annotations; a test asserts this over the corpus.
  **Check:** a server test compiles one `.tsx` and one `.tsrx` component that composes a child,
  with the option on, and asserts the host's, an inner element's and the composed child's
  `data-lt-src` values. The goldens are unchanged with the option off. `check:html` output
  names authored files. On review the Architect adds a Key Decisions entry to `ARCHITECTURE.md`
  (an internal render annotation, not an ADR).
  **Channel/tier:** none. Tooling for a corpus gate; no runtime check and no `LTC` code.

- [ ] LT-510: check:html covers every arm and list template, checked in its container.
  **Area:** compiler
  **Needs:** LT-508
  **Gates:** test:server, typecheck, check:corpus
  **Area:** compiler
  **Needs:** LT-508
  **Filed (Architect, 2026-10-08):** LT-508 checks only what the server render shows live. A
  losing arm (ADR 0037) and a list item (ADR 0046) exist only as inert `<template>` content.
  axe skips template content, and validating it standalone misjudges the content model: an
  `<li>` checked outside its `<ul>` is flagged. List templates also sit at the host's end,
  outside their container. Each template has to be checked where the client puts it.
  **Context:**
  1. **Base document.** LT-508's checked document has every `template[data-arms]` and
     `template[data-list]` removed before both tools run. The live markup is checked once, with
     no template content.
  2. **Arm variants.** For each arm set (`template[data-arms="N"]` siblings under one parent),
     the live root is the nearest preceding sibling element that is neither a `<template>` nor a
     `[data-arms]` carrier. This is the adjacency the client's `reconcile` uses
     (`src/helpers/reactive.ts`). For each arm key except the live root's `data-key`, build one
     variant document: the live root replaced by that template's single root element, then the
     base-document stripping. Build variants one arm at a time, never a cartesian product; a
     nested arm set inside a variant arm is handled recursively with its own winner live.
  3. **List variants.** For each `template[data-list="N"]`, build one variant with one item, the
     template's root, appended to list N's container, then stripped. The container is the one
     the client's `reconcile` call for list N queries. If the per-component compile result
     doesn't expose that container's selector, add it as an internal field on that result (not
     `contract.ts`). One item only, so per-item ids can't collide as an artifact.
  4. **Reporting.** A variant's finding carries `[TAG arm N=K]` or `[TAG list N]`. A finding
     identical (tool, rule, selector) to one in the base document is dropped. Allowlist entries
     gain an optional `variant` field matched against that label.
  **Check:** `check:html` covers `form-inplace-edit`'s `then`/`else` arms, `module-lazyload`'s
  `ok`/`nil`/`err` arms and `module-list`'s item, and reports the variant count per tag. A server
  test injects a list template whose item is valid only inside its container and asserts no
  finding, then one invalid in its container and asserts the finding.
  **Channel/tier:** none. A corpus gate; no runtime check and no `LTC` code.

- [ ] LT-511: Corpus — delete hand-written component sheets that no twin serves.
  **Area:** compiler
  **Gates:** test:server, check:corpus, test:variants, build:docs, check:links
  **Area:** compiler
  **Filed (Architect, 2026-10-08; LT-507 review):** ADR 0033 s10 serves a folder's hand-written
  `.css` only with its `.ts` twin, and `examples/main.css` imports the compiler's emitted sheet for
  every compiled folder. 22 folders keep a `.css` with no `.ts` twin beside it, sheets from before
  their twins were retired: basic-button, basic-gauge, basic-hello, card-blogpost, card-callout,
  card-collapsible, card-colorscale, form-checkbox, form-colorgraph, form-combobox,
  form-inplace-edit, form-listbox, form-radiogroup, form-spinbutton, form-textbox, form-tokenbox,
  module-blogarchive, module-demo, module-list, module-tabgroup, section-hero and section-menu's
  `chapter-nav.css`. They drift from the authored sheets (LT-504 and LT-507 edited the sources,
  not these), and a reader can mistake one for the component's CSS.
  **Do:** for each file, confirm that nothing reads it: no `@import`, spec, build or corpus script,
  docs page (a source listing or `{% demo %}`), or `le-truc.config.json` entry. Delete the files
  nothing reads. Report any that are read, and by what.
  **Check:** `build:docs` and `check:links` green; `test:variants` and the component specs pass;
  the served `docs/assets/main.css` is byte-identical to `v3`'s.
  **Channel/tier:** none. Corpus housekeeping.

- [ ] LT-513: module-cem-list addresses its passed content through declared roles, not inline reach-ins.
  **Area:** examples
  **Needs:** LT-474
  **Gates:** test:server, typecheck, check:corpus, test:variants, build:docs, check:links
  **Area:** examples
  **Needs:** LT-474
  **Filed (Architect, 2026-10-08; owner ruling on LT-474's survey):** module-cem-list (`.tsrx` and
  `.tsx`) reaches into the content the `{% cem-list %}` tag renders (`server/schema/cem-list.markdoc.ts`)
  through inline calls: `on(first('form-textbox'), …)` and an `all('card-collapsible')` in a watch
  thunk. LTC083 checks declared references only, so the reach-in compiles. The reference corpus
  should model ADR 0048 s2's contract rather than its gap. Extending verification to inline
  literal-selector calls is not part of this task; it waits for a second case.
  **Do:**
  1. Declare the roles on cem-list's `children` prop, `Children<{ filter: 'form-textbox'; item:
     'card-collapsible' }>` or names that read better, on both surfaces, identical.
  2. Give the matching elements in the `{% cem-list %}` output the role classes.
  3. Address them through declared references: `const filter = first('.filter', …)` and the items
     through `all('.item')`, so LTC083 sees them. Required or optional per LT-474's rework.
  4. Check every other page that authors cem-list content and add the classes there too.
  **Check:** `check:corpus` clean; the cem-list docs page and its spec behave as before
  (`test:component module-cem-list`, and the filter narrows the list on the built docs page).
  Variant sets stay byte-identical.
  **Channel/tier:** none. Corpus authoring under the existing LTC083.

- [ ] LT-514: Form components and BasicButton take their visible label as non-interactive children.
  **Area:** examples
  **Needs:** LT-477, LT-479
  **Gates:** check:corpus, test:variants, typecheck, build:docs
  **Area:** examples
  **Filed (Architect, 2026-10-09; owner ruling on BasicButton, this session):** LT-479 lets FormCheckbox take its label as children. This task does the same for the other corpus components whose visible label is a `string` arg rendered as a text node, where the raw HTML element would accept phrasing content. The pattern is ADR 0048 s4: `children?: Children<{}, 'non-interactive'>`. LT-479 keeps a reactive `label` beside the children for FormCheckbox; here only BasicButton keeps one (item 2), because no form component in item 1 exposes its label. Change every member of each variant set (ADR 0039) and keep the CSS byte-identical.
  1. **Form components: `label` (`legend`) becomes `children`.** Remove the string arg and insert `{children}` where the arg was rendered:
     - `form-textbox`, `form-combobox` (both the `.tsrx` and the `.tsx` member) and `form-tokenbox`: `<label for={inputId}>{label}</label>`.
     - `form-spinbutton`: the label is optional, so `@if (label)` becomes a test on `children`.
     - `form-radiogroup`: `<legend>{legend}</legend>`. The options' `option.label` is list-item data and stays a string.
     None of these components exposes its label, so the change touches no client code.
  2. **BasicButton gets both.** `label` stays as the reactive text prop: it is exposed, and module-ticker's `.ts` twin `pass()`es it at runtime. Add `children?: Children<{}, 'non-interactive'>` for rich static content such as an icon plus text. `span.label` renders the passed children when present, otherwise `{label}`. Writing `label` at runtime replaces the rich content with text; document this on the arg's JSDoc. Existing `label=` compose sites stay valid.
  3. **Compose sites.** Move every compiled compose site of a form component in item 1 from `label=`/`legend=` to passed children: the `examples/` sources and `server/tests/compiler/imported-setup-helper.test.ts`. Page-authored `.html` markup is unaffected.
  4. **Out of scope:** `aria-label`-style args (`form-listbox`'s `ariaLabel`), `description` args (a description may legitimately hold a link, and a component has only one `children` region), and the card components' `label`.

  **Channel/tier:** no new check. LTC085 (LT-477) already refuses interactive content at these compose sites. Any remaining interactive site is a `NOTES.md` entry, not a workaround.
  **Check:** `test:component` for each changed component and its composers is unchanged. `check:corpus` and `test:variants` stay green.

- [ ] LT-515: Lazy children in composed content — the reactive half of ADR 0048 s1's grant.
  **Area:** design
  **Needs:** LT-477
  **Area:** design
  **Filed (Architect, 2026-10-09, from the LT-479 block; owner asked for it to be filed):** ADR 0048 s1 grants a parent "structure, text, bindings and `first()` references" in the content it passes. Today the lowering substitutes compose content once, at compile time, into the child's `children` server arg. `validateComposedChildren` refuses any reactive child with LTC011 ("A lazy child (`{expr}`) in a composed element's content is not supported yet"), except an async boundary's catch parameter (LT-460). So a parent cannot pass live text, such as module-todo's `{() => item.label.get()}` per list item. The only live channel today is a pass-able prop beside the children (the LT-479/LT-514 shape).
  **Questions to settle before this becomes buildable:**
  - **Re-render:** how a lazy child in passed content updates through the substitution boundary, both at page level and per clone in a reactive list item (ADR 0046). The parent owns the content, so the parent's client binds it. The open part is how the parent's client addresses a text site inside the child's inserted region.
  - **Arms:** whether reactive conditionals in passed content become legal (arm emission inside a region the child inserts).
  - **LTC085:** its composed-component leg and the `interactive` flag once nesting is admitted (LT-477, review doubt 1).
  - **Channel/tier:** for whatever stays refused.
  **Not in scope:** interactive content and child-owned `id`/`for`, which stay the child's template (ADR 0048 s4).
