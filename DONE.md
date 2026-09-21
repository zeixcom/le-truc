# DONE

Done-and-reviewed tasks since the last release, compacted per the 3-file mini-kanban (owner,
2026-09-18). Each entry keeps only what is still load-bearing: rulings recorded nowhere else,
live handoffs into open tasks (referenced by LT-ID), and the changed-artifact facts Changelog
Keeper needs at release planning. Verification transcripts, changed-file line inventories and
review narratives are dropped — the full record stays in `git log -p`. Entries still carrying
`— done, pending review ⏳` are finished but not yet reviewed; their review pass happens in a
future iteration. At release planning Changelog Keeper consumes this file alongside
`CHANGELOG.md [Unreleased]`; the Architect then prunes entries whose context no live task needs.

---

Pruned empty 2026-09-21 (Changelog Keeper, after the 2026-09-21 iteration opened): the
2026-09-18/21 entries — LT-239/240/241, LT-263, LT-265/267, LT-255/256, LT-271/272 and the
closed P0–P7 bands — are consumed. The integrator-visible facts are in
`CHANGELOG.md [Unreleased]` (jsdom optional peer + absent-substrate routing, the two-prefix
`LTC`/`TSRX` skill vocabulary); the rulings live in `adr/0027`–`adr/0037`,
`server/compiler/VOCABULARY_LEDGER.md` and `LE_TRUC_COMPILER.md` §2; and every live handoff is
restated in the owning `TODO.md`/`BACKLOG.md` entry (LT-254's `runtimeImport` default flip,
LT-257's emitter-interface rescope, LT-273's validation + channel ruling, LT-277's glob edges,
LT-278's ADR duty, LT-279's SERVER.md/TESTS.md re-pin). Full entry text: `git log -p -- DONE.md`.

**Standing note for compiler-adjacent tasks:** a compiler crash during a corpus build makes
`typecheck`'s `&&`-chained `tsc` silently skip — check the exit code, never grep for
"error TS" (LT-226 review).

---

Pruned again 2026-09-21 (Architect, owner direction: `CHANGELOG.md [Unreleased]` carries
everything public-facing, so keep only what a future task still needs): **LT-273** (the
consumer-facing behavior is the CHANGELOG entry; the provenance-header disposition lives in
`VOCABULARY_LEDGER.md` §6; the design in [ADR 0036](adr/0036-corpus-configuration-surface.md)),
**LT-278** ([ADR 0038](adr/0038-runtime-neutral-build-path.md) is the record),
**LT-279** (`server/SERVER.md` and `server/TESTS.md` carry it), and **LT-178** (the
retirement ruling is verbatim in AGENTS.md's `pass()` bullet and the CHANGELOG Removed
entry; its OPEN Tech Writer copy rider moved to LT-189 item 11). Full entry text:
`git log -p -- DONE.md`.

- [x] LT-266: Measure the size bet — emitted bytes for the same component authored in Le Truc and in React — reviewed ✓
  **Ruling (recorded nowhere else):** the bet holds, and the margin is the **runtime, not
  the payload** — 8.72 vs 64.38 kB gzip runtime, while the payload line (3.07 vs 8.54)
  favours React and never flips. **Any connector claim quotes BOTH lines** (totals
  18.61/16.53 gzip/brotli vs React 19.3's 68.62/59.21; run of record in
  `spike/size-bet/FINDING.md`). This is the REQUIREMENTS §1 acceptance number for any
  future hydration-blob proposal.

- [x] LT-179: Remove the explicit factory return contract and `forEachUnseen` (ADR 0018 v3.0 milestone) — reviewed ✓
  **Trap (recorded nowhere else):** one `src/tests/reactive.test.ts` assertion is worded
  to pass under either the pre- or post-LT-178 spelling — a leftover of a parallel
  session's in-flight `swapSlots` edit reverted so the branch landed pure. Tightening it
  is free once the LT-178 copy rider (LT-189 item 11) settles the final wording.
