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
  (done ✓ 2026-10-02, in DONE.md — the ADR 0037 amendments). ~~LT-275 + LT-359~~ (one Tech
  Writer copy round — reviewed 2026-10-02, in DONE.md) and ~~LT-389~~ (done ✓ 2026-10-02,
  in DONE.md) — track C is closed.
- **D — scoped CSS (ADR 0033).** ~~LT-268~~ (reviewed 2026-10-02, in DONE.md) → LT-304 + LT-306 (one landing; reviewed 2026-10-02, changes required) → ~~LT-397~~ (done 2026-10-02, pending review ⏳ — serves the emission; owner ruling 2026-10-02 in its entry; the whole track D batch lands in its commit). ~~LT-398–LT-402~~ and ~~LT-248~~ (reviewed 2026-10-02, in DONE.md — uncommitted, they land with LT-397's commit). Their review follow-ups ~~LT-403, LT-404, LT-406~~ (reviewed 2026-10-02, in DONE.md; `typecheck` green again). LT-405 was rolled back on 2026-10-02 (owner) and moved to BACKLOG.md P2b. Their own follow-ups LT-407 (LTC070's nested face) and LT-408 (the zero-specificity `:host(…)` s7 difference) are deferred to BACKLOG.md P2b (owner, 2026-10-02): the departures from a real shadow root need a design session first. ~~LT-394 → LT-395~~ and ~~LT-396~~ (its review follow-ups; reviewed 2026-10-02, in DONE.md — uncommitted, they land with LT-304's commit). It touches
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

**Next free task ID: LT-409.** Next free diagnostic code: LTC072 (LTC071 is LT-399's; LTC070 is LT-304's, per the pre-handoff review; LTC066–LTC069 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are LT-274's; LTC061 is LT-383's; LTC056 is LT-358's; LTC057/LTC058 are LT-257's; LTC059 is LT-374's; LTC060 is LT-375's).

---

### Design gate

LT-360 reviewed 2026-10-01, in DONE.md.

### A — Consolidation (P2b; LT-364, LT-227–LT-232, LT-234, LT-244, LT-368, LT-289, LT-366, LT-367 reviewed, in DONE.md; LT-247 parked to BACKLOG)



### B — Typed IR (ADR 0040; LT-287 before LT-274)

### C — Reactive conditions (ADR 0037; LT-274, LT-276, LT-385, LT-386, LT-388, LT-275 + LT-359 and LT-389 done 2026-10-02, in DONE.md — track C closed)

### D — Scoped CSS (ADR 0033; LT-268, LT-394–LT-396 reviewed 2026-10-02, in DONE.md; LT-304 + LT-306 reviewed 2026-10-02, changes required → LT-397–LT-402; LT-398–LT-406 and LT-248 reviewed 2026-10-02, in DONE.md; LT-397 done 2026-10-02, pending review ⏳; LT-407/LT-408 deferred to BACKLOG.md 2026-10-02)

- [x] LT-304: Scoped emission of shadow-root-form CSS — native `@scope` or the `:where(:not(…))` lowering, per `cssTargets` ([ADR 0033](adr/0033-scope-component-styles-by-custom-element-name.md) s1–s7). **Ships in 3.0. Depends on LT-268; lands together with LT-306** (the corpus migration), since the old tag-led form becomes an error. — reviewed, changes required (LT-397–LT-402)
  **Skill:** le-truc-dev (Tech Writer owns the new LTC copy; LT-248 is the docs half)
  (done 2026-10-02, pending review ⏳ — landed with LT-306. Emission is string-level over the
  read-only parse (upstream #1065/#1081 tracked; pins aligned, ADR 0033 s9 amended with the
  wasm-distribution line). Owner rulings R1–R3 of 2026-10-02 implemented: lowered rules lead
  `:where(<tag>)`; `cssTargets` is the per-browser object with a fixed pinned default (LE_TRUC_COMPILER
  §7.1 row; the site bundle keeps its own target, stated in `server/effects/css.ts`); `:host<qualifier>`
  is LTC070 (fix-it `:host(…)`), with the corpus migrated to the argument form. New codes LTC066–LTC069
  (own-tag-led, `::slotted`, `:host-context`, `:global` misuses, six faces) — first drafts in
  `diagnostics.ts`, Tech Writer owns the copy. Full handoff (pixel-parity evidence, the codemod's
  modes, the pre-existing build:docs sim residue) in NOTES.md. Census by design: css-probe
  (examples/test/scoping, the contract fixture) joins the registry — 36 entries, 28 folded /
  8 simulated; the tier-corpus map test pins it.)
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
  **Hazard (LT-268 review, 2026-10-02):** `ComponentIR.sheet` is collected read-only. The
  lightningcss 1.33 write path (returning nodes from the visitor) crashes with "failed to
  deserialize … Specifier" whenever a nested rule's declaration holds `var()`. Settle the
  emission strategy (a fixed upstream release, serializing from the collected AST, or
  string-level rewriting of selectors only) before building on it. Already filed upstream
  (parcel-bundler/lightningcss): #1081 is our exact error, #1065 the custom-properties
  trigger — track those rather than filing a new one.
  Keep `lightningcss-wasm` (exact pin) and `lightningcss-cli` (caret) on one version — ADR
  0033 s9's distribution line (wasm, for ADR 0038) rides this task's ADR touch.
  **Check:** a fixture per contract point in s1/s3 compares the compiled light-DOM output
  with the same sheet inside a real shadow root: the host rule loses to a page type
  selector in both, and a parent rule never reaches a composed child's internals in
  either; a `:global` rule is emitted outside the scope in both modes; fixtures pin the s7 differences (inward reach, page-authored children, and the
  three lowering differences); the corpus Playwright specs pass once per mode (override
  `cssTargets`); each new error fires on its fixture; LTC051 still compares authored
  sheets; corpus warning baseline 0.
  **Review (Architect, 2026-10-02):** the design is right and the pre-handoff rulings landed:
  string-level surgery over the read-only parse avoids the upstream crash, R1 (`:where(<tag>)`
  lead), R2 (per-browser object, pinned default, 255 cap) and R3 (LTC070) are in, the
  `@starting-style` leak and empty-target flattening are fixed, LTC051 compares boundaries, the
  build ordering is fixed. Not approved as done: the emission is not served (LT-397), and probing
  found four emitter defects and one check gap (LT-398), an unpinned set of s7 differences
  (LT-401) and copy owed (LT-402). Entry stays here until LT-397 lands; then both move to
  DONE.md with the follow-ups' outcomes.
  **Pre-handoff review (Architect, 2026-10-02 — fix these before handing off; LT-304 + LT-306):**
  *Rulings (owner):* (R1) lowered rules lead with `:where(<tag>)`, not the bare tag, so a rule
  has the same specificity in both modes (`:where(my-el) .x` ≙ native `.x`). (R2) `cssTargets` stays
  the per-browser minimum-version object, with a fixed default version set bumped deliberately.
  ADR 0033 s4/s5 and ADR 0036 are amended at final review. Align the site bundle's separate
  `--targets '>= 0.25%'` (`server/effects/css.ts`) with it or state why not. (R3) `:host` followed
  directly by a qualifier (`:host.x`, `:host:focus-within`, `:host[attr]`, `:host:state(…)`) matches
  nothing in a shadow root: a new tier 1 error, **LTC070**, channel compiler, fix-it `:host(<qualifier>)`.
  Tech Writer owns the copy.
  *Blocking:* (1) The codemod wrote lowered CSS back into the sources. `light-dark()` became
  undefined `--lightningcss-light/-dark` fallbacks, an invalid value, in `card-callout` (5),
  `module-carousel` (15) and `basic-gauge` (5); it also dropped authored nesting and 5 comments.
  Rewrite selector text only, restore the authored values, nesting and comments. (2) Migrate the
  ~100 `:host<qualifier>` selectors in 14 sources to `:host(…)` (R3). (3) Lowered mode leaks:
  `collectTextRules` doesn't descend into `@starting-style` (or authored `@scope`), so
  `@starting-style { .x {} }` ships unscoped; `RECURSABLE_AT_RULES` in the checks lacks
  `starting-style` too. (4) `cssTargets: {}`, or a browser missing from `NESTING_CAP`, skips flattening,
  so nested rules get no boundary guard. Always flatten, filling missing browsers from the cap,
  and add `cssTargets` validation tests (`{}`, unknown browser, versions above 255 that
  overflow the packed encoding). (5) `examples/main.css` `@import`s the generated CSS, but
  `cssEffect` runs parallel to `compileEffect` (`server/build.ts`), so a fresh checkout fails. Watch
  mode also never rebuilds page CSS on a `<style>` edit (generated `.css` not watched). (6) Delete
  `examples/__pixel/` (a throwaway; darwin PNGs would fail Linux CI); keep `css-probe.css` out of
  the docs bundle. (7) Check items: run the scoping specs once per mode (native `@scope` is
  never browser-tested); pin the remaining s7 differences; assert the shadow `:global` value; use a
  page *type* selector in the host-rule test.
  *Also fix:* `HOISTED_AT_RULES` should match `css.ts`'s `DESCRIPTOR_ATRULES`, plus
  `@keyframes`, `@import` and `@namespace` (`@counter-style` and the others land inside `@scope`
  today). Variant-set members compute their own boundaries, so their emitted CSS can differ while
  LTC051 passes: compare the boundary sets, and correct the comment at `corpus-compile.ts:367`.
  Prune the dead `--sync-twins` rules in `form-listbox` (`module-scrollarea`, `[role=group]`,
  `[role=presentation]`). Drop the unused `LE_TRUC_CSS_TARGETS` override (or record it in
  ADR 0036). Codemod: remove the dead `stripTagCompound`; `tag>x` with no space must not
  widen to a descendant selector.

- [x] LT-306: Migrate every compiled corpus stylesheet to the shadow-root form (ADR 0033 s2) and split the twins' CSS (s10). **Ships in 3.0. Lands together with LT-304.** — reviewed, changes required (LT-397, LT-399, LT-400)
  (done 2026-10-02, pending review ⏳ — the committed codemod `scripts/migrate-shadow-css.ts`
  rewrites SELECTOR TEXT ONLY in place (values, nesting, comments and authored `light-dark()`
  never move; `--from-twins` brings each twin-carrying sheet to the previously-served content,
  cross-boundary rules hoisting as whole-rule `:global`). `examples/main.css` imports the
  emitted CSS for every compiled folder; the twins' hand-written `.css` stays verbatim.
  Served pages render pixel-identical to HEAD on all 36 compiled components' test pages
  (Playwright full-page screenshots, before-worktree at HEAD vs after, default targets).)
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
  **Review (Architect, 2026-10-02):** s10 is not in the commit: `examples/main.css` still
  `@import`s the twins' hand-written `.css`, and the served `docs/assets/main.css` holds no
  scoped rule. The pixel-parity run compared the twins' CSS with itself, and the corpus Playwright
  runs exercised the emission only on css-probe. The real comparison is LT-397's. The
  codemod has a wrong cross-boundary heuristic (LT-400), and it left one dead rule in
  module-listnav (LT-399).

- [x] LT-397: Serve the scoped emission — repoint `examples/main.css` (ADR 0033 s10; LT-306 review, **blocking**). — done 2026-10-02, pending review ⏳
  **Skill:** le-truc-dev
  (done 2026-10-02, pending review ⏳ — repoint landed with the whole uncommitted track D batch
  and the owner-ruled corpus fixes. Cause 3: module-codeblock's `pre`/`code` rules hoisted into
  a top-level `:global { … }` block (the listnav pattern); the s3 boundary kept, LTC071
  untouched. Cause 4: colorinfo's `dt`/`dd` rules nested under its `dl` rule so the emitted
  `:where(module-colorinfo) dl dt` ties the page's `dl dt` and wins by order; the lazyload
  nested-components mock drops its `.counter` margin, which the callout's
  `:where(card-callout) > :last-child` (0,1,0) no longer out-specifies against the
  runtime-injected mock style. Verification RE-RUN after the LT-405 rollback (owner, same day):
  full-page screenshots of all 35 compiled test pages, HEAD worktree vs this tree — 33/35
  pixel-identical in BOTH modes (the 2 differences, card-mediaqueries and context-media, are
  card-mediaqueries' sheet being served for the first time — twin-less, no import at HEAD —
  not a regression; one module-pagination byte-noise false positive visually checked
  identical). Corpus Playwright suite 990 passed / 10 skipped / 0 failed once per mode,
  Chromium + WebKit (LT-401's owed scoping run included). Server suite 2831/0, typecheck,
  check:corpus, check:links green. `docs/assets/main.css` contains the `:where(<tag>)` rules
  after `build:docs`; `build:docs` itself still fails the simulation gate on 2 unclassified
  canvas notices attributed to module-lazyload — pre-existing at HEAD (LT-306 session,
  worktree-proven), LT-335's family, and the baseline test correctly rejects a workaround
  classification; see NOTES.md.)
  **Context:** `examples/main.css` still imports `./<group>/<name>/<tag>.css` (the twins) for every
  folder. For each folder whose served surface is compiled, import the emitted
  `server/generated/components/<tag>.css` instead; runtime-only folders keep their hand-written
  file. LT-304's build wiring (css effect after the compiler, watching the emitted sheets)
  already expects this. Commit the uncommitted LT-394/LT-395 rows, `HOST_PROFILE.md`,
  `VOCABULARY_LEDGER.md`, `css-tree.d.ts` and `errors.md` edits with it. They were meant to ride
  bffd14ca and did not.
  **Ruling (owner, 2026-10-02 — the NOTES question):** (cause 2) fixed by LT-398 (f); the
  nested-`:host`-qualifier half was LT-405 (rolled back 2026-10-02, BACKLOG.md P2b). (cause 3) **Keep the s3 boundary.** Content that a
  parent's own template places inside a composed child is outside the parent's scope. This
  is a recorded s7 difference (LT-406 documents it, ADR 0033 s7 through adr-keeper). In the
  corpus, module-codeblock's `pre`/`code` rules hoist into a top-level `:global { … }` block,
  the listnav pattern, and the downward leak into nested instances is accepted. LTC071 stays
  as is. (cause 4) The R1 specificity fixes (colorinfo/coloreditor `dt`, card-callout
  `:last-child`) belong in this task, corpus-side, so every difference ends explained or
  fixed. **Commit** the repoint, and the whole uncommitted track D batch with it, only after
  LT-404 is green (it is, as of 2026-10-02) and cause 3's corpus fix is in, so the site never serves the codeblock
  regression. **LT-405 was rolled back on 2026-10-02** (owner), so the corpus is back to its authored nested `&<qualifier>`-in-`:host` rules. The known shadow-DOM departure is recorded in BACKLOG.md P2b for the design session; this commit ships it as HEAD already did. The rollback changed the emission in two ways beyond selector text: module-codeblock's and module-splitview's host-qualified rules (`[collapsed]`, `[orientation="vertical"]`) carry the boundary guard again, and codeblock's `:global` `pre`/`code` rules now follow `:host`. **Rerun the screenshot comparison on the current tree** before committing. The owner's `.agents/` pass over `errors.md` (LT-402's rows) rides the same commit.
  **Channel/tier:** none — no check is added or retired.
  **Verification:** `docs/assets/main.css` contains `:where(<tag>)` rules after `build:docs`. Rerun
  LT-306's check for real: full-page screenshots of every compiled component's test page, HEAD
  worktree vs this change, in BOTH modes (the native run through a throwaway `cssTargets`). Every
  difference is explained or fixed. module-listnav will differ until LT-399 lands. Corpus
  Playwright suite once per mode.

### Parallel slot
