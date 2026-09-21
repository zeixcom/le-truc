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

- [x] LT-273: Validate `le-truc.config.json`, and retire the last hard-coded corpus glob — reviewed ✓
  **Skill:** le-truc-dev
  **Review:** Approved 2026-09-21. Gates re-run live on the committed rev: server suite
  1691/1691 across 91 files, `tsc -p tsconfig.build.json` clean, census 22 = 20 folded /
  2 simulated / 0 static with warning baseline 0, `check:portability` 3/3 byte-identical,
  `i18n:sync` compiles both surfaces (22 components) off the configured scan, live probe of
  the mis-cased key through `loadCorpusConfig` returns the did-you-mean message verbatim.
  **Ruling (recorded nowhere else):** the grep acceptance is reworded — `examples/**` hits
  now admit the pin test and doc prose; the binding form is **no runnable scan code outside
  `corpus-config.ts`'s defaults**.
  **Changed:** `resolveCorpusConfig` validates untrusted config JSON before any path math —
  unknown keys rejected naming the accepted keys (did-you-mean on casing), string-where-array
  reported with the array spelling, indexed entry errors (`"sources[1]"`), non-empty string
  fields, non-object rejected; thrown startup errors, **channel: none, no LTC code** (as
  ruled in the task entry; ADR 0028-untiered, ADR 0036 s3). `findConfigFile` stops at the
  nearest `package.json`/`.git`; a config in the boundary directory itself still applies
  (config checked before the marker). `scripts/i18n-sync.ts` runs the configured scan —
  sources, `outDir` for the registry, `i18nDir` for catalogs/manifest — and the two test-side
  single-extension loaders (corpus-fixture `loadCorpus()`, server-render-smoke `corpus()`)
  folded onto `collectCorpusSources` (the grep acceptance surfaced both; "i18n:sync was the
  last place" was off by two). Vocabulary "TSRX compilation/compiler" → "Corpus …" with
  dispositions in VOCABULARY_LEDGER.md §6 — including the **kept** generated provenance
  header (baked into goldens; rename with the next deliberate emission change, not a
  vocabulary sweep). Validation + boundary documented in LE_TRUC_COMPILER.md §7.1. Review
  rider: `server/TESTS.md` count re-pinned 1683 → 1691 (the eight new tests).
  **Changelog:** consumer-facing behavior change to the unpublished config surface —
  malformed `le-truc.config.json` now fails fast instead of silently defaulting.

- [x] LT-278: Record the runtime-neutral build path as an ADR (LT-267 review) — done ✓
  **Skill:** adr-keeper
  **Changed:** [ADR 0038](adr/0038-runtime-neutral-build-path.md) — standalone, beside
  ADR 0034 rather than a sub-design of it (0034's sub-designs govern what the package is and
  emits; this governs how the build path executes and binds the in-repo docs build today):
  the `RuntimeIO` seam; the compiler staying pure beside it; glob semantics as **one
  grammar decided once**, pinned to `Bun.Glob`'s scanner, with the three LT-277 edges
  recorded as pending rulings owned by LT-277; `check:portability` (Bun/Node/Deno,
  byte-identical emitted trees) as the standing gate. adr-index row added; ADR 0034 s1 and
  ADR 0036 s5 cross-linked. `check:links` clean. Recorded before the compiler package's
  first publication (P1, P6-gated), as required.

- [x] LT-279: Document the absent-substrate routing (LT-256 review docs gap) — done ✓
  **Skill:** tech-writer
  **Changed:** `server/SERVER.md`'s simulation section states the absent-substrate routing —
  no jsdom: one-shot build routes Simulated-tier components Static, appends an
  `unavailable-substrate` routing signal, rewrites `generated/registry.json` so the tier
  census reports the outcome, stays green; substrate present but broken fails the build
  naming the real cause; registry.json reflects the **last one-shot build's** routing
  outcome. The `resolve.ts` bullet gains the `isSubstrateAbsence` narrowing.
  `server/TESTS.md` re-pinned and the `contract.test.ts` / `simulation-resolve.test.ts` rows
  added (count since moved to 1691 by LT-273 — see its entry). `check:links` clean.
