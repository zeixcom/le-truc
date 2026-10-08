# TODO

Current iteration only. The queue is a per-task store (`queue/LT-NNN.md`, one file per task;
`BACKLOG.md`, `TODO.md` and `DONE.md` are views built by `bun run queue:build`). New tasks are
created in `queue/` with a `band:`; the Architect moves them by editing `status:` and the chain
in this file; contributors claim and annotate only through `bun run scripts/queue.ts`. Task IDs
are unique by construction — the filename is the ID; the "Next free task ID" line below
allocates the next one.

**Iteration opened 2026-10-06: the P6 cleanup round and the composition batch.** The
previous iteration (the corpus port and the pre-publish reshapes, opened 2026-10-02) closed on
2026-10-06. The `writer` recorded it in `CHANGELOG.md [Unreleased]`, and its 61 entries are
pruned (`queue/LEDGER.md`, seventh pass).

**Why now (Architect, 2026-10-06).** The first publish waits for the P6 cleanup round (owner,
2026-09-19), and the corpus port's close unblocked P6. P6 does two jobs. It finishes the
standing cleanup items, and it converts the compiled corpus from raw custom-element markup to
composed sub-components (LT-463), so that the corpus models ownership before the compiler
ships. The composition probe for LT-463 found two compose-lowering bugs (LT-460), and LT-468's
review found a third (LT-470). Those are equivalence gaps that more compose sites would only
multiply, so they run first. Section-menu (LT-469) closes the last uncompiled example folder.

**Rulings taken at planning (Architect with the owner, 2026-10-06).**
1. **Scope: P6 plus the two P2b compose fixes.** LT-460 and LT-470 join from P2b because they
   sit in the compose lowering that LT-461 extends and LT-463 exercises. The rest of P2b stays
   in the backlog. The CSS-departures cluster behind LT-409 was struck by ruling 14.
2. **LT-461 is implementation, not a session.** The owner ruled its design on 2026-10-06, so its
   area flips from `design` to `compiler` and it becomes pickable. LTC081 is reserved for its
   rule 6.
3. **Compose enablers run one at a time** (track E): LT-460 → LT-470 → LT-481 → LT-482 → LT-488 → LT-461 all change
   compose-site lowering and its Mount Scope placement. Run in parallel, they would conflict at
   integration.
4. **LT-463 is split (owner).** Its two sites that need the children contract
   (`module-codeblock`'s scrollarea, and `form-checkbox` with its label as children) move to
   LT-462's implementation tasks. LT-463 converts the rest once tracks E and T have landed, so
   the iteration's exit does not wait on a design session.
5. **`module-todo` is edited in sequence:** LT-466 → LT-467 → LT-463. Each `needs:` field says
   so, and track T orders the first two.
6. **LT-135 is merged into LT-093 (owner).** It is the same free-name-through-a-const wall,
   fixed in one pass through the client-needed fixpoint. LT-093 does LT-135's half first.
7. **Two design sessions are scheduled (owner).**
   - LT-462 (the children contract → ADR 0048) runs after the LT-465 spike reports in
     `NOTES.md`.
   - LT-471 (D-32, the compiler's public contract) can run at any point. Nothing in this
     iteration waits on it, and it gates LT-254. Ruling it now means P1 opens unblocked.

   ADR 0048's implementation tasks join this chain if they are ruled before track K closes.
   Otherwise they are banded P6 and open the next iteration beside P1. The session only delays
   them; it never holds this iteration open.
10. **LT-462 ruled into ADR 0048 (owner, 2026-10-06), before track K closed.** Its tasks join as
    track C. Three owner rulings shape them:
    - **Self-nesting gates too little, never too much.** It survives ruling 14 for authored
      limits in the lowered form only (LT-501).
    - **A child styles its declared role boxes**, at zero specificity. Withdrawn by ruling 14;
      LT-475 struck.
    - **The content model is `Children`'s second type argument** (LT-477).

    Track C serializes after track E (LT-472 needs LT-461), because the region marker changes
    compose-site lowering (ruling 3). LTC083–LTC085 are reserved for LT-474, LT-476 and LT-477.
11. **LT-471 ruled D-32 (owner, 2026-10-06).** There is one published entry point, the corpus
    pass. It writes to `outDir`. `RegistryEntry` is narrowed to a public projection, and the
    generated-module API is under semver (`argsFromAttrs` excluded). The reshape is LT-480,
    banded P1. It opens the next iteration ahead of LT-254 and stays out of this chain, because
    P1 waits for this round.
12. **LT-463's residues (owner, 2026-10-07).** LT-490 (a handler-arg body's setup const is
    dropped from the client) joins track E, and LT-491 (section-menu's link-click close) joins
    track M. The conversions LT-463 left raw are banded P6 and stay out of this chain. They are
    LT-489 (BasicButton modifiers), LT-492 → LT-493 (`truc:html` in composed children, then
    splitview) and LT-494 (FormRadiogroup's `.split-button` presentation, then module-todo).
    The exit criterion counts LT-463's sites as composed or ruled into one of them.
13. **A task that changes compiled corpus output gates `test:server` (Architect, 2026-10-07).**
    LT-463 changed generated modules, the server-render snapshots and the authored `.tsx`
    typing, but its gates named only `check:corpus` and `test:variants`. Sixteen server tests
    went red unseen. LT-495 repairs them. From now on an `examples` task that edits a compiled
    source lists `test:server` and `typecheck` among its gates, and the review runs them.
14. **Compiled CSS is platform CSS (owner, 2026-10-07; ADR 0033 rewritten, ADR 0048 s5 cut
    back).** The shadow-root emulation is withdrawn. Its compiler-derived boundaries, ownership
    re-includes and root-insertion exception made the applied rules unpredictable. Scoping is
    now an authored `@scope { … }` with author-written limits. The compiler warns at concrete
    leaks and never emits a limit. Consequences:
    - LT-473 was approved on its own terms but is not integrated. Its branch stays for
      LT-501's salvage.
    - LT-499, LT-500 and LT-475 are struck, and so is the P2b CSS-departures cluster
      (LT-405, LT-407, LT-408, LT-409); the revision answers LT-409's question.
    - LT-501 (emission, errors and the corpus cutover in one commit) → LT-502 (warnings, and
      trimming the codemod's limits) → LT-503 (writer) join track C ahead of LT-478, which is
      re-scoped.
    - LTC070 retires. LTC086–LTC089 are reserved for LT-501/LT-502.
8. **Acceptance criteria are goals, not constraints to satisfy by workaround** (ruling 10 of
   the last iteration still stands). The goals are byte-identical CSS across a variant set, a
   warning baseline of 0, unchanged Playwright specs and unchanged goldens. If a contributor can
   meet one only by bending the design, they annotate the task `blocked` and write the impasse
   into `NOTES.md`. LT-463's rule for surprises is the same thing for composition sites.
9. **Probe-first tasks may close as `done` with a finding.** LT-136 (re-verify against ADR
   0046) and LT-282 (TypeDoc may already regenerate `_media`) each state a premise to check. If
   the premise is false, close the task with a pinning test or a one-line finding rather than
   building the fix.

**The chain.**
- **E — compose enablers** — compose-site lowering, one at a time (ruling 3). LT-460 → LT-470 →
  LT-481 → LT-482 → LT-488 → LT-461 → LT-490. Every task in the track is integrated (LT-490 on
  2026-10-07, ruling 12). Done.

  LT-481 and LT-482 joined from the reviews of LT-470 and LT-481: the arm-root pass planning,
  and the server-only `try` as a server-rendered branch. LT-488 rewords LT-470's remedy for a
  `try` site.
- **S — children-contract spike** — fed the LT-462 session (ruling 10). LT-465. Done.
- **T — module-todo** — ruling 5. LT-466 → LT-467. Done (2026-10-07).
- **G — layout graph** — the variant sets `main.ts` still registers through their `.ts` twins,
  so `test:variants` has never measured their compiled clients (found in LT-467's rework). It
  runs before LT-463, which converts them; LT-463 needs it. LT-485. Done.
- **M — section-menu** — the last uncompiled example folder, beside everything. LT-469. Done
  (2026-10-07). LT-491 (ruling 12) fixed its link-click close failure (a fixture link under the test
  layout's `<base>`). Done (2026-10-07).
- **F — form-checkbox `.tsx`** — example folder only. LT-464. Done.
- **K — composition** — after tracks E, T and G (ruling 4; G added 2026-10-07). LT-463 → LT-495 →
  LT-496 → LT-498. LT-463 and LT-495 are done (2026-10-07; LT-495 repaired the `test:server` fallout,
  ruling 13). LT-496 (from LT-495's review) made the compose-site reference count raw
  same-tag elements. LT-498 (from LT-496's review) closes the same blind spot in the other
  discriminator callers and in composed children's own templates. Done (2026-10-07).
- **C — children contract** — ADR 0048, after track E (ruling 10). LT-472 (done) → LT-501 → LT-502 →
  LT-503 → LT-478 → LT-474 → LT-476 → LT-477 → LT-479. LT-501–LT-503 move compiled CSS to
  authored `@scope` (ruling 14). LT-478 styles its passed content under that contract.
- **P — compiler cleanup** — independent of the compose machinery. LT-093 → LT-136. Done
  (2026-10-07). LT-136 closed with a pinning test: LTC005 already refuses the shadowed read.
- **Q — docs and build cleanup** — small, independent. LT-437 → LT-282 → LT-486. Done
  (2026-10-07). LT-282 closed on a false premise (ruling 9): TypeDoc regenerates `_media`.
- **Design gates** — area `design`: the Architect with the owner, never picked by `start-task`.
  LT-471 (D-32) — ruled 2026-10-06 (ruling 11).

**Deliberately not here.** P1 waits for this round: LT-254 now also needs LT-471 (ruled) and LT-480, its reshape, banded P1. The
rest of P2b stays in the backlog (its CSS-departures cluster is struck by ruling 14). So do LT-381, which needs the owner's sign-off because it changes the
census by design, and LT-246, which needs a settled census. The fetched-partials sessions
(LT-448, LT-450) stay in P7, and P2–P5 stay where they are.

**Exit criterion.** Every chain task except the two design sessions is reviewed and
integrated. LT-462 has ruled into ADR 0048, or its open state is recorded here (ruling 7). The
compiled corpus composes every site LT-463 names, except the sites ruled into LT-489, LT-493 and
LT-494 (ruling 12), and every example folder is served compiled,
section-menu included, and `examples/main.ts` registers no variant set through its `.ts` twin
(LT-485). No compose-lowering miscompile LT-460, LT-470, LT-481 or LT-482 names remains. The tier
census and the warning baseline are unchanged from the opening measurement below, except where
a task states a by-design change: LT-469 adds `section-menu: folded`, LT-467 removes
basic-pluralize's entry, and LT-093 may move components from Simulated to Folded. The warning
baseline stays 0. `typecheck`, the server suite, `check:contract`, `check:corpus`, `build:docs`
and `check:links` are green on the closing commit. The net line count of `server/compiler/` is
recorded against the opening measurement.

**Opening measurement (b63fbfed):** `check:corpus` exits 0. The tier census has 42
entries: 34 Folded, 8 Simulated, 0 Static. The compile-warning baseline is 0, and the
translation census has 0 gaps across 6 locales. `server/compiler/` has 79 modules and 37.3k
lines. That count covers every `.ts` file except `*.test.ts`, which is a wider net than the 30.4k
figure from 2026-10-02, so compare the closing measurement with this one only.

**Next free task ID: LT-504.** Next free diagnostic code: LTC090 (LTC086, LTC089 are reserved for LT-501 and LTC087, LTC088 for LT-502; LTC070 is retired by LT-501; LTC083–LTC085 are reserved for LT-474, LT-476 and LT-477; LTC082 was reserved for LT-136
and is released unused; LTC081 is reserved for LT-461; LTC080 is
LT-453's; LTC079 is LT-447's, unused; LTC078 is LT-444's; LTC077 is LT-443's; LTC076 is LT-429's;
LTC075 is LT-355's; LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's; LTC071 is
LT-399's; LTC066–LTC070 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are
LT-274's; LTC061 is LT-383's; LTC060 is LT-375's; LTC059 is LT-374's; LTC057/LTC058 are LT-257's;
LTC056 is LT-358's).

---

<!-- entries -->

### C — children contract

- [ ] LT-501: Authored `@scope` emission — native and lowered, the revised style errors, and the corpus cutover in one commit (ADR 0033 as revised 2026-10-07). — changes requested ↩
  **Area:** compiler
  **Needs:** LT-472
  **Gates:** test:server, typecheck, check:corpus, check:contract, build:docs, check:links, test:variants
  **Area:** compiler
  **Needs:** LT-472
  **Filed (Architect, 2026-10-07; owner ruling, ADR 0033 rewritten, ADR 0048 s5 cut back):** a
  compiled sheet means what it would mean as an inline `<style>` in the host. Scoping is an
  authored prelude-less `@scope { … }` with optional author-written `to (…)` limits. The compiler
  adds no limits of its own. This replaces the shadow-root emulation, whose boundary set was
  derived from the template. LT-473's ownership emission is not integrated. Its branch
  `task/LT-473` stays until this task's review, for salvage only.
  **Do:**
  1. **Partition.** Split the parsed sheet into three groups:
     - top-level `@scope` blocks;
     - top-level rules led by the component's own tag;
     - everything else. `@keyframes`, `@font-face` and `@property` emit verbatim, as now.

     Tag-led rules and other top-level rules emit verbatim in both emissions.
  2. **Native emission.** A prelude-less `@scope` gains the explicit root:
     `@scope (<tag>) to (<authored limits>)`. A preluded `@scope` and the block bodies emit
     verbatim.
  3. **Lowered emission.**
     - **Rule lead.** Each rule in a `@scope` block lowers to `:where(<root>) <selector>`, where
       the root is the tag for a prelude-less block and the prelude otherwise. An explicit
       `:scope` becomes the root compound.
     - **Specificity** must equal the native form, including `:scope`'s (0,1,0). A
       zero-specificity root plus a never-present attribute inside `:not()` is one way to get
       it. Pin the specificity in tests.
     - **Guard.** Each authored limit `L` adds the guard
       `:where(:not(:is(R L, R L *):not(R L <tag>, R L <tag> *)))`. That is ADR 0033 s4's
       re-include of a nested own-tag instance, applied to authored limits only.
     - **Unsupported forms.** A nested `@scope` inside a component `@scope`, and any form the
       lowering cannot express, are **LTC089** (compiler, Prevented) on lowered targets. The
       message names the CSS target. The same forms emit verbatim on native targets.
  4. **Errors** (compiler, Prevented; copy to `../writer/references/error-messages.md`):
     - **LTC066** is reworded. It fires on a rule inside `@scope` led by the component's own
       tag, with the fix-it `:scope`.
     - **LTC086** (new): `:host` anywhere in a light-mode sheet, with the fix-it `:scope`
       (`:host(X)` → `:scope:is(X)`).
     - **LTC069** fires on any `:global`. The fix-it removes the wrapper and moves the rule to
       the top level.
     - **LTC071** is re-scoped to the authored-limit dead rule. It fires when a selector inside
       a `@scope` block descends past a compound that equals one of that block's limits, so the
       limit always excludes its subject.
     - **LTC070** retires. A qualifier after `:scope` is valid CSS. Record the retirement in
       `VOCABULARY_LEDGER.md`.
     - **LTC067** and **LTC068** are unchanged.
     - **LTC051** loses its boundary face. Variant sets compare authored sheets only. Remove
       `CompiledComponent.scopeBoundaries` from the comparison, and remove it entirely if
       nothing else reads it.
  5. **Remove** the derived-boundary emission (`collectScopeBoundaries` as a scope source, the
     boundary guard, `checkSheetBoundaries`'s template-boundary face) and any code left without
     a caller.
  6. **Corpus cutover (same commit).** Write a codemod and run it over every compiled sheet,
     both surfaces and every variant-set member:
     - Wrap the scoped rules in `@scope { … }`.
     - Rewrite `:host` → `:scope` and `:host(X)` → `:scope:is(X)`.
     - Unwrap `:global(…)`/`:global { … }` to top-level rules.
     - **Preserve today's behavior with visible limits.** Where the old boundary set was
       non-empty, write `to (<b1> > *, <b2> > *, …)` with the same tags. LT-502 then removes
       every limit its leak check shows is unneeded.
     - Keep the hand-written twin `.css` files as they are.
  7. **Fixtures.**
     - Rework `examples/test/scoping/css-probe` to the new contract: an authored limit, a
       tag-led rule and an unscoped rule. Salvage `css-probe-child` and its compose-with-children
       cells from `task/LT-473` (`git show task/LT-473:<path>`). Under the new model the parent's
       rules reach its passed content, and so do the child's, unless an authored limit stops
       them. Pin both emissions in Chromium and WebKit.
     - Port the relevant `css-scope.test.ts` cases and delete the obsolete ones.
  8. **Docs.** Update HOST_PROFILE § Styles, LE_TRUC_COMPILER's diagnostics families,
     `docs-src/pages/styling.md` and `skills/le-truc/references/styling.md` to the new contract.
     Remove the s7 "differences from a real shadow root" list, except for inward reach and the
     lowered form's missing scope proximity.
  **Check:** computed styles of the served corpus are unchanged, by LT-397's pixel-parity
  procedure. Any change is a `NOTES.md` entry, not a workaround. Report the byte delta of the
  emitted CSS per component against `v3` HEAD; the lowered form should shrink.
  **Channel/tier:** compiler. LTC066, LTC069, LTC071, LTC086 and LTC089 are tier 1 Prevented.

  **Changed:** Compiled sheets are authored platform CSS: a prelude-less `@scope { … }` with author-written `to (…)` limits, `:scope` for the host, tag-led and other top-level rules verbatim. The derived-boundary emission is gone (`collectScopeBoundaries`, the guard, `checkSheetBoundaries`, `CompiledComponent.scopeBoundaries`, the LTC051 boundary face). All 51 compiled corpus sources moved by `scripts/migrate-scope-css.ts`, with the old boundary sets written as `to (<tag> > *, …)` limits.
    **How:** `css-scope.ts` is rewritten. Native: the sheet ships as authored, a prelude-less `@scope` gains `(<tag>)`. Lowered: each component `@scope` unwraps into flat selectors: `:where(<root>)` lead, `:scope` → `:where(<root>):not([data-truc-scope-pad])` (pad gives (0,1,0), pinned in tests), `:where(:scope)` → bare lead, and the spec'd guard per limit (not applied when the subject is the root). Diagnostics: LTC066 reworded (inside `@scope` only), LTC086 new (`:host`), LTC069 on any `:global`, LTC071 re-scoped to limit-dead rules (also treats `<X> > *` limits as excluding `<X> …`), LTC070 retired (ledger), LTC089 new (nested `@scope`, limit naming `:scope`; lowered targets only, names the targets; runs in `pipeline.ts`). Removed `migrate-shadow-css` (script + test) and the LT-465 prototype `children-scope` (test + helper; spike scripts archived with a note). `examples/test/scoping` reworked: `css-probe` plus salvaged `css-probe-child`; the spec compares the compiled emission with the same sheet inline in a plain host, in both emissions. Docs: HOST_PROFILE, LE_TRUC_COMPILER, VOCABULARY_LEDGER, COMPILER_SPEC §7, styling page, skill refs (styling, errors, compiled), CHANGELOG.
    **Check:** Gates green: `test:server` 3551, `typecheck`, `check:corpus`, `check:contract`, `build:docs`, `check:links`; browser: css-probe spec 18/18 (Chromium + WebKit) in lowered and in native mode, full `examples` Playwright run 996 passed / 10 skipped (lowered). `test:variants`: see report. **Not satisfied:** the pixel-parity Check was not run (no screenshot harness), and a static scan shows the `:scope` specificity step changes computed styles in about nine parent-vs-child-host pairs (NOTES.md, first entry): the combobox listbox popup is the clear one. Needs an owner decision (`:scope` and fix corpus rules, or codemod to `:where(:scope)`). Byte delta vs v3 HEAD, lowered default: corpus CSS 102,044 → 151,917 (+49,873, +49%); largest module-todo +13,091 (5 limits), module-coloreditor +4,079, form-colorgraph +3,514, module-calctable +3,151; the per-limit guard with the re-include is longer than the old single guard, so the lowered form grew, not shrank. LT-502 removes unneeded limits. Lowered guard misses an own-tag instance that is itself the limit element (NOTES.md).
    **Review:** Changes requested (2026-10-08), after an owner ruling folded into ADR 0033 s1/s4: the host idiom is `:where(:scope)`, descendants are bare, and limits are authored. The full code read happens on the rework. (1) **Codemod re-run.** `:host { … }` becomes `@scope to (…) { :where(:scope) { root declarations, `&`-led root variants } … }`. Descendant rules move out of the host block as bare rules, and authored combinators stay as relative selectors (`> p`). `:host(X)` becomes `:where(:scope)X`, so a variant gets (0,1,0), and a state-dependent descendant becomes `:where(:scope)X <desc>`. Limits stay as written. The fix-its of LTC086 and LTC066 name `:where(:scope)` (`:host(X)` → `:where(:scope)X`). Bare `:scope` stays legal: there is no lint, and the ADR defers one until real conflicts show. (2) **The NOTES flip list was wrong.** Parent rules nested under `:scope` gained the same (0,1,0), so no parent-vs-child-host pair flipped. The Architect deleted the entry. (3) **Pin the specificity contests in `css-probe`, both emissions.** A parent's bare rule on the child's host beats the child's `:where(:scope)` base. The child's `:where(:scope).x` variant beats the parent's bare rule. A page rule led by the bare tag beats the base host rule. (4) **Lowered guard misses an own-tag limit element.** When the limit element is itself an own-tag instance (`<basic-button><css-probe>` under `to (basic-button > *)`), native styles it as its own scope root, but lowered excludes it. Extend the re-include to that case (the spelling is yours) and pin it in `css-probe`. (5) **Docs.** HOST_PROFILE § Styles, `docs-src/pages/styling.md` and `skills/le-truc/references/styling.md` teach the idiom. They also document the lowering hazard: ties that native breaks by proximity fall to source order, an aggregate puts page CSS first, and component order is unspecified, because no order is right for every composition. Add that page-first rule to `examples/main.css`'s header comment. (6) **Check.** In place of pixel parity, run a computed-style diff of every served example page (`v3` vs branch, Chromium, lowered; run Playwright outside the sandbox, NOTES item 6). List each difference with its cause on the `**Reworked:**` line. Expected: root variants (`:host(.x)` was 0) and none else. Report the byte delta again. The pad leaves the corpus, and the guard cost stays until LT-502.

- [ ] LT-502: Leak and unscoped-rule warnings from the compiler's knowledge of composed children (ADR 0033 s5); drop the corpus limits they show are unneeded.
  **Area:** compiler
  **Needs:** LT-501
  **Gates:** test:server, typecheck, check:corpus, test:variants
  **Area:** compiler
  **Needs:** LT-501
  **Filed (Architect, 2026-10-07; ADR 0033 s5 as revised):** the compiler warns only where a
  concrete leak exists. It never emits a limit.
  **Do:**
  1. **LTC087, downward leak** (compiler, Contained; the CSS ships as authored).
     - Fires when a rule in a component `@scope` block has a subject that can match a shape that
       a composed child renders in its own template. Use the registry's `renderedShapes`
       closure, transitively, and exclude the child's Children Region content.
     - It does not fire when an authored limit of that block excludes the child (`<child> > *`,
       or any limit that matches the child's host or an ancestor of the shape inside the child).
     - Content the component passes as `children` is its own markup, not a leak (ADR 0048 s5).
     - The message names the rule, the child and the fix-it `to (<child-tag> > *)`.
     - Raw custom elements in the template have no registry shapes and never warn.
  2. **LTC088, unscoped rule** (compiler, Contained). Fires on a top-level rule that is neither
     in `@scope` nor led by the component's own tag, nor `@keyframes`, `@font-face` or
     `@property`.
  3. **Corpus.** Remove every `to (…)` limit LT-501's codemod wrote whose removal raises no
     LTC087. Keep the rest. List both sets in the handoff. Computed styles stay unchanged
     (LT-397's procedure). The compile-warning baseline stays 0: resolve every LTC088 in the
     corpus by scoping or tag-leading the rule, and list each one.
  4. Copy goes to `../writer/references/error-messages.md` and the `skills/le-truc` errors row.
  **Check:** `test:server` pins the following cases:
  - a leak through a composed child's internal class;
  - no leak when a limit excludes it;
  - no leak into passed children;
  - a transitive grandchild leak;
  - LTC088 on an unscoped `.x` and not on `my-el .x`.

  **Channel/tier:** compiler, tier 2 Contained (warnings).

- [ ] LT-503: Writer pass over the platform-CSS contract — error copy and styling docs (ADR 0033 as revised).
  **Area:** docs
  **Needs:** LT-502
  **Gates:** build:docs, check:links
  **Area:** docs
  **Needs:** LT-502
  **Filed (Architect, 2026-10-07):** LT-501 and LT-502 write first-draft copy and update the
  docs to the contract. This pass makes it one voice:
  - the messages of LTC066, LTC069, LTC071, LTC086, LTC087, LTC088 and LTC089 per
    `references/error-messages.md`, plus the `skills/le-truc` errors rows;
  - `docs-src/pages/styling.md`, which now teaches `@scope { … }`, author-written limits,
    `:where(:scope)` for page-overridable host rules, and the shadow-mode translation;
  - the LTC051 copy that LT-473 extended is gone with its boundary face. Confirm that nothing
    cites it.
  **Check:** `build:docs` and `check:links` green. No prose describes compiler-derived scope
  boundaries or `:host` in light-DOM sheets.

- [ ] LT-478: module-codeblock composes `<ModuleScrollarea>` and styles its own `pre`/`code` scoped.
  **Area:** examples
  **Needs:** LT-502
  **Gates:** check:corpus, build:docs, test:server, typecheck
  **Area:** examples
  **Needs:** LT-502
  **Filed (Architect, 2026-10-06, split from LT-463; re-scoped 2026-10-07 to ADR 0033 as revised):**
  1. **The compose site.** Replace the raw `<module-scrollarea orientation="horizontal">` with
     `<ModuleScrollarea orientation="horizontal">`, passing the `<pre><code>{children}</code></pre>`
     as children. `first('code', …)` now verifies into the parent's own region (LT-472).
  2. **The styles.** Move the former `:global` `pre`/`code` rules (top-level after LT-501) into
     the component's `@scope` block as bare `pre`/`code` rules. The parent's scoped rules reach
     its passed content as descendants. If the block carries a `to (module-scrollarea > *)`
     limit, that limit would cut the content, so drop it unless LTC087 then fires on a real
     leak. If it does, narrow the limit to the leaking scrollarea internals.
  **Check:** `bun run test:component module-codeblock` is unchanged, and the computed styles of
  `pre`/`code` are unchanged. Update `module-codeblock.md` if it describes the raw tag.

- [ ] LT-474: Declared roles — the `Children<Roles, Model>` type and the reach-in check (ADR 0048 s2; LTC083).
  **Area:** compiler
  **Needs:** LT-472
  **Gates:** check:corpus, check:contract
  **Area:** compiler
  **Filed (Architect, 2026-10-06, LT-462 session; ADR 0048 s2):**
  1. **The type.** `Children<Roles extends Record<string, keyof HTMLElementTagNameMap> = {},
     Model extends 'any' | 'non-interactive' = 'any'>` is a phantom-branded `string`. It stays
     assignable to and from the rendered markup string, so `children = ''` defaults and existing
     `children?: string` sources keep compiling. Export it type-only beside `FactoryContext`
     (`types/src/component.d.ts`, re-exported from the package entry), with zero runtime bytes.
     The compiler reads the roles and the model from the declared parameter type, on both
     surfaces.
  2. **Role typing.** A child's `first('.<role>')`/`all('.<role>')` types as the declared tag's
     element.
  3. **LTC083, the reach-in.**
     - Channel: compiler. Tier: Prevented (ADR 0028).
     - Fires when a child's `first()`/`all()` selector matches nothing in the child's own
       template, its component inserts `{children}`, and its subject compound names no declared
       role class.
     - Such a selector can only resolve inside the content, so it reaches past the contract.
     - The fix-it names the role declaration.
     - Write the copy to `../writer/references/error-messages.md`.
  **Corpus survey first:** list every component that addresses its children today. For each,
  either declare roles or record it in `NOTES.md` (LT-463's rule for surprises). Do not widen
  LTC083's condition to pass a site.

- [ ] LT-476: One writer per property — parent bindings on a child-written role property conflict (ADR 0048 s3; LTC084).
  **Area:** compiler
  **Needs:** LT-474
  **Gates:** check:corpus, check:contract
  **Area:** compiler
  **Filed (Architect, 2026-10-06, LT-462 session; ADR 0048 s3):**
  - **Registry.** The compose registry records, per child, the role properties its client writes:
    the role-targeted `watch` bindings (`bindProperty`, `bindAttribute`, `bindText`, `bindClass`,
    `bindVisible`, `bindStyle`, `bindAria`). `on()` return updates write host props, so they are
    out of scope.
  - **Check.** A parent binding on an element of its passed children that carries that role's
    class and binds the same property, attribute, class token or style property is LTC084.
  - **Channel/tier:** compiler, Prevented (ADR 0028).
  - **Where it reports:** at the parent's binding. The message names both writers.
  - **Copy:** to `../writer/references/error-messages.md`.
  **Check:** both surfaces. Pin a passing fixture where the parent binds a different property on
  the same role.

- [ ] LT-477: Content model — `Children<Roles, 'non-interactive'>` refuses interactive content at the compose site (ADR 0048 s4; LTC085).
  **Area:** compiler
  **Needs:** LT-474
  **Gates:** check:corpus, check:contract
  **Area:** compiler
  **Filed (Architect, 2026-10-06, LT-462 session; owner ruling (c), second type argument):**
  1. **Interactive content** means: `a[href]`, `button`, `input` (except `type="hidden"`),
     `select`, `textarea`, `label`, `details`, `iframe`, any `[tabindex]`, and `audio`/`video`
     with `controls`.
  2. **Registry.** The compose registry gains `interactive: boolean` per component, set when its
     template contains such an element, transitively through its own composed children.
  3. **LTC085.** A compose site of a child that declares `'non-interactive'` is an error when its
     literal children contain interactive content or compose an interactive component.
     - Channel/tier: compiler, Prevented (ADR 0028).
     - The message names the offending element or component and the child's declaration.
  4. **Documentation.** Document in HOST_PROFILE that page-authored HTML is unchecked and that
     TypeScript cannot carry the check.
  **Copy:** to `../writer/references/error-messages.md`.

- [ ] LT-479: module-todo composes `<FormCheckbox>` with its label as non-interactive children.
  **Area:** examples
  **Needs:** LT-463, LT-464, LT-477
  **Gates:** check:corpus, test:variants
  **Area:** examples
  **Filed (Architect, 2026-10-06, split from LT-463; owner ruling (c) in LT-462):**
  1. **form-checkbox.** Takes its label as `children: Children<{}, 'non-interactive'>`, inserted
     where its template renders the label text. Change it in every variant-set member, and keep
     the CSS byte-identical (ADR 0039).
  2. **module-todo.** Replace its raw `<form-checkbox>` markup with `<FormCheckbox>`, passing the
     label as children.
  LT-466 has already moved the in-place editor out of the label, so the children are
  non-interactive and LTC085 passes. A remaining interactive site is a `NOTES.md` entry, not a
  workaround.
  **Sequence:** module-todo's fourth edit, after LT-466 → LT-467 → LT-463 (ruling 5).
  **Check:** `test:component form-checkbox module-todo` is unchanged.

- [ ] LT-501: Authored `@scope` emission — native and lowered, the revised style errors, and the corpus cutover in one commit (ADR 0033 as revised 2026-10-07). — changes requested ↩
  **Area:** compiler
  **Needs:** LT-472
  **Gates:** test:server, typecheck, check:corpus, check:contract, build:docs, check:links, test:variants
  **Area:** compiler
  **Needs:** LT-472
  **Filed (Architect, 2026-10-07; owner ruling, ADR 0033 rewritten, ADR 0048 s5 cut back):** a
  compiled sheet means what it would mean as an inline `<style>` in the host. Scoping is an
  authored prelude-less `@scope { … }` with optional author-written `to (…)` limits. The compiler
  adds no limits of its own. This replaces the shadow-root emulation, whose boundary set was
  derived from the template. LT-473's ownership emission is not integrated. Its branch
  `task/LT-473` stays until this task's review, for salvage only.
  **Do:**
  1. **Partition.** Split the parsed sheet into three groups:
     - top-level `@scope` blocks;
     - top-level rules led by the component's own tag;
     - everything else. `@keyframes`, `@font-face` and `@property` emit verbatim, as now.

     Tag-led rules and other top-level rules emit verbatim in both emissions.
  2. **Native emission.** A prelude-less `@scope` gains the explicit root:
     `@scope (<tag>) to (<authored limits>)`. A preluded `@scope` and the block bodies emit
     verbatim.
  3. **Lowered emission.**
     - **Rule lead.** Each rule in a `@scope` block lowers to `:where(<root>) <selector>`, where
       the root is the tag for a prelude-less block and the prelude otherwise. An explicit
       `:scope` becomes the root compound.
     - **Specificity** must equal the native form, including `:scope`'s (0,1,0). A
       zero-specificity root plus a never-present attribute inside `:not()` is one way to get
       it. Pin the specificity in tests.
     - **Guard.** Each authored limit `L` adds the guard
       `:where(:not(:is(R L, R L *):not(R L <tag>, R L <tag> *)))`. That is ADR 0033 s4's
       re-include of a nested own-tag instance, applied to authored limits only.
     - **Unsupported forms.** A nested `@scope` inside a component `@scope`, and any form the
       lowering cannot express, are **LTC089** (compiler, Prevented) on lowered targets. The
       message names the CSS target. The same forms emit verbatim on native targets.
  4. **Errors** (compiler, Prevented; copy to `../writer/references/error-messages.md`):
     - **LTC066** is reworded. It fires on a rule inside `@scope` led by the component's own
       tag, with the fix-it `:scope`.
     - **LTC086** (new): `:host` anywhere in a light-mode sheet, with the fix-it `:scope`
       (`:host(X)` → `:scope:is(X)`).
     - **LTC069** fires on any `:global`. The fix-it removes the wrapper and moves the rule to
       the top level.
     - **LTC071** is re-scoped to the authored-limit dead rule. It fires when a selector inside
       a `@scope` block descends past a compound that equals one of that block's limits, so the
       limit always excludes its subject.
     - **LTC070** retires. A qualifier after `:scope` is valid CSS. Record the retirement in
       `VOCABULARY_LEDGER.md`.
     - **LTC067** and **LTC068** are unchanged.
     - **LTC051** loses its boundary face. Variant sets compare authored sheets only. Remove
       `CompiledComponent.scopeBoundaries` from the comparison, and remove it entirely if
       nothing else reads it.
  5. **Remove** the derived-boundary emission (`collectScopeBoundaries` as a scope source, the
     boundary guard, `checkSheetBoundaries`'s template-boundary face) and any code left without
     a caller.
  6. **Corpus cutover (same commit).** Write a codemod and run it over every compiled sheet,
     both surfaces and every variant-set member:
     - Wrap the scoped rules in `@scope { … }`.
     - Rewrite `:host` → `:scope` and `:host(X)` → `:scope:is(X)`.
     - Unwrap `:global(…)`/`:global { … }` to top-level rules.
     - **Preserve today's behavior with visible limits.** Where the old boundary set was
       non-empty, write `to (<b1> > *, <b2> > *, …)` with the same tags. LT-502 then removes
       every limit its leak check shows is unneeded.
     - Keep the hand-written twin `.css` files as they are.
  7. **Fixtures.**
     - Rework `examples/test/scoping/css-probe` to the new contract: an authored limit, a
       tag-led rule and an unscoped rule. Salvage `css-probe-child` and its compose-with-children
       cells from `task/LT-473` (`git show task/LT-473:<path>`). Under the new model the parent's
       rules reach its passed content, and so do the child's, unless an authored limit stops
       them. Pin both emissions in Chromium and WebKit.
     - Port the relevant `css-scope.test.ts` cases and delete the obsolete ones.
  8. **Docs.** Update HOST_PROFILE § Styles, LE_TRUC_COMPILER's diagnostics families,
     `docs-src/pages/styling.md` and `skills/le-truc/references/styling.md` to the new contract.
     Remove the s7 "differences from a real shadow root" list, except for inward reach and the
     lowered form's missing scope proximity.
  **Check:** computed styles of the served corpus are unchanged, by LT-397's pixel-parity
  procedure. Any change is a `NOTES.md` entry, not a workaround. Report the byte delta of the
  emitted CSS per component against `v3` HEAD; the lowered form should shrink.
  **Channel/tier:** compiler. LTC066, LTC069, LTC071, LTC086 and LTC089 are tier 1 Prevented.

  **Changed:** Compiled sheets are authored platform CSS: a prelude-less `@scope { … }` with author-written `to (…)` limits, `:scope` for the host, tag-led and other top-level rules verbatim. The derived-boundary emission is gone (`collectScopeBoundaries`, the guard, `checkSheetBoundaries`, `CompiledComponent.scopeBoundaries`, the LTC051 boundary face). All 51 compiled corpus sources moved by `scripts/migrate-scope-css.ts`, with the old boundary sets written as `to (<tag> > *, …)` limits.
    **How:** `css-scope.ts` is rewritten. Native: the sheet ships as authored, a prelude-less `@scope` gains `(<tag>)`. Lowered: each component `@scope` unwraps into flat selectors: `:where(<root>)` lead, `:scope` → `:where(<root>):not([data-truc-scope-pad])` (pad gives (0,1,0), pinned in tests), `:where(:scope)` → bare lead, and the spec'd guard per limit (not applied when the subject is the root). Diagnostics: LTC066 reworded (inside `@scope` only), LTC086 new (`:host`), LTC069 on any `:global`, LTC071 re-scoped to limit-dead rules (also treats `<X> > *` limits as excluding `<X> …`), LTC070 retired (ledger), LTC089 new (nested `@scope`, limit naming `:scope`; lowered targets only, names the targets; runs in `pipeline.ts`). Removed `migrate-shadow-css` (script + test) and the LT-465 prototype `children-scope` (test + helper; spike scripts archived with a note). `examples/test/scoping` reworked: `css-probe` plus salvaged `css-probe-child`; the spec compares the compiled emission with the same sheet inline in a plain host, in both emissions. Docs: HOST_PROFILE, LE_TRUC_COMPILER, VOCABULARY_LEDGER, COMPILER_SPEC §7, styling page, skill refs (styling, errors, compiled), CHANGELOG.
    **Check:** Gates green: `test:server` 3551, `typecheck`, `check:corpus`, `check:contract`, `build:docs`, `check:links`; browser: css-probe spec 18/18 (Chromium + WebKit) in lowered and in native mode, full `examples` Playwright run 996 passed / 10 skipped (lowered). `test:variants`: see report. **Not satisfied:** the pixel-parity Check was not run (no screenshot harness), and a static scan shows the `:scope` specificity step changes computed styles in about nine parent-vs-child-host pairs (NOTES.md, first entry): the combobox listbox popup is the clear one. Needs an owner decision (`:scope` and fix corpus rules, or codemod to `:where(:scope)`). Byte delta vs v3 HEAD, lowered default: corpus CSS 102,044 → 151,917 (+49,873, +49%); largest module-todo +13,091 (5 limits), module-coloreditor +4,079, form-colorgraph +3,514, module-calctable +3,151; the per-limit guard with the re-include is longer than the old single guard, so the lowered form grew, not shrank. LT-502 removes unneeded limits. Lowered guard misses an own-tag instance that is itself the limit element (NOTES.md).
    **Review:** Changes requested (2026-10-08), after an owner ruling folded into ADR 0033 s1/s4: the host idiom is `:where(:scope)`, descendants are bare, and limits are authored. The full code read happens on the rework. (1) **Codemod re-run.** `:host { … }` becomes `@scope to (…) { :where(:scope) { root declarations, `&`-led root variants } … }`. Descendant rules move out of the host block as bare rules, and authored combinators stay as relative selectors (`> p`). `:host(X)` becomes `:where(:scope)X`, so a variant gets (0,1,0), and a state-dependent descendant becomes `:where(:scope)X <desc>`. Limits stay as written. The fix-its of LTC086 and LTC066 name `:where(:scope)` (`:host(X)` → `:where(:scope)X`). Bare `:scope` stays legal: there is no lint, and the ADR defers one until real conflicts show. (2) **The NOTES flip list was wrong.** Parent rules nested under `:scope` gained the same (0,1,0), so no parent-vs-child-host pair flipped. The Architect deleted the entry. (3) **Pin the specificity contests in `css-probe`, both emissions.** A parent's bare rule on the child's host beats the child's `:where(:scope)` base. The child's `:where(:scope).x` variant beats the parent's bare rule. A page rule led by the bare tag beats the base host rule. (4) **Lowered guard misses an own-tag limit element.** When the limit element is itself an own-tag instance (`<basic-button><css-probe>` under `to (basic-button > *)`), native styles it as its own scope root, but lowered excludes it. Extend the re-include to that case (the spelling is yours) and pin it in `css-probe`. (5) **Docs.** HOST_PROFILE § Styles, `docs-src/pages/styling.md` and `skills/le-truc/references/styling.md` teach the idiom. They also document the lowering hazard: ties that native breaks by proximity fall to source order, an aggregate puts page CSS first, and component order is unspecified, because no order is right for every composition. Add that page-first rule to `examples/main.css`'s header comment. (6) **Check.** In place of pixel parity, run a computed-style diff of every served example page (`v3` vs branch, Chromium, lowered; run Playwright outside the sandbox, NOTES item 6). List each difference with its cause on the `**Reworked:**` line. Expected: root variants (`:host(.x)` was 0) and none else. Report the byte delta again. The pad leaves the corpus, and the guard cost stays until LT-502.

- [ ] LT-503: Writer pass over the platform-CSS contract — error copy and styling docs (ADR 0033 as revised).
  **Area:** docs
  **Needs:** LT-502
  **Gates:** build:docs, check:links
  **Area:** docs
  **Needs:** LT-502
  **Filed (Architect, 2026-10-07):** LT-501 and LT-502 write first-draft copy and update the
  docs to the contract. This pass makes it one voice:
  - the messages of LTC066, LTC069, LTC071, LTC086, LTC087, LTC088 and LTC089 per
    `references/error-messages.md`, plus the `skills/le-truc` errors rows;
  - `docs-src/pages/styling.md`, which now teaches `@scope { … }`, author-written limits,
    `:where(:scope)` for page-overridable host rules, and the shadow-mode translation;
  - the LTC051 copy that LT-473 extended is gone with its boundary face. Confirm that nothing
    cites it.
  **Check:** `build:docs` and `check:links` green. No prose describes compiler-derived scope
  boundaries or `:host` in light-DOM sheets.

- [ ] LT-478: module-codeblock composes `<ModuleScrollarea>` and styles its own `pre`/`code` scoped.
  **Area:** examples
  **Needs:** LT-502
  **Gates:** check:corpus, build:docs, test:server, typecheck
  **Area:** examples
  **Needs:** LT-502
  **Filed (Architect, 2026-10-06, split from LT-463; re-scoped 2026-10-07 to ADR 0033 as revised):**
  1. **The compose site.** Replace the raw `<module-scrollarea orientation="horizontal">` with
     `<ModuleScrollarea orientation="horizontal">`, passing the `<pre><code>{children}</code></pre>`
     as children. `first('code', …)` now verifies into the parent's own region (LT-472).
  2. **The styles.** Move the former `:global` `pre`/`code` rules (top-level after LT-501) into
     the component's `@scope` block as bare `pre`/`code` rules. The parent's scoped rules reach
     its passed content as descendants. If the block carries a `to (module-scrollarea > *)`
     limit, that limit would cut the content, so drop it unless LTC087 then fires on a real
     leak. If it does, narrow the limit to the leaking scrollarea internals.
  **Check:** `bun run test:component module-codeblock` is unchanged, and the computed styles of
  `pre`/`code` are unchanged. Update `module-codeblock.md` if it describes the raw tag.
