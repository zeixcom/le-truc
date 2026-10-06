# TODO

Current iteration only. The queue is a per-task store (`queue/LT-NNN.md`, one file per task;
`BACKLOG.md`, `TODO.md` and `DONE.md` are views built by `bun run queue:build`). New tasks are
created in `queue/` with a `band:`; the Architect moves them by editing `status:` and the chain
in this file; contributors claim and annotate only through `bun run scripts/queue.ts`. Task IDs
are unique by construction — the filename is the ID; the "Next free task ID" line below
allocates the next one.

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

**Re-plan (Architect, 2026-10-04).** The process restructuring (LT-418–LT-421: single-agent
roles, task branches committed in the worktree, integration in the review pass) is done, and
so is all of track A: LT-371 and LT-373 are pruned (`queue/LEDGER.md`), and LT-375 and LT-387 are
reviewed. Rulings 1–3 are therefore discharged: every remaining diagnostic producer is born
with `location`, root-is-host is enforced, and the reactivity class is central. LT-378,
LT-393 and LT-410 are pruned too, and LT-391 is reviewed. What is left splits cleanly. About ten mechanical tasks are all
pickable now, and the three migrations plus LT-390 sit behind three design sessions that
have not run. LT-280 has waited since 2026-09-21. The iteration's exit therefore turns on
the owner's calendar, not on contributor throughput. The sessions are scheduled in this order:
7. **Design sessions in critical-path order.** LT-280 with LT-342 first: it gates LT-109–LT-111,
   and its implementation tasks join track C. LT-334 next. LT-276 is pruned, so it is unblocked
   now, and it gates LT-390. LT-409 last: track D is the only thing it gates, and nothing else
   waits on track D.
8. **Corpus-port prerequisites before the correctness track.** LT-374 and LT-186 move ahead of
   track B. When LT-280 rules, the migrations then wait only on LT-280's own implementation
   tasks. Track B still lands in full this iteration, so the reorder only changes what lands first.
9. **LT-415 first.** Every task gate under the worktree flow runs a test server. A stray server
   on 3000 makes `test:variants` refuse and lets Playwright test another checkout's build without
   any error. Fix it before the run of ten.
10. **Acceptance criteria are goals, not constraints to satisfy by workaround** (owner,
    2026-10-04). For the LT-280 implementation chain and the migrations: byte-identical CSS
    across a variant set, the warning baseline 0, unchanged Playwright specs and unchanged
    goldens are the target. A contributor who can meet one only through a workaround that
    bends the design stops, annotates `blocked` and writes the impasse into `NOTES.md`. The
    hand-written twins may carry latent bugs. A spec or golden that encodes one is reported
    with the evidence and ruled by the Architect (fix the twin, or change the expectation);
    it is never matched silently.
11. **LT-280 ruled (2026-10-04) → ADR 0046.** The chain's implementation tasks are LT-422–LT-429.
    LT-425 waited on Cause & Effect 1.6.0 (handoff `CAUSE_EFFECT_LIST_MAP.md`); 1.6.0 shipped and
    the dependency moved to `^1.6.0` on 2026-10-05, so LT-425 is open again. LT-355 moves from track B into
    track C after LT-423, which makes its composed child renderable; LT-355 keeps the locale half.

**Next batch (Architect, 2026-10-05).** LT-423, LT-425 and LT-434 are reviewed and integrated
(460fd94e and the merges before it), and so is every task in tracks 0, A and B except LT-412.
Track C's critical path is now LT-424 → LT-355 → LT-426, all on the compiler's list and arm
emission, so they run one at a time. Two runtime tasks run beside them in `src/`: LT-412 (the
Cause & Effect 1.6.1 bump, unblocked by LT-425) and LT-436. LT-429's design is unblocked
(LT-423 landed) and is the owner's next session: LT-109 and LT-110 wait on it and on LT-426,
so ruling it while LT-424–LT-426 land keeps the migrations off the critical path.
12. **LT-436 ruled: a throwing Mount Scope is Contained per scope** (ADR 0028 s3 extended one
    level down; runtime, tier 2). `reconcile()` reports it once through `reportEffectFailure`,
    leaves the element in place unbound, and continues. The task entry carries the detail.
13. **The landed tasks are not pruned yet.** Pruning waits for the `writer`'s changelog pass
    at iteration close (hard rule); the reviewed entries stay in `DONE.md` until then.
14. **LT-429 ruled (owner, 2026-10-05).** List-item field parsers are inferred from a same-file
    item type and declared otherwise with `harvest(items, { field: parser })` (ADR 0046 s7). A
    compile-time marker is an import from `@zeix/le-truc-compiler/macros`, never an ambient
    (ADR 0034 s1): LT-442 builds the subpath and moves `css` onto it. `asInteger` is not an
    inferable parser: LT-440 maps `number` → `asNumber`. An unresolvable scalar seed type is
    refused unless `harvest(value, parser)` declares it: LT-443 (S3).
15. **LT-334 ruled (owner + Architect, 2026-10-06).** The boundary migration is LT-449
    (pickable now): per-arm duplicated callout with `.danger` authored per arm (the
    arms-span-parents machinery extension rejected), the ok arm a reactive `truc:html`
    thunk, stale dimming as the `isPending` idiom, and the scroll side effect as a
    beside-watch — a sanctioned escape hatch — with a required ordering probe. The
    `allow-scripts` question is decoupled to LT-448 (design): the goal is partials bringing
    *new* components to the page, build-unknown, same-origin or CSP-approved origins, with
    code-splitting required. The decoupling is one-directional — nothing in the lazyload
    track waits on LT-448: LT-449 is pickable now and complete on its own terms, and
    LT-448's session writes the follow-up that revives `shake-hands` (inert → alive per the
    ruled design), absorbing the three re-scoped script-execution spec legs and
    `mocks/module-with-type.html`. LT-390 is re-pointed at LT-449.
16. **LT-110 unblocked (owner + Architect, 2026-10-06).** The blocked session found two
    compiler gaps in the ticker's ruled shape. (a) **List templates hoist to the host's end**
    (ADR 0046 s2 amended → LT-454): one copy per instance, queried from the host, so a
    container may be a scope root (`<tbody>`). Arm templates stay beside their arm, because
    the arm form anchors on them. Comment anchors were rejected for minifier robustness, and
    computed positions for fragility. (b) **A list reached only through `byKey` harvests
    from its alias sites, witnessed by the render** (ADR 0047 → LT-453). Rejected: a JSON
    root-attribute seed (the data ships twice) and a client-side-rendering escape hatch (it
    contradicts enhance-not-generate). Too-large datasets go to LT-450 (design, P7: HTML
    partials on demand). Found on the way: LT-451 (silent miscompiles of a signal
    initializer over a Parser-backed host prop) and LT-452 (the canceller globals). The
    ticker's "LT-165 step 7 corpus pin" clause is withdrawn: `Math.random()` reaches no
    rendered site there, so the pin stays synthetic in `suppression.test.ts`.

**The chain.**
- **Gate zero — closed 2026-10-02 (b795ff3e).** ~~LT-335~~ (done ✓) and ~~LT-370~~ (reviewed ✓).
- **A — pre-publish reshapes — landed.** ~~LT-371~~, ~~LT-373~~ (pruned), ~~LT-375~~,
  ~~LT-387~~ (reviewed ✓).
- **Design gates** — Area `design`: the Architect with the owner; `start-task` never picks them.
  ~~LT-280~~ + ~~LT-342~~ (ruled 2026-10-04 → ADR 0046). ~~LT-429~~ (ruled 2026-10-05 → ADR 0046
  s7, ADR 0034 s1; ruling 14). ~~LT-334~~ (ruled 2026-10-06 → LT-449; `allow-scripts`
  decoupled to LT-448; ruling 15). **Next owner sessions:** LT-448 (partials that bring new
  components; its session writes the shake-hands revival follow-up — the lazyload track
  does not wait on it), LT-409 (the shadow-root departures; re-scopes LT-405/LT-407/LT-408).
- **0 — test hygiene** (ruling 9). ~~LT-415~~ (reviewed ✓). ~~LT-441~~ (reviewed ✓).
- **C — corpus port** — every example folder served compiled (ruling 5), through ADR 0046
  (ruling 11). ~~LT-374, LT-186, LT-427, LT-428, LT-422 → LT-423 → LT-425~~ (reviewed ✓) →
  ~~LT-424~~ (reviewed ✓) → ~~LT-355~~ (reviewed ✓) → ~~LT-426~~ (reviewed ✓) → ~~LT-429~~ (reviewed ✓) → ~~LT-111~~ (reviewed ✓, integrated 2026-10-05) → ~~LT-109~~ (reviewed ✓) → ~~LT-449~~ (reviewed ✓) → **next, critical path (compiler list emission, one at a time):** ~~LT-454~~ (reviewed ✓) → ~~LT-453~~ (reviewed ✓) → ~~LT-110~~ (done ✓) → LT-446 (section-menu, design — the sweep's last folder). **Beside it (example folders only, pickable now):** ~~LT-445~~ (reviewed ✓), ~~LT-390~~ (done ✓).
- **B — correctness** — the last iteration's silent miscompiles and drops. ~~LT-378~~,
  ~~LT-391~~ landed. ~~LT-392, LT-356, LT-353, LT-417, LT-430, LT-431, LT-432~~ (reviewed ✓). ~~LT-412~~ (reviewed ✓). ~~LT-439~~ (reviewed ✓). ~~LT-440~~ (reviewed ✓). ~~LT-442~~ (reviewed ✓). ~~LT-444~~ (reviewed ✓). ~~LT-443~~ (reviewed ✓). ~~LT-452~~ (done ✓). ~~LT-451~~ (reviewed ✓). ~~LT-447~~ (reviewed ✓ — the shape is supported and the declaration already rides both modules; the filed failure was a stale generated module, ruling on the task file; no LTC079). ~~LT-455~~ (reviewed ✓ — a nested list in a server branch of an item now mounts under a guard on its container; the construct residue ruled refuse-not-guard). **Next:** LT-468 (refuse a client construct in a server-rendered branch of an item, filed from LT-455's review — the item walk was the only scope that both descended and emitted there).
- **D — CSS departures** — re-scoped (or struck) by LT-409 first. LT-405, LT-407, LT-408 (each
  needs LT-409).
- **Parallel slot** — independent work. ~~LT-420, LT-418, LT-419, LT-421, LT-305, LT-277,
  LT-433~~ (done ✓). ~~LT-411~~ (reviewed ✓), ~~LT-416~~ (reviewed ✓), ~~LT-414~~
  (reviewed ✓), ~~LT-187, LT-434, LT-435~~ (reviewed ✓). ~~LT-436~~ (reviewed ✓). ~~LT-438~~ (reviewed ✓).

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
LT-280's (ADR 0046) and LT-409's rulings. The IR is out of `contract.ts`, every diagnostic carries
`location` on both surfaces, and a fragment root fails LTC060. No silent miscompile from the
last iteration's reviews remains open (LT-378, LT-387, LT-355, LT-391). `check:contract`,
`bun run build:docs` and `check:links` pass. The net line count of `server/compiler/` is
recorded against the 30.4k opening measurement.

**Next free task ID: LT-468.** Next free diagnostic code: LTC082 (LTC081 is reserved for LT-461; LTC080 is LT-453's; LTC079 is LT-447's, unused — its shape is supported, not refused; LTC078 is LT-444's, used; LTC077 is LT-443's; LTC076 is LT-429's, used; LTC075 is LT-355's; LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's, used; LTC071 is LT-399's; LTC070 is LT-304's; LTC066–LTC069 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are LT-274's; LTC061 is LT-383's; LTC056 is LT-358's; LTC057/LTC058 are LT-257's; LTC059 is LT-374's; LTC060 is LT-375's).

---

### Gate zero (closed 2026-10-02, b795ff3e)

<!-- entries -->
