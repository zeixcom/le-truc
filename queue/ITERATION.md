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
- **C2 — role writers** — beside track C (ruling 16). LT-476.
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

**Next free task ID: LT-512.** Next free diagnostic code: LTC090 (LTC090 was reserved for LT-506 and is released unused; LTC086, LTC089 are reserved for LT-501 and LTC087, LTC088 for LT-502; LTC070 is retired by LT-501; LTC083–LTC085 are reserved for LT-474, LT-476 and LT-477; LTC082 was reserved for LT-136
and is released unused; LTC081 is reserved for LT-461; LTC080 is
LT-453's; LTC079 is LT-447's, unused; LTC078 is LT-444's; LTC077 is LT-443's; LTC076 is LT-429's;
LTC075 is LT-355's; LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's; LTC071 is
LT-399's; LTC066–LTC070 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are
LT-274's; LTC061 is LT-383's; LTC060 is LT-375's; LTC059 is LT-374's; LTC057/LTC058 are LT-257's;
LTC056 is LT-358's).

---

<!-- entries -->
