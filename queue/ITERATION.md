# TODO

Current iteration only. The queue is a per-task store (`queue/LT-NNN.md`, one file per task;
`BACKLOG.md`, `TODO.md` and `DONE.md` are views built by `bun run queue:build`). New tasks are
created in `queue/` with a `band:`; the Architect moves them by editing `status:` and the chain
in this file; contributors claim and annotate only through `bun run scripts/queue.ts`. Task IDs
are unique by construction — the filename is the ID; the "Next free task ID" line below
allocates the next one.

**Iteration opened 2026-10-10: the two-repo split and template emission.** The previous
iteration ("the first package and the P6 remainder", opened 2026-10-09) closed on 2026-10-10:
all 18 entries reviewed and integrated, both design gates ruled (LT-516 → ADR 0043 amended;
LT-484 → full parity, LT-530 filed; LT-523 → ADR 0049), the `writer` recorded it in
`CHANGELOG.md [Unreleased]`, and the entries are pruned (`queue/LEDGER.md`, ninth pass).

**Why now (Architect, 2026-10-10).** The package stands (`@zeix/le-truc-compiler`, LT-254) but
still compiles from this repo's own sources, and template emission — v3.0's other requirement
(M27) — has its ruled interface (ADR 0043 as amended) and no emitter. ADR 0049 directs the
split first ("the third front end is born in its final home"), so the iteration opens with the
split chain and builds the emitter in the new repository. This repo keeps the corpus healthy
ahead of the pioneers: the accessibility gate and two examples riders.

**Rulings taken at planning (Architect with the owner, 2026-10-10).**
1. **Scope: the two-repo spine plus corpus riders.** S — the split: LT-524 → LT-525 → LT-526.
   E — emission, new repo: LT-527 → LT-528 → LT-529 (all `needs: LT-524`). P — parity, new
   repo: LT-530 (`needs: LT-524`). G — the accessibility gate: LT-508 (`needs: LT-525`).
   R — riders: LT-511, LT-513 (beside everything).
2. **Prerequisite owner act before LT-524:** publish `@zeix/le-truc@3.0.0-next.1` to the
   registry (LT-523's ruling) — the new repository types its peer against it and proves
   `check:package` from there.
3. **No compiler-source front window.** LT-524 mirrors the tree on a quiet checkout; no task
   touches `server/compiler/`, `server/tests/compiler/` or `server/runtimes/` in this repo
   after the mirror lands (work there diverges and is lost at LT-525). At cutover (LT-525's
   review), compiler-internals tasks are re-pointed — the setup-const cluster
   LT-459 → LT-333 → LT-458, LT-363, LT-369, LT-497 and the corpus-gate follow-ons
   LT-506/LT-509/LT-510 — internals to the new repository's tracker (ADR 0049 s7),
   corpus-level gates stay here consuming the linked package.
4. **The emission chain builds only in the new repository** (ADR 0049 sequencing, LT-516's
   split). LT-527 owns LTC057/LTC058/LTC090; the boundary fixture lands with it (no corpus
   component uses `Try` yet).
5. **LT-508 re-scoped at planning to consumer-side placement:** `CORPUS_RENDER_ARGS` lives
   under `server/tests/` here, never the mirrored `server/tests/compiler/`, and the gate runs
   post-cutover so its first green run doubles as an adoption proof (the entry carries the
   note).
6. **LT-259, LT-260 and LT-261 stay out (owner, carried):** the codemod's drift-cost metric
   is unruled, the pioneers are external engagements timed by the owner, and pioneer 2 needs
   LT-529 regardless.
7. **Standing rulings carried from the 2026-10-06/-09 plannings:** acceptance criteria are
   goals, not constraints to satisfy by workaround (a contributor who can meet one only by
   bending the design annotates `blocked` and writes the impasse into `NOTES.md`); an
   `examples` task that edits a compiled source gates `test:server` and `typecheck`; the
   corpus-level checks stay standalone, never part of the compile step or `bun test`.

**The chain.**
- **S — the split** — P1; ADR 0049; this repo and the new one. LT-524 (bootstrap: fresh
  history, the moved tree, mirrored fixture corpus, registry-typed peer, its own gates, public
  from the first push) → LT-525 (cutover: consume `@zeix/le-truc-compiler`, delete the
  in-tree compiler, re-point the docs build; goldens re-pin the harness import once, by
  design) → LT-526 (publish and CI hardening: branch protection with required checks on both
  repositories, the compiler's first pre-release — owner act, CHANGELOG entries).
- **E — template emission** — P1; the new repository; `needs: LT-524`; ADR 0043 as amended.
  LT-527 (the shared walk, operation layer, census routing, the boundary fixture, and the
  test-only second target; LTC057/LTC058/LTC090) → LT-528 (the Twig target: syntax table,
  exhaustive escaping map, one partial per component × locale, byte-equivalence on the real
  engine) → LT-529 (the PHP CI job; coordinates with LT-526 if still open).
- **P — boundary-arm parity** — P2b; the new repository; `needs: LT-524`; LT-484's ruling.
  LT-530 (factor the conditional arm-content planner, thread it through
  `handleAsyncBoundary`, retire `boundaryDeepConstructOf` and four refusal faces). Parallel to
  E — it touches `analysis/effects.ts`, the emission chain adds new code.
- **G — the accessibility gate** — needs LT-525 (post-cutover, consumer-side). LT-508
  (`check:html`: html-validate + axe-core over every corpus component's server render, the
  seeded allowlist triaged at review into corpus follow-ups).
- **R — examples riders** — beside everything; this repo only. LT-511 (delete the 22 orphaned
  hand-written sheets no twin serves), LT-513 (module-cem-list addresses its passed content
  through declared roles).

**Deliberately not here.** LT-259, LT-260, LT-261 (ruling 6). The setup-const cluster,
LT-363, LT-369, LT-497, LT-506, LT-509 and LT-510 (ruling 3 — re-pointed at cutover, not
now). LT-381 (changes the census by design; owner sign-off when it enters). The design gates
LT-310, LT-448, LT-450, LT-456 and LT-515 (need-gated, owner-timed). P2–P5 stay where they
are.

**Exit criterion.** Every chain task is reviewed and integrated. Both repositories are real
and green: `zeixcom/le-truc-compiler` is public with typecheck, suite, contract, package,
peer and lint as required checks (ADR 0049 s7); le-truc consumes the compiler through `link:`
in development and the pinned pre-release in CI, with no `server/compiler/` directory left.
This repo's tier census (36/7/0), translation census (0 gaps) and compile-warning baseline
(1 unique standing warning, module-dialog's LTC088) are unchanged from the opening
measurement below, except where a task states a by-design change. In the new repository, the
dump target's renders are byte-identical to SSG for every emittable fixture × locale, and the
Twig equivalence corpus passes on the real engine. `check:html` is seeded and green in this
repo. On this repo's closing commit: `typecheck`, `test:server`, `check:contract`,
`check:corpus`, `test:variants`, `build:docs` and `check:links` are green.

**Opening measurement (d7bcb68a):** `check:corpus` exits 0. The tier census has 43 entries:
36 Folded, 7 Simulated, 0 Static. The compile-warning baseline is 1 unique standing warning,
module-dialog's `body.scroll-lock` (LTC088), ruling-7-excepted (the css-probe LTC088 is a
test-fixture warning, present at HEAD and uncounted — LT-519's review). The translation
census has 0 gaps across 6 locales. `server/compiler/` has 87 modules and 43.5k lines (every
`.ts` file except `*.test.ts`) — the last opening measurement of the in-tree compiler. All
seven gates green at this commit (closing verification of the previous iteration:
`test:server` 3743/0, `test:variants` 537, `check:links` 804).

**Next free task ID: LT-531.** Next free diagnostic code: LTC091 (LTC090 is LT-527's; LTC086, LTC089 are reserved for LT-501 and LTC087, LTC088 for LT-502; LTC070 is retired by LT-501; LTC083–LTC085 are reserved for LT-474, LT-476 and LT-477; LTC082 was reserved for LT-136
and is released unused; LTC081 is reserved for LT-461; LTC080 is
LT-453's; LTC079 is LT-447's, unused; LTC078 is LT-444's; LTC077 is LT-443's; LTC076 is LT-429's;
LTC075 is LT-355's; LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's; LTC071 is
LT-399's; LTC066–LTC070 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are
LT-274's; LTC061 is LT-383's; LTC060 is LT-375's; LTC059 is LT-374's; LTC057/LTC058 are LT-527's
(LT-257's before the split);
LTC056 is LT-358's).

---

<!-- entries -->
