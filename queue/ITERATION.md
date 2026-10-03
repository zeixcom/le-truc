# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for the `writer`'s changelog pass). Only the
Architect moves tasks between files; contributors annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-10-02): the corpus port and the pre-publish reshapes.** The
previous iteration (consolidate the compiler, then land the pre-publish reshapes: tracks A–D,
LT-227–LT-406) is landed and reviewed. The `writer` recorded it in `CHANGELOG.md
[Unreleased]` the same day and `DONE.md` was pruned. Its line-count record: `server/compiler/`
measured 75 modules / ~30.4k lines on 2026-10-02 (non-test `.ts`), against the 27.0k baseline of
2026-10-01. The net +3.4k is mostly the scoped-CSS track (`css-scope.ts`, the stylesheet parse)
and the materialized probe; the library swaps retired less than they added.

**Why now (Architect, 2026-10-02).** The first publish sits behind the P6 cleanup round, and P6
sits behind the corpus port (ruled 2026-09-19). The corpus port is three migrations
(LT-109–LT-111) gated on one design, LT-280, which has waited since 2026-09-21. So LT-280 is the
critical path, and it opens as soon as gate zero is green. Around it go the reshapes that must land before the
publish and are cheaper before the migrations add call sites: the IR leaves the contract
(LT-370, which also turns `check:contract` green again), diagnostics take their published
record (LT-371), root-is-host is enforced (LT-375), and each template expression carries its
reactivity class (LT-373). The last iteration's reviews left four silent miscompiles or drops
(LT-378, LT-387, LT-355, LT-391); a framework does not ship those, so they run here too.

**Rulings taken at planning (Architect, 2026-10-02).**
1. **The record shape before new producers.** LT-371 lands before any task that adds a
   diagnostic (LT-186, LT-353, LT-355, LT-374, LT-375), so every new producer is born with
   `location`. This is the previous iteration's rule (consolidation before the features that
   would grow call sites in it).
2. **Root-is-host before new `.tsx` sources.** LT-375 lands before LT-109–LT-111 and LT-390
   author or migrate a `.tsx` source, so no new fragment root has to be migrated twice.
3. **LT-373 before LT-387.** Both change the answer to "does this expression read a signal".
   Centralize first, then fix the alias and shadowing cases in the one place.
4. **LT-342 rides LT-280's session.** LT-280's design question 2 *is* LT-342 (the `.tsx` key
   spelling); one ruling answers both, and LT-342 is then implemented by whichever LT-280
   implementation task touches `surface.ts`.
5. **The corpus-port sweep is restated.** LT-111's "no `.ts` component files remain" predates
   ADR 0039, which keeps each `.ts` twin as a variant. The sweep's check is now: every example
   folder is served from a compiled surface, the twins remain as variants, and LT-014's
   trigger is discharged on that reading.
6. **Gate zero: green before anything else** (owner, 2026-10-02). Two gates are red at
   opening. `check:contract` fails because the toy IR literal in `scripts/contract-check.ts`
   predates LT-287/LT-288. `build:docs` fails the simulation gate on module-lazyload's canvas
   notices (NOTES.md, LT-397 session). LT-370 and LT-335 fix them, and they run first and in
   parallel, ahead of the design gates and every other task. Neither waits on a design: LT-370
   leaves everything in `contract.ts` except the IR as it is, and LT-335 already names its
   fallback. If draining the composed closure's work does not land quickly, take the
   origin-tag fallback the task allows rather than hold the iteration. A classification entry
   is not a fix (the baseline test rejects it). Gate zero closes when `typecheck`, the server
   suite, `check:contract`, `check:corpus`, `build:docs` and `check:links` are all green on one
   commit. Record the census and warning baseline on that commit: it is the iteration's opening
   measurement. **Closed 2026-10-02 on b795ff3e** (Architect re-ran every gate on the merge):
   `typecheck` clean; server suite 2830 pass / 5 skip / 0 fail; `check:contract` green;
   `check:corpus` exit 0; `build:docs` and `check:links` (693 links) green. **Opening
   measurement:** tier census 36 entries, 28 Folded / 8 Simulated / 0 Static; compile-warning
   baseline 0; translation census 0 gaps across 6 locales. `check:sim` green on all three
   runtimes (owner, Deno leg outside the sandbox).

**The chain.**
- **Gate zero — closed 2026-10-02 (b795ff3e).** ~~LT-335~~ (done ✓) and ~~LT-370~~ (reviewed ✓). Everything below is open.
- **Design gates** — Area `design`: the Architect with the owner; `do-task` never picks them.
  LT-280 (per-item effect channels; owner grilling → ADR 0024 s5 / ADR 0032 amendments →
  implementation tasks written into this file). LT-342 (ruled with LT-280). LT-334 (lazyload's
  boundary; its implementation task pairs with LT-390). LT-409 (the shadow-root departures
  session; re-scopes LT-405/LT-407/LT-408).
- **A — pre-publish reshapes** — the published diagnostic record, root-is-host and the
  reactivity class, before new producers and new `.tsx` sources. ~~LT-371~~ (reviewed ✓, in DONE.md) → LT-375 → LT-373 →
  LT-387. (LT-370 is done. LT-375 and LT-373 each need only LT-371 and may run in parallel.)
- **B — correctness** — the last iteration's silent miscompiles and drops. LT-378, LT-391,
  LT-392, LT-356, then LT-353 and LT-355 (both need LT-371), then LT-417 (after LT-375).
- **C — corpus port** — every example folder served compiled (ruling 5). LT-374, LT-186 (both
  need LT-371) → LT-280's implementation tasks (written in when its design rules) → LT-109,
  LT-110, LT-111 (each needs LT-280, LT-375, LT-374 and LT-186) → LT-390 (needs LT-375, LT-334
  and LT-385). LT-110 is LT-165 step 7's corpus pin.
- **D — CSS departures** — re-scoped (or struck) by LT-409 first. LT-405, LT-407, LT-408 (each
  needs LT-409).
- **Parallel slot** — independent work. LT-415 first (test servers on a free port; the do-task gates trip on a stray server on 3000), then LT-305 (the Baseline 2023 guard, ships in 3.0), LT-277
  (server), LT-393 (comment-only sweep), LT-410 (the `errors.md` rows).

**Deliberately not here.** LT-254, LT-257's build half, LT-259–LT-261 stay behind P6 (ruled
2026-09-19), and with them the D-32 (public entry points) and D-28 (`Try` in template targets)
design sessions. LT-381 changes the census and the warning baseline by design and needs the
owner's sign-off first. LT-246 waits for LT-109–LT-111 to settle the census. LT-363, LT-369,
LT-372 (after LT-371, post-publish-safe) and the P3/P4/P6 items stay in the backlog. LT-310 and
LT-311 are design work and wait for P6.

**Exit criterion.** Tier census and warning baseline unchanged from the iteration's opening
measurement (recorded on the gate-zero commit, ruling 6), except where LT-109–LT-111, LT-390 or an
LT-280/LT-409 ruling change them by design, as those tasks state; the warning baseline stays 0.
The mechanical tasks (LT-370, LT-371, LT-373, LT-375's migration half, LT-393) leave goldens
and parity byte-identical. Every example folder is served compiled, per ruling 5. ADRs record
LT-280's and LT-409's rulings. The IR is out of `contract.ts`, every diagnostic carries
`location` on both surfaces, and a fragment root fails LTC060. No silent miscompile from the
last iteration's reviews remains open (LT-378, LT-387, LT-355, LT-391). `check:contract`,
`bun run build:docs` and `check:links` pass. The net line count of `server/compiler/` is
recorded against the 30.4k opening measurement.

**Next free task ID: LT-420.** Next free diagnostic code: LTC072 (LTC071 is LT-399's; LTC070 is LT-304's; LTC066–LTC069 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are LT-274's; LTC061 is LT-383's; LTC056 is LT-358's; LTC057/LTC058 are LT-257's; LTC059 is LT-374's; LTC060 is LT-375's).

---

### Gate zero (closed 2026-10-02, b795ff3e)

<!-- entries -->
