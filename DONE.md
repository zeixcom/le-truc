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
