# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-10-01): consolidate the compiler, then land the pre-publish
reshapes.** The previous iteration (the ICU MessageFormat switch) is landed and reviewed;
Changelog Keeper merged it into `CHANGELOG.md [Unreleased]` the same day and `DONE.md` was pruned.

**Why now (owner, 2026-10-01).** Three things converge. (1) LT-233 has landed, so the ADR 0037
work (LT-274–LT-276) and the ADR 0033 CSS track (LT-268 → LT-304/LT-306) no longer contend with
it for the front ends. With LT-287/LT-288 they are the remaining IR reshapes (ADR 0040). Since
2026-10-01 the IR is internal (ADR 0034 s8, `COMPILER_SPEC.md` D-25), so none gates the first publish;
they still land before the features that build on them. (2) The P2b consolidation keeps losing to feature work. The
compiler has grown from 46 modules / ~21.9k lines at the 2026-09-18 review to 69 / ~27.0k
(measured 2026-10-01, non-test `.ts` under `server/compiler/`). The suites (goldens, render and
diagnostic parity, tier census) now cover mechanical moves, and every month of growth makes
them dearer. (3) LT-257's interface has no design, and LT-274 would otherwise build the
`conditional` node against a shape template emission has not defined. ADR 0037's rider asks
for the representation "decided with the interface, not retrofitted".

**Ruling taken at planning (Architect, 2026-10-01): consolidation goes first where it touches
what the features touch.** A behaviour-preserving move is cheapest before a feature grows new
call sites in the code it moves. LT-230 centralizes the `TemplateNode` walks before LT-274 adds
a variant. LT-243 and LT-229 replace the estree plumbing before LT-274 edits both front ends.
LT-234 lands the `HtmlWriter` that LT-274's arm templates and LT-257's emitter write through.
LT-227 splits the passes that LT-289 retypes. Moves that touch nothing a feature touches run in
parallel.

**The chain.**
- **Design gate.** ~~**LT-360**~~ (reviewed 2026-10-01, [ADR 0043](adr/0043-the-target-emitter-interface-for-template-emission.md)) designs the target-emitter interface (LT-257's interface half)
  and records it as an ADR. It is architect work, so it runs alongside track A from day one.
  It gates LT-274.
- **A — consolidation (P2b).** ~~LT-364~~ (reviewed 2026-10-01; the sandbox-proof `serve.test.ts` landed first, so every later handoff runs the full server suite). ~~LT-228 → LT-229 → LT-232~~ (reviewed 2026-10-01). ~~LT-366 → LT-243 → LT-367~~ (reviewed 2026-10-01). ~~LT-230~~ (reviewed 2026-10-01; its `analysis/selectors.ts` remainder rides LT-245). ~~LT-227 → LT-289~~ (reviewed 2026-10-01).
  ~~LT-234, LT-231, LT-244~~ (reviewed 2026-10-01). ~~LT-368~~ (their review follow-ups; reviewed 2026-10-01, follow-up LT-378 in BACKLOG). LT-247 parked to BACKLOG (ruling 2026-10-01: demand-gated, see its entry). The LT-245 spike (reviewed 2026-10-01, [ADR 0045](adr/0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md)) closes the track: ~~LT-379 → LT-380~~ (reviewed 2026-10-01, in DONE.md) replaced the hand selector cascades and the hand parse validation, per ADR 0045. Their review follow-ups ~~LT-382~~ (probe exclusivity through HTML tree correction) and ~~LT-384~~ (LTC026 false positives) are reviewed 2026-10-01, in DONE.md.
- **B — typed IR (ADR 0040).** ~~LT-287, LT-288~~ (reviewed 2026-10-01). LT-287 lands
  before LT-274.
- **C — conditions (ADR 0037).** ~~LT-274 → LT-276~~ (reviewed 2026-10-02, in DONE.md) and
  ~~LT-385~~ (reviewed 2026-10-02, in DONE.md — the three review miscompiles). ~~LT-386~~
  (reviewed 2026-10-02, in DONE.md — the census exception joins the exit criterion). ~~LT-388~~
  (done ✓ 2026-10-02, in DONE.md — the ADR 0037 amendments). Remaining:
  LT-275 as the copy round (it also takes LT-359's copy, so there is one Tech Writer round)
  and LT-389 (teaching).
- **D — scoped CSS (ADR 0033).** LT-268 → LT-304 + LT-306 (one landing) → LT-248. It touches
  `css.ts`, the config and the example sheets, not the front ends, so it runs in parallel from
  day one.
- **Parallel slot.** ~~LT-382, LT-384, LT-383~~ (reviewed 2026-10-01, in DONE.md). ~~LT-358~~ (reviewed 2026-10-01, in DONE.md). ~~LT-245~~ (spike — reviewed 2026-10-01, ADR 0045, in DONE.md; its promotion is track A's LT-379 → LT-380) and ~~LT-361~~ (done ✓, in DONE.md).

**Deliberately not here.** LT-257's build half, LT-254 and the rest of P1 stay behind P6, as
ruled 2026-09-19. LT-246 waits for the census format to settle after LT-274. LT-355 (a composed
child silently dropped from a reactive-list template) is a real bug, but it edits the same
template extraction as LT-274 and should follow it. LT-342, LT-352, LT-353, LT-356 and LT-281
stay in the backlog, and so does LT-305 (the baseline guard ships in 3.0 but is not a reshape).
LT-280 (per-item effect channels) is still architect work.

**Exit criterion.** Tier census and warning baseline unchanged from the iteration's opening
measurement (record it before the first change), except where LT-274, LT-276, LT-386 or
LT-304/LT-306 change them by design, as those tasks state. The mechanical tasks (track A, LT-287, LT-288)
leave goldens and parity byte-identical. The reflection's library swaps have landed
(`@typescript-eslint/typescript-estree`, `eslint-visitor-keys`; `magic-string` was struck
2026-10-01 — LT-247 parked, demand-gated), css-select joins them through the materialized-probe
selector engine (LT-379, [ADR 0045](adr/0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md)),
and the net
line count of `server/compiler/` is recorded against the 27.0k baseline. An ADR fixes the
target-emitter interface, including how a reactive condition's prop-dependent initial state is
represented, and LT-274's `conditional` node carries that representation (LT-360). Reactive
conditions and the async boundary lower to template-cloned arms on both surfaces, with render
and diagnostic parity (LT-274, LT-276). Compiled sheets are shadow-root form, emitted scoped in
both `cssTargets` modes (LT-268, LT-304, LT-306). Every reshape ADR 0040 names
has landed. `bun run build:docs` and `check:links` pass.

**Next free task ID: LT-393.** Next free diagnostic code: LTC064 (LTC062/LTC063 are LT-274's; LTC061 is LT-383's; LTC056 is LT-358's; LTC057/LTC058 are LT-257's; LTC059 is LT-374's; LTC060 is LT-375's).

---

### Design gate

LT-360 reviewed 2026-10-01, in DONE.md.

### A — Consolidation (P2b; LT-364, LT-227–LT-232, LT-234, LT-244, LT-368, LT-289, LT-366, LT-367 reviewed, in DONE.md; LT-247 parked to BACKLOG)



### B — Typed IR (ADR 0040; LT-287 before LT-274)

### C — Reactive conditions (ADR 0037; LT-274, LT-276, LT-385, LT-386 and LT-388 done 2026-10-02, in DONE.md; remaining: LT-275, LT-389)

- [ ] LT-389: Teaching and API docs for the template-cloned arms (LT-274/LT-276 review).
  **Skill:** tech-writer
  **Context:** Stale or missing after LT-274/LT-276: `server/compiler/LE_TRUC_COMPILER.md`
  (~412–415 `if`/`switch` IR kinds and "`try` … `hidden`-toggled", ~457 "async tri-state
  toggles", ~693 "`if`/`switch` nodes"); `COMPILER_SPEC.md` row 3.5 ("Missing: reactive
  conditions"); `examples/module/lazyload/module-lazyload.tsx:14` (cites the fieldset
  wrappers); the `reconcile()` JSDoc (`@param template` vs `templates`, `bindArm`'s
  `(element, key, first)`, a `@since` for the arm form); regenerate
  `types/src/helpers/reactive.d.ts`; `docs-src/pages/lists.md` gains the arm form; the
  le-truc skill (write-denied in the LT-274 session): `references/effects.md` (~57, ~263)
  and `le-truc-dev/references/non-obvious.md` (~46–57) gain the arm form, and a
  reactive-conditions + template-arm boundary section joins the skill. Error rows
  (`errors.md`) belong to LT-275. CHANGELOG `[Unreleased]` entry for reactive conditions,
  the arm form, the boundary mechanism and LTC062/LTC063 is Changelog Keeper's at release.
  **Check:** `check:links`; no "toggled arm"/fieldset/`hidden`-toggled boundary teaching
  left outside `adr/` and DONE.

- [ ] LT-275: Diagnostics lifecycle for reactive conditions — retire LTC005's signal-condition face; Tech Writer copy.
  **Skill:** tech-writer (drafting: le-truc-dev)
  **Context:** [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md) reverses "`@if` conditions cannot read signals" (`validateCondition`, `server/compiler/lower-shared.ts`). Only the **condition face** of LTC005 retires — the `t`-in-reactive-position face stays. The error-message lifecycle applies to every face touched: the LTC005 message, the arrow-thunk section's sentence in `server/compiler/HOST_PROFILE.md` and its "Open questions" reactivity paragraph ("creates no DOM outside declared lists", "Branch DOM lifetime … toggled via `hidden` (this host)"), and the teaching in ARCHITECTURE.md, AGENTS.md and the le-truc/cause-effect skills; the new ADR 0037 codes' final wording lands here. Batch with the LT-220/LT-189 copy rounds. **LT-233 rider (2026-09-25):** shared code words diagnostics only through `server/compiler/surface.ts` — each new ADR 0037 code's surface-specific fragments become `SurfaceWording` keys (both tables), and the `CONDITIONS` cases in `server/tests/compiler/tsx/diagnostic-parity.test.ts` flip to the new codes on both surfaces in the same change.
  **Check:** catalog rows added/retired match the diagnostics union; `check:links`; compile-warning baseline 0.
  **Depends on** LT-274.
  **Rider (LT-274/LT-276, 2026-10-02):** first drafts to finalize — **LTC062**
  `dynamicCaseValue` (both faces: non-literal value, duplicate arm key; `wording.caseLabel`),
  **LTC063** `reactiveConditionInReconcileContainer` (`wording.reactiveConditional`), and the
  new LTC005/LTC007 faces in `analysis/effects.ts` (arm set inside another branch / composed
  content / server-data loop body; arm without exactly one root element; construct
  unmountable in an arm; container with no unique selector) and `template-output.ts`
  (`first()` into a reactive arm). `validateCondition`'s unknown-name message was reworded
  (its signal face is gone), and so was `finishTry`'s single-root fix-it (the client now
  clones each arm from a template instead of toggling `hidden`). Catalog rows for LTC062/LTC063; whether LTC035 (duplicate id
  across boundary arms) retires now that only one arm is in the document is an Architect
  question (NOTES.md). The new `SurfaceWording` keys are `caseLabel` and
  `reactiveConditional`.
  **Rider (LT-274/LT-276 review, 2026-10-02):** **LTC035 retires** (only one arm is ever in
  the document; template content is not) — full retirement lifecycle; until then its
  message misstates the mechanism ("non-active arms are hidden, not removed"). `errors.md`
  gains LTC062/LTC063 rows, and the `InvalidTemplateError` row covers the arm form (no
  template, a multi-root arm template). Write "compiler" as the channel in LTC062/LTC063's
  JSDoc, and move both after LTC061 in the `DiagnosticCode` union.
  **Rider (LT-231 review, 2026-10-01):** LT-231 added one new sentence on an existing builder —
  `diagnostic.unsupported` from `analysis/loops.ts` (`… on an element in a server-data <loop>
  body`, fix "`each()` binds reactive attributes, class maps and event handlers only — …"). It
  is Tier 1 Prevented, compiler channel; its final wording, and whether its surface-specific
  fragment needs a `SurfaceWording` key, land in this round.
  **Rider (LT-220/LT-189 review, 2026-10-01):** the ADR 0037 copy those rounds carried moves here — the HOST_PROFILE control-flow row, the arrow-thunk section's reversal, the ARCHITECTURE/AGENTS "`@if` cannot read signals" sentences, and the condition-face fix LT-189 now words as "show and hide the element with `hidden={() => …}`" (`lower-shared.ts` `validateCondition`).

- [ ] LT-359: LT-189/LT-220 review follow-ups — copy corrections.
  **Skill:** tech-writer
  **Context:** (a) `serverOnlyNames` says the read "would throw at connect". A handler throws
  when it runs, not at connect, so word the mechanism position-neutrally (e.g. "throws when the
  client runs it"), and update the parity pins. (b) CHANGELOG `[Unreleased]`'s ICU bullet
  says per-category keys and `truc:case` removal is a **Breaking change**. Neither shipped in
  a release (2.6.0 has no i18n), so drop the breaking-change clause. **Done 2026-10-01** by Changelog Keeper at iteration planning. (c) Compiler copy cites
  "ADR 0023" for the supported subset, composition (s10), config (s8) and async boundaries
  (s13), but `adr/0023` is the bind-helper map-form ADR. The compiler ADR was renumbered or
  purged in `9ccb22e1` ("ADR purge & alignment pass"). **Ruled (Architect, 2026-10-01): it is ADR 0024** — s8 config,
  s10 composition, s13 async boundaries, and the supported subset is ADR 0024 as a whole (s1). The
  section numbers already match; only the number is wrong. Sweep `diagnostics.ts`, the call sites, `errors.md` and the CHANGELOG
  line. (d) ADR 0028's inventory table: add LTC055 and the LTC053 loop-root case, via
  `adr-keeper`. (e) Carry LT-356's copy rider here. (f) **LT-358's rider (2026-10-01):**
  finalize LTC056's `<script>` refusal message (first draft in `scriptElementInTemplate` —
  condition: every `<script>`, whatever its `type`, inside a component template on both
  surfaces; compiler channel, tier 1 Prevented), the boundary-as-loop-root rule's new
  `.tsrx` spelling in the same LTC053 message (`wording.boundary`/`wording.loop` now
  parameterize it), and the LTC050/record-spelled-`t` rewordings' propagation —
  `errors.md`, the skills, ADR 0028's inventory rows for all of it, and AGENTS.md's
  serverOnlyNames-adjacent sentences if the mechanism wording moves. LTC053's `.tsrx` rule fires for ANY body-level `@try`, including one beside an element output, so "is the root of this loop body" can be inaccurate there; word it to cover both (reviewed 2026-10-01). Also carry LT-383's LTC061 first draft if it lands before this round closes.

### D — Scoped CSS (ADR 0033; LT-268 → LT-304 + LT-306 → LT-248)

- [ ] LT-268: Parse the authored stylesheet in the compiler — the `lightningcss` swap for `css.ts` ([ADR 0033](adr/0033-scope-component-styles-by-custom-element-name.md) s9). **Ships in 3.0.** Prerequisite of LT-304, LT-214, LT-269, LT-270.
  **Skill:** le-truc-dev (Tech Writer owns the message copy)
  **Context:** `server/compiler/css.ts` dedents and emits verbatim; the compiler holds **no
  model of the CSS at all**. `lightningcss` is **already a devDependency and already the
  build's CSS effect** (`server/effects/css.ts`). Parse the component's sheet and make its
  rules, selectors and at-rules reachable from the IR. **Spec-grammar validation of authored
  CSS (unknown property, invalid unit, malformed value) rides this swap**: channel compiler,
  **tier 1 Prevented** (ADR 0028 s1), since a malformed sheet has no correct emission.
  Evaluate `css-tree`'s `lexer.matchProperty` only where per-declaration diagnostics are
  wanted rather than a whole-sheet parse failure. This task adds the model and changes no
  output; the scoped emission and the `cssTargets` key are LT-304's.
  **Check:** emitted CSS stays **byte-identical** for every corpus component; a fixture with
  an invalid unit fails the build with the ruled copy; `check:portability` green with the
  dependency (ADR 0038 — it must run under every supported JS runtime; browser loadability is
  not required).

- [ ] LT-304: Scoped emission of shadow-root-form CSS — native `@scope` or the `:where(:not(…))` lowering, per `cssTargets` ([ADR 0033](adr/0033-scope-component-styles-by-custom-element-name.md) s1–s7). **Ships in 3.0. Depends on LT-268; lands together with LT-306** (the corpus migration), since the old tag-led form becomes an error.
  **Skill:** le-truc-dev (Tech Writer owns the new LTC copy; LT-248 is the docs half)
  **Context:** Owner ruling 2026-09-24. A compiled sheet is authored as shadow-root CSS
  (`:host` plus bare selectors) and the compiler gives it shadow-root scoping in light DOM.
  (1) **`cssTargets`**: a browserslist-style key in `le-truc.config.json` (ADR 0036
  validation rules apply), default Baseline widely available, also fed to `lightningcss`'s
  own lowering. (2) **Boundary**: every custom-element tag the lowered template renders,
  composed and raw dashed tags alike. (3) **Native**: wrap the sheet in
  `@scope (my-element) to (<tag> > *, …)`, or `@scope (my-element)` for a leaf; emit
  `:host` as `:where(:scope)` and `:host(<sel>)` as `:where(:scope:is(<sel>))`; hoist
  `@keyframes`/`@font-face`/`@property` out unchanged. (4) **Lowered**: flat selectors led
  by the tag with a zero-specificity guard per boundary tag, e.g.
  `my-element .input:where(:not(my-element form-listbox > *, my-element form-listbox > * *))`,
  and `:host` as `:where(my-element)`. (5) **New tier 1 errors** (channel compiler, tier 1
  Prevented; next free LTC codes after LTC053): a rule led by the component's own tag
  (fix-it: `:host`), `::slotted()` in a light-DOM component, `:host-context()` anywhere
  (removed from the spec), and every `:global` form except the two whole-rule forms. (5a)
  **`:global`** (s6a): top-level `:global(<whole selector>) { … }` and `:global { … }`
  blocks are hoisted out of the scope verbatim; nested blocks, prefixed,
  trailing (fix-it: plain compound), leading-ancestor and mid-selector forms are the tier 1
  errors above, each with its own reason in the copy. (6)
  **Served CSS**: where a folder serves a compiled surface, the page imports the compiler's
  emitted CSS; the `.ts` twin's hand-written `.css` is served only with the twin (s10).
  **Check:** a fixture per contract point in s1/s3 compares the compiled light-DOM output
  with the same sheet inside a real shadow root: the host rule loses to a page type
  selector in both, and a parent rule never reaches a composed child's internals in
  either; a `:global` rule is emitted outside the scope in both modes; fixtures pin the s7 differences (inward reach, page-authored children, and the
  three lowering differences); the corpus Playwright specs pass once per mode (override
  `cssTargets`); each new error fires on its fixture; LTC051 still compares authored
  sheets; corpus warning baseline 0.

- [ ] LT-306: Migrate every compiled corpus stylesheet to the shadow-root form (ADR 0033 s2) and split the twins' CSS (s10). **Ships in 3.0. Lands together with LT-304.**
  **Skill:** le-truc-dev
  **Context:** Every compiled sheet (`.tsx` and `.tsrx`, both members of a variant set
  identically) moves from tag-led nesting (`my-element { … & .x { … } }`) to `:host { … }`
  plus bare rules, and drops the defensive `>` chains that only guarded against downward
  leakage, keeping a `>` where it expresses real intent (direct children only). Write it as
  a codemod over the parsed sheet (LT-268) rather than by hand, and keep it for pioneer
  projects. `module-dialog`'s `body.scroll-lock` becomes `:global(body.scroll-lock)`.
  The `.ts` twins' hand-written `.css` files stay tag-led and verbatim; point
  `examples/main.css` at the emitted CSS for every folder whose served surface is compiled.
  **Check:** the served pages render pixel-identically before and after where no leak was
  present (Playwright screenshot comparison per example, both CSS modes); LTC051 green
  across every variant set; no compiled sheet contains a rule led by its own tag.

- [ ] LT-248: Document compiled-component style scoping (ADR 0033, accepted 2026-09-24) where users read.
  **Skill:** tech-writer
  **Context:** Re-scoped by the ADR 0033 ruling: the doc obligation is no longer "scoped by
  tag name, a known limit" but the ruled model. `docs-src/pages/styling.md`'s compiled-component
  callout and `server/compiler/HOST_PROFILE.md` § Styles (including its selector-enforcement
  open question, now answered) state: a compiled sheet is shadow-root CSS (`:host` plus bare
  selectors), scoped in light DOM so rules stop at every custom element the template renders,
  emitted as native `@scope` or a `:where(:not(…))` lowering per `cssTargets`; host rules lose
  to page styles, as in a shadow root; defensive `>` chains are no longer needed; hand-written
  CSS for runtime-only components stays verbatim and tag-led. **Be plain that only a real
  shadow root gives inward encapsulation**: page CSS can still reach a light-DOM component's
  internals. Name every ADR 0033 s7 difference where an author would otherwise hit it, and
  list what switching to a shadow root changes beyond the stylesheet (s8). Also state the runtime
  baseline (Baseline 2023, REQUIREMENTS § Browser support) in the getting-started or
  installation page. **Lands with LT-304**, not before: until then the docs describe verbatim
  emission.
  **Verification:** `check:links` green; styling.md and HOST_PROFILE.md say the same thing in
  the same words (one is user-facing, one is the authoring profile).

### Parallel slot
