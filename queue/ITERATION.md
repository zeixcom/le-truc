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
