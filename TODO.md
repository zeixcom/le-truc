# TODO

Current iteration only. The queue is a per-task store (`queue/LT-NNN.md`, one file per task;
`BACKLOG.md`, `TODO.md` and `DONE.md` are views built by `bun run queue:build`). New tasks are
created in `queue/` with a `band:`; the Architect moves them by editing `status:` and the chain
in this file; contributors claim and annotate only through `bun run scripts/queue.ts`. Task IDs
are unique by construction — the filename is the ID; the "Next free task ID" line below
allocates the next one.

**Iteration opened 2026-10-09: the first package and the P6 remainder.** The previous
iteration (the P6 cleanup round and the composition batch, opened 2026-10-06) closed on
2026-10-09. The `writer` recorded it in `CHANGELOG.md [Unreleased]`, and its 38 entries are
pruned (`queue/LEDGER.md`, eighth pass).

**Why now (Architect, 2026-10-09).** The first publish waited for the P6 cleanup round (owner,
2026-09-19). That round has closed apart from the conversions LT-463 left raw. D-32 is ruled
(LT-471), so P1 opens unblocked: LT-480 reshapes the contract and LT-254 publishes it. The P6
remainder runs beside it and empties the band, so the corpus a consumer meets in the first
pre-release composes every site LT-463 named. Template emission (LT-257) cannot be built
against ADR 0043 as written, so its design session runs now and the build follows next
iteration.

**Rulings taken at planning (Architect with the owner, 2026-10-09).**
1. **Scope: P1's package track, the P6 remainder, two design sessions and two P2b items.**
   LT-480 → LT-254 → LT-377 build the package. LT-489, LT-492 → LT-493, LT-494 and LT-517 are
   P6, and so is LT-518, the writer copy pass the eighth prune found owed. LT-514 moves from P7 to P6 and joins: it is the last label-as-children conversion and
   needs only P6 work. LT-516 (ADR 0043 amendment) and LT-484 (async-boundary arm roots) are
   design sessions. LT-483 joins from P2b (owner).
2. **LT-259 and the pioneers stay out (owner).** The codemod's drift-cost metric is unruled,
   and its check runs over the pioneer-1 project. It pairs with LT-260, which needs both
   LT-254 and LT-259. LT-257 and LT-261 wait for LT-516's split.
3. **The package is built, not published.** LT-254's check is `npm pack` into an empty
   project. The first pre-release to the registry is an outward-facing act and waits for the
   owner, after this iteration.
4. **One compiler track at a time through the analysis passes** (track X): LT-483 → LT-492.
   LT-483 edits `handleAsyncBoundary` in `analysis/effects.ts`, and LT-492 changes the
   composed-content refusal and its lowering. Run in parallel, they would conflict at
   integration. If LT-484's session rules parity, its compiler task joins track X after
   LT-492.
5. **module-todo and BasicButton change in one order** (track B): LT-489 → LT-494 → LT-514.
   LT-489 and LT-494 both edit module-todo's two surfaces, and LT-514 then moves the sites
   they compose to passed children (LT-514's sequence note).
6. **LT-480 runs alone in the contract files.** It moves `compileCorpus` into
   `server/compiler/` and narrows `RegistryEntry` (ruling 4: every compose-validation field is
   internal). Tracks X and B do not edit `contract.ts`, `registry.ts` or `corpus-compile.ts`.
   A task that finds it must, stops and writes it in `NOTES.md`.
7. **Standing rulings carried from the last iteration.** Acceptance criteria are goals, not
   constraints to satisfy by workaround: a contributor who can meet one only by bending the
   design annotates the task `blocked` and writes the impasse into `NOTES.md` (ruling 8 of
   2026-10-06). An `examples` task that edits a compiled source gates `test:server` and
   `typecheck` (ruling 13 of 2026-10-06). Corpus-level checks stay in P7 (ruling 15 of
   2026-10-06).

**The chain.**
- **R — the package** — P1; the contract reshape runs alone in the contract files (ruling 6).
  LT-480 → LT-254 → LT-377.
- **X — compiler, analysis passes** — one at a time (ruling 4), ending in the splitview
  conversion the `truc:html` lift unblocks. LT-483 → LT-492 → LT-493.
- **B — module-todo and BasicButton** — ruling 5. LT-489 → LT-494 → LT-514.
- **D — test harness** — beside everything. LT-517 (the probe differential's composed leg).
- **W — writer copy** — beside everything; area `docs`, a `writer` session. LT-518 (the copy
  LT-461 and LT-498 deferred, and three stale compiler-doc facts from the eighth prune).
- **Design gates** — area `design`: the Architect with the owner, never picked by `start-task`.
  LT-516 (ADR 0043 amendment, LT-257's split) and LT-484 (boundary arm-root parity). Neither
  holds the iteration open beyond its own ruling: each ends in an amended ADR or a recorded
  refusal, plus banded follow-up tasks.

**Deliberately not here.** LT-259, LT-260, LT-257 and LT-261 (ruling 2). The rest of P2b,
including LT-381 (it changes the census by design and needs the owner's sign-off) and LT-246.
LT-515 (lazy children in composed content) and the corpus-level checks stay in P7. P2–P5 stay
where they are.

**Exit criterion.** Every chain task is reviewed and integrated, and both design sessions have
ruled. `npm pack` of `@zeix/le-truc-compiler` installs into an empty project and builds a
two-component corpus through the published entry point, with no `@tsrx/core` in its tree
(LT-254's check). `contract.test.ts` pins LT-480's set, and `registry.json` carries only the
public projection. P6 is empty: module-splitview and module-todo compose every site LT-463
named, and no corpus form component or BasicButton renders its visible label from a `string`
arg where LT-514 moves it to children. The tier census and the warning baseline are unchanged
from the opening measurement below, except where a task states a by-design change. `typecheck`,
the server suite, `check:contract`, `check:corpus`, `test:variants`, `build:docs` and
`check:links` are green on the closing commit. The net line count of `server/compiler/` is
recorded against the opening measurement; LT-480 grows it by the code it moves in.

**Opening measurement (2b26f032):** `check:corpus` exits 0. The tier census has 43 entries:
36 Folded, 7 Simulated, 0 Static. The compile-warning baseline is 1 unique standing warning,
module-dialog's `body.scroll-lock` (LTC088), a deliberate component-bound page-wide rule that
ruling 7 excepts. The translation census has 0 gaps across 6 locales. `server/compiler/` has
83 modules and 41.4k lines (every `.ts` file except `*.test.ts`, the same net as the 2026-10-06
measurement).

**Next free task ID: LT-519.** Next free diagnostic code: LTC090 (LTC090 was reserved for LT-506 and is released unused; LTC086, LTC089 are reserved for LT-501 and LTC087, LTC088 for LT-502; LTC070 is retired by LT-501; LTC083–LTC085 are reserved for LT-474, LT-476 and LT-477; LTC082 was reserved for LT-136
and is released unused; LTC081 is reserved for LT-461; LTC080 is
LT-453's; LTC079 is LT-447's, unused; LTC078 is LT-444's; LTC077 is LT-443's; LTC076 is LT-429's;
LTC075 is LT-355's; LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's; LTC071 is
LT-399's; LTC066–LTC070 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are
LT-274's; LTC061 is LT-383's; LTC060 is LT-375's; LTC059 is LT-374's; LTC057/LTC058 are LT-257's;
LTC056 is LT-358's).

---

<!-- entries -->

### R — the package

- [ ] LT-480: Reshape the compiler's public contract to the D-32 ruling — the corpus entry point moves into the compiler, `RegistryEntry` narrows to a public projection, and the stability policy names the generated-module API.
  **Area:** compiler
  **Needs:** LT-471
  **Gates:** typecheck, test:server, check:contract, check:corpus, build:docs
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
  **Ruling 4 (owner, 2026-10-09): compose-validation fields are internal in 3.0.** The public projection in ruling 2 stands as listed. Every other field moves to the internal type, including those added after the D-32 session: `childrenRegion`, `interactive`, `childrenModel` (ADR 0048), `handlerArgs` (LT-461), `roleWrites` (LT-476), plus `declaresI18n`, `langArgDefault`, `i18nMessages` and `clientMessageKeys` (ADR 0030). One corpus pass composes only its own sources in 3.0, so no consumer reads them. Composing across corpora (for example an installed component library) would add them back as a minor. `registry.json` serializes the public projection only; check its in-repo readers (ruling 2's check) against this longer list.
  **Handoff (Architect, 2026-10-09, eighth prune):** two facts from consumed tasks bear on the reshape.
  - `contract.ts` exports `HandlerPlacement` beside `RegistryEntry` and `contract.test.ts` pins it (LT-461 review, the `ExposeKind` precedent). Ruling 4 makes `handlerArgs` internal, so the export and its pin leave with it.
  - `render<Name>` takes an optional second parameter, the content owner's tag (LT-472; `queue/LEDGER.md`, eighth pass). It is part of the generated-module API that ruling 3 puts under semver. Name it in the policy and in `LE_TRUC_COMPILER.md` §2, which still spells `render<Name>(args)`.

- [ ] LT-254: Stand up the publishable package `@zeix/le-truc-compiler` (TSX-only) — manifest, `exports`, the `.tsrx`-excluding build, the runtime peer and the `runtimeImport` default.
  **Area:** compiler
  **Needs:** LT-471, LT-480
  **Gates:** typecheck, test:server, check:contract, check:corpus
  **Area:** compiler
  **Rewritten (Architect, 2026-10-09, owner-approved consolidation).** The earlier riders are settled elsewhere:
  - LT-370, LT-371 and LT-375 landed the pre-publish reshapes.
  - LT-271 carried out the LT-206 vocabulary sweep (the old deliverable (c)).
  - D-32 (LT-471) ruled the entry point, and LT-480 reshapes `contract.ts` to match.
  - The `./macros` module exists (`server/compiler/macros.ts`, LT-442).

  This task publishes whatever `contract.ts` names after LT-480, and nothing more.
  **Context:** ADR 0034 s1–s2, s8. The compiler ships separate from the browser-only `@zeix/le-truc`, named for its function rather than its input format. v3.0 publishes the `.tsx` front end only. `.tsrx` stays a first-class repo-internal surface under ADR 0032's parity contract, and publishes in a later 3.x gated on `@tsrx/core` 1.0. The published tree must not carry the pinned pre-1.0 parser as a runtime dependency. The `@zeix` scope is owned, so the name cannot be taken, and the first pre-release claims it.
  **Deliverable:**
  1. **Manifest and `exports` map.**
     - The root entry is the corpus pass and its types, exactly the set `contract.test.ts` pins after LT-480.
     - The `./macros` subpath carries the compile-time markers as types plus throwing stubs (ADR 0034 s1). It must resolve without loading the compiler's dependencies (`typescript`, `jsdom`).
     - Nothing else is exported, and no deep imports are allowed.
  2. **Build.** It emits JS plus declarations and leaves out the `.tsrx` front end and `@tsrx/core` without deleting them from the repo. The `.d.ts` output is what LT-377 checks.
  3. **Runtime peer (ADR 0034 s8).** Declare `@zeix/le-truc` as a peer dependency with a minimum version. Add a build check that every runtime export the emitted client modules import exists at that version, resolved against that version's published export list.
  4. **`runtimeImport` default.** Switch `DEFAULT_RUNTIME_IMPORT` in `server/compiler/emit-paths.ts` from the repo-relative `'../../compiler/runtime'` to the published package specifier. Keep this repo working by setting the field explicitly in its own `le-truc.config.json` (ADR 0036). Consumers then never set it.
  5. **Diagnostic codes become public API on first publish.** List any code that still carries a surface-specific prefix while the published surface is `.tsx`, with the reason it is kept (LT-271's record is the source). Renamed copy follows `writer` → error-messages.
  **Rider (LT-243 review, 2026-10-01): `@typescript-eslint/typescript-estree` becomes a runtime dependency.**
  - Weigh it under M28 with its closure: `semver`, `debug`, `minimatch`, `ts-api-utils` and the `@typescript-eslint/{types,visitor-keys,tsconfig-utils,project-service}` siblings.
  - Record the `typescript` peer range the package inherits (`<6.1.0` at 8.71.0).
  - Weigh it against D-33's goal (TypeScript 7.1 or a native parser behind the converter, ADR 0032 s4): the peer range must be able to follow TypeScript.
  - Record the outcome in the manifest's comments or `LE_TRUC_COMPILER.md` §2.

  **Docs:** `LE_TRUC_COMPILER.md` §2 (installation, entry point, peer) and `COMPILER_SPEC.md` Appendix B (refresh it as of the publish). Hand the user-facing copy to `writer`.
  **Channel/tier:** none (packaging and a build check).
  **Check:**
  - `npm pack` on a clean checkout produces a tarball that installs into an empty project. That project builds a two-component corpus, one component composing the other, through the published entry point, with no `@tsrx/core` in its dependency tree and no `runtimeImport` set.
  - The runtime-peer check fails on a planted import of a symbol the minimum version lacks.
  - Full gates.

- [ ] LT-377: Pin that no TypeScript type reaches the published declarations (D-33).
  **Area:** compiler
  **Needs:** LT-254
  **Gates:** typecheck, check:contract
  **Area:** compiler
  **Needs:** LT-254 (planning, 2026-10-09: the check reads its declaration build)
  **Context:** ADR 0034 s8 (2026-10-01): no TypeScript type appears in the public API, so the
  engine can move to TypeScript 7.1 or a native parser without a major. ADR 0032 s4 already
  confines `typescript` API use to the converter. Add a contract check that the package's
  emitted `.d.ts` files import nothing from `typescript` or `@typescript-eslint/*`. Lands with or
  after LT-254's declaration build.
  **Channel/tier:** none (a build check).
  **Verification:** the check fails on a planted `ts.Node` in a public type; full gates.


### X — compiler, analysis passes

- [ ] LT-492: Lift LTC011 for `truc:html` in a composed element's content — the parent's own sanitized binding (ADR 0048 s1).
  **Area:** compiler
  **Needs:** LT-472, LT-483
  **Gates:** test:server, typecheck, check:corpus
  **Area:** compiler
  **Needs:** LT-472, LT-483 (planning, 2026-10-09: track X runs one at a time)
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

### B — module-todo and BasicButton

- [ ] LT-494: FormRadiogroup's `.split-button` variant hides its own legend and radios; module-todo composes `<FormRadiogroup>`.
  **Area:** examples
  **Needs:** LT-463, LT-489
  **Gates:** check:corpus, test:variants, test:server, typecheck
  **Area:** examples
  **Needs:** LT-463, LT-489 (planning, 2026-10-09: both edit module-todo; track B)
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

- [ ] LT-514: Form components and BasicButton take their visible label as non-interactive children.
  **Area:** examples
  **Needs:** LT-477, LT-479, LT-489, LT-494
  **Gates:** check:corpus, test:variants, typecheck, test:server, build:docs
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
  **Sequence (Architect, 2026-10-09):** LT-514 runs after LT-494, which first composes module-todo's `<FormRadiogroup legend={t.filter} …>`; item 3 then moves that site's `legend` to children. It also runs after LT-489, which reshapes BasicButton's props (`variant`/`kind`/`size`), so BasicButton's API changes in one order.

### Design gates

- [ ] LT-516: Design session — amend ADR 0043 for the corpus template emission must now carry (the `Try` boundary, reactive lists, passed children), and split LT-257.
  **Area:** design
  **Area:** design
  **Filed (Architect, 2026-10-09, next-iteration preparation; owner: the session joins the next iteration, with no implementation work):** ADR 0043 (2026-10-01) ruled the target-emitter interface before three later decisions changed what a component's server render contains. LT-257 cannot be built against it as written. The session amends ADR 0043, editing it in place while Proposed or superseding it per `references/adr.md`, and leaves LT-257 buildable.
  **Questions to rule:**
  1. **`Try` in template targets (D-28, deferred since the 2026-10-01 team review).** ADR 0041's boundary has three arms (`ok`, `pending`, `catch`; no `stale`). `COMPILER_SPEC.md` §9.2's draft renders `catch` from a CMS-supplied error shape (`{ error: { code, message } }`). Rule what a backend template renders for each arm, where the error shape comes from, and how the inert arm templates (ADR 0037) sit beside the backend conditional. Otherwise rule `Try` non-emittable, as a census routing outcome (ADR 0043 s2).
  2. **Reactive lists (ADR 0046).** A reactive list renders its initial items in place plus an extracted `<template data-list="N">`, and nests recursively through Mount Scopes. ADR 0043's operation vocabulary has a server-data loop and an arm template, but no list template. Rule the operation, the hole scope of a list item, and how a nested list inside an arm or an item emits.
  3. **Passed children (ADR 0048).** Compose content is the parent's own markup, wrapped in a `data-children` region marker. Under LT-492 it may hold a sanitized `truc:html`. ADR 0043 s5 still calls "markup passed as children" "a separate security question". Rule how an include passes children, for example a Twig `embed`/block or a pre-rendered argument in the HTML escaping context through the sanitizer hook. Rule what escaping context each part takes, and where the region marker is written.
  4. **The key-alias harvest** (ADR 0047 s4; already recorded on LT-257) is a census routing outcome. Confirm it in the amended text.
  **Output:** the amended ADR, `COMPILER_SPEC.md` §9 and D-28 updated, and LT-257 split into buildable tasks. A likely split: the shared walk plus the test-only second target; the Twig target; the census per target; the PHP CI job. Each split task names its `needs:`, gates and the diagnostics it owns (LTC057/LTC058 are reserved). New refusals name their channel and tier (ADR 0028).
  **Not in scope:** any implementation. Pioneer 2 (LT-261) stays after the build.

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
