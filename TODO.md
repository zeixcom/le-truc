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
    - LT-473 was approved on its own terms but is not integrated. LT-501 salvaged
      `css-probe-child` from its branch, which is now removed.
    - LT-499, LT-500 and LT-475 are struck, and so is the P2b CSS-departures cluster
      (LT-405, LT-407, LT-408, LT-409); the revision answers LT-409's question.
    - LT-501 (emission, errors and the corpus cutover in one commit) → LT-502 (warnings, and
      trimming the codemod's limits) → LT-503 (writer) join track C ahead of LT-478, which is
      re-scoped.
    - LTC070 retires. LTC086–LTC089 are reserved for LT-501/LT-502.
15. **Corpus-level checks are deferred to P7 (owner, 2026-10-08).** A check whose verdict depends
    on more than the compiler sees (page markup, client scripts, render args) is a stand-alone
    gate over the reference corpus, with an allowlist that gives a reason per surviving finding.
    It is not a compiler diagnostic and gets no `LTC` code. LT-506 (dead CSS: the template is not
    the only markup source, ADR 0033 s2) is reframed so, and it joins `check:html` (LT-508 →
    LT-509, LT-510) in P7, out of this iteration, until iteration planning re-prioritizes them.
    Whichever lands first builds the allowlist matcher the other reuses. Known findings don't
    wait for the gates: LT-507 removes the known dead selectors in this iteration.
16. **Track C's remainder runs in three parallel steps (owner, 2026-10-08).** LT-478 has no
    stake in the children contract's compiler work, so it moves to track CB and runs beside
    LT-474. LT-476 moves to track C2 and needs LT-477 as well as LT-474: both extend the compose
    registry, add a diagnostic and write error copy, and in parallel they would conflict at
    integration. LT-476 then runs beside LT-479. The steps are LT-478 ∥ LT-474, then LT-477,
    then LT-479 ∥ LT-476.
8. **Acceptance criteria are goals, not constraints to satisfy by workaround** (ruling 10 of
   the last iteration still stands). The goals are byte-identical CSS across a variant set, a
   warning baseline of 0 (deliberate component-bound page-wide rules excepted, `examples/test/**` fixtures uncounted; LT-502 ruling), unchanged Playwright specs and unchanged goldens. If a contributor can
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
- **C — children contract** — ADR 0048, after track E (ruling 10). LT-472, LT-501 → LT-502 →
  LT-504 → LT-505 → LT-507 → LT-503 are done (2026-10-08): they moved compiled CSS to authored
  `@scope` (ruling 14), retired the corpus's 2.x child chains, completed the leak warning and
  removed the corpus's known dead selectors (ruling 15). Remaining: LT-474 → LT-477 → LT-479
  (ruling 16).
- **C2 — role writers** — beside track C (ruling 16). LT-476 → LT-512 (owner, 2026-10-08: the
  reference-precision follow-up from LT-478's review, after LT-474's verifier changes).
- **CB — module-codeblock** — beside track C (ruling 16). LT-478 styles its passed content
  under the platform-CSS contract.
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

**Next free task ID: LT-514.** Next free diagnostic code: LTC090 (LTC090 was reserved for LT-506 and is released unused; LTC086, LTC089 are reserved for LT-501 and LTC087, LTC088 for LT-502; LTC070 is retired by LT-501; LTC083–LTC085 are reserved for LT-474, LT-476 and LT-477; LTC082 was reserved for LT-136
and is released unused; LTC081 is reserved for LT-461; LTC080 is
LT-453's; LTC079 is LT-447's, unused; LTC078 is LT-444's; LTC077 is LT-443's; LTC076 is LT-429's;
LTC075 is LT-355's; LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's; LTC071 is
LT-399's; LTC066–LTC070 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are
LT-274's; LTC061 is LT-383's; LTC060 is LT-375's; LTC059 is LT-374's; LTC057/LTC058 are LT-257's;
LTC056 is LT-358's).

---

<!-- entries -->

### C — children contract

- [ ] LT-474: Declared roles — the `Children<Roles, Model>` type and the reach-in check (ADR 0048 s2; LTC083). — changes requested ↩
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

  **Changed:** ADR 0048 s2, the children contract's child side. `Children<Roles, Model>` (`src/component.ts`, re-exported from the package entry and the committed `types/` build) is a phantom-branded string — `children = ''` defaults and existing `children?: string` sources keep compiling — with the Roles constraint enforcing `keyof HTMLElementTagNameMap` tags and the `'any' | 'non-interactive'` model union at tsc. `FactoryContext<P>` is role-aware: `first('.tab')`/`all('.tab')` type as the declared tag's element (empty role set = `never` parameter, so the plain selector-string typing applies to everything else). The compiler reads the roles and the model syntactically from the `children` arg's annotation (`readChildrenContract` in `params.ts`: inline `Children<…>` or a same-file alias, string-literal keys included), carries them on the IR as `childrenContract`, and enforces **LTC083** (tier 1 Prevented, no runtime half): a `first()`/`all()` selector that matches nothing in the child's own template, in a child whose template inserts `{children}`, whose subject compound — after the last combinator (`namesDeclaredRole` in `first-refs.ts`, css-what) — names no declared role class, fails the compile at both selector-verification sites (the raw no-match in `resolveTemplateOutput`, the deferred no-match in `analysis/compose-refs.ts`), for required and optional references alike. An unparsable subject stays with the existing handling. A role-addressed reference that matches nothing resolves as today's `unmatched` ref: the authored selector queried from the host, found inside the content through LT-472's region re-include. Docs: HOST_PROFILE § Element references, LE_TRUC_COMPILER diagnostic inventory, VOCABULARY_LEDGER (LTC083 row; LTC082/LTC084/LTC085 stay reserved for their tasks), `skills/le-truc/references/errors.md`, CHANGELOG Unreleased. Diagnostics tests in `diagnostics.test.ts` (both surfaces, the deferred leg, the alias read, subject-compound rule, LT-123 non-regression), type pins in `src/tests/component.test.ts`.

  **How:** The check reads the population the structural verifier already verifies — declared `const x = first(…)` element refs. Inline `first()`/`all()` calls (an `on(first(…))` target, an `all(…)` inside a watch thunk) compile verbatim by the existing policy and are outside structural verification, so they are outside this check. The corpus survey found no declared ref resolving only inside children: form-listbox's option buttons, form-checkbox's input, module-codeblock's `code`/copy/overlay, module-dialog's buttons and `dialog` all match the child's own markup; context-media, section-menu, card-callout, card-blogpost and module-scrollarea declare no refs. The one component that addresses its children — `module-cem-list` (`.tsrx` + `.tsx` twin), whose `first('form-textbox')`/`all('card-collapsible')` resolve only in the page-authored `{% cem-list %}` output — does so through INLINE calls, so it compiles unchanged; recorded in NOTES.md. `types/` was regenerated with `tsc -p tsconfig.build.json` (diff = the addition only).

  **Check:** all green in the worktree — `test:server` 3614 pass / 0 fail (after `build:docs`; the first run's 27 serve/route failures were the fresh-worktree mode, gone once docs were built), `lint:server` + `lint` (biome, own paths only), `typecheck` (it caught two wrong pins in my type tests — fixed), `check:contract`, `check:corpus`, `build:docs`, `check:links` 775/775, `test:src` 520 pass / 0 fail, `check:size` (minimal entry 9131 B, unchanged — the type erases). No Playwright run: no example source or emission changed (client/server goldens and snapshots green inside test:server). Doubts for the review pass:
  1. A role-classed REQUIRED ref that matches nothing own-template still fails LTC026 (`firstSelectorNotFound`), whose fix copy ("adjust the selector") is wrong for that shape — the content is the parent's to vary, so the optional form is the content idiom (documented in HOST_PROFILE). If required-into-content should throw the authored reason at runtime instead, that is a small follow-up in `plan.ts`'s unmatched handling.
  2. The roles read is same-file only: a roles literal declared in another module reads as no roles, and LTC083 would fire on a subject that names such a role — the house can't-read-it posture (LTC076's imported item types), flagged here rather than widened.
  3. LTC083 carries no `related` range to the annotation (the IR keeps no AST nodes for it); the message names the declaration instead.
  4. `all()` appears in the code's rule statement but only `first()` declarations flow through the verification sites today; the wording anticipates the surface extending without a code change.
  5. The role-overload intersections sit in `FactoryContext` before `FirstElement`/`AllElements`, so they win resolution order for role selectors; the generated client types role calls too when it re-emits `defineComponent<Props>(…)`.
  **Review:** Changes requested (2026-10-08, owner-confirmed). The type, the roles read and the
  subject-compound rule stand; three findings inside the task's scope:
  1. **A required role reference compiles.** `first('.tab', 'reason')` types as the role's element
     but fails LTC026 today. A required reference whose subject names a declared role and matches
     nothing in the own template compiles like the optional `unmatched` ref, queried from the host,
     and throws the existing `MissingElementError` with the authored reason when the parent passes
     no such element (channel: runtime, the existing check; tier 3 Escalated, as for any required
     ref). Drop HOST_PROFILE's "write it optional". Pin both surfaces: required compiles and its
     client throws on absent content, optional stays silent.
  2. **An unreadable roles declaration gets its own message.** When `Children` or its roles
     argument is an imported name (or anything but an inline type literal or same-file alias), the
     roles read empty and LTC083 tells the author to declare a role they declared. Record the
     declaration as unreadable, and in that case LTC083's message says the roles must be an inline
     type literal or a same-file alias for the compiler to read them (LTC076's posture for imported
     item types). Pin it.
  3. **State the check's population.** HOST_PROFILE and the LTC083 row in
     `skills/le-truc/references/errors.md` say that LTC083 checks declared `const x = first(…)`
     references; inline `first()`/`all()` calls and `all()` declarations are not verified, so a
     reach-in through them is not caught (module-cem-list, LT-513).
  Accepted as is: no `related` range to the annotation, `all()` named in the copy ahead of the
  surface, and the role overloads' resolution order. The NOTES.md cem-list entry is ruled into LT-513.

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

### C2 — role writers

- [ ] LT-476: One writer per property — parent bindings on a child-written role property conflict (ADR 0048 s3; LTC084).
  **Area:** compiler
  **Needs:** LT-474, LT-477
  **Gates:** check:corpus, check:contract
  **Area:** compiler
  **Needs:** LT-474, LT-477
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

- [ ] LT-512: A composed child's `children` shape is not a clash for a reference into the owner's own region; hand-authored markup mirrors the render.
  **Area:** compiler
  **Needs:** LT-474, LT-478
  **Gates:** test:server, typecheck, check:corpus, check:contract, test:variants
  **Area:** compiler
  **Needs:** LT-474, LT-478
  **Filed (Architect, 2026-10-08; LT-478 review):** after LT-478, module-codeblock's
  `first('code')` compiles to
  `code:not(:is(module-scrollarea *):not(:is([data-children="module-codeblock"] *):not(…)))`,
  so hand-authored codeblock markup must carry scrollarea's `data-children` wrapper or the
  component loses enhancement (`module-codeblock.html`, `server/schema/fence.markdoc.ts` and
  `server/templates/fragments.ts` now do). Scrollarea's own markup is one `<div>` and can never
  match `code`. The exclusion comes from `composedEmitter`
  (`server/compiler/analysis/selectors.ts`): `mayMatchShape` answers true for every non-element
  shape, so scrollarea's `children` shape counts as a clash. At a compose site in this
  component's template, that shape stands for the content this component passes, which is its
  own markup: the template and region probe already count it, and `regionSafe` already checks
  the re-include.
  **Do:**
  1. In `composedEmitter`'s clash test, a composed child's `children` shape does not count as a
     clash. Its `element`, `any` and unregistered (`tag === null`) cases stay as they are, and
     so does `regionSafe`. module-codeblock's `first('code')` then ships as plain `code`, and its
     `copy`/`overlay` queries drop `module-scrollarea *` from their exclusions. Uniqueness is
     unchanged: the candidate must still verify over the template plus every compose site's
     content.
  2. Pin it: a parent reference into its own region inside a child whose own markup cannot match
     ships the authored selector, and one inside a child whose own markup can match keeps the
     region-aware exclusion. Both surfaces.
  3. **Docs.** HOST_PROFILE § Element references gains one sentence: hand-authored markup for a
     compiled component mirrors its server render, `data-children` markers and a composed
     child's wrapper elements included. The query no longer depends on the marker where no
     clash exists, but the child's own client may still depend on its wrapper (scrollarea
     observes its `<div>`). Keep LT-478's wrappers in the fixture, the fence schema and the
     fragment template.
  **Check:** the generated module-codeblock client queries `code` with no exclusion, and the
  `module-codeblock` component spec passes against the fixture with and without the
  `data-children` attribute on the wrapper (a temporary edit, not committed). Report every corpus
  query whose emitted form changes; each must be a dropped exclusion of a child that renders
  `{children}`, and nothing else.
  **Channel/tier:** none. A precision fix to emitted reference selectors; no new check.
