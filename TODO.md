# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-18): the three S0 framework-goal grilling sessions — and
nothing else.** Two are closed: **LT-240** (i18n message model → ICU MessageFormat 1; ADR 0030,
M24) and **LT-241** (framework goal + packaging track → [ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md),
REQUIREMENTS §1/M27/M28, BACKLOG's new P1 band). **LT-239 is the last one**, and LT-241 narrowed
it: ADR 0034 s5 makes jsdom an optional peer dependency, so the Simulated tier is already opt-in
per consumer — the session decides substrate pluggability and whether the tier survives, not
whether every downstream build must carry it. Each is an architect session with the owner; the deliverable of each is a
decision plus an ADR amendment (via `adr-keeper`), and the rulings gate the backlog bands
beneath them (see BACKLOG.md's strategic framing).

**Next free task ID: LT-263.**

---

## S0 — Framework-goal strategic rulings

**Provenance:** the owner's framework statement plus [COMPILER_REFLECTION.md](COMPILER_REFLECTION.md)
(2026-09-18). The reflection's three "paying for something not yet banked" verdicts and its
"find the second consumer" recommendation become owner-gated rulings here. **These three gate the
bands below; everything else interleaves.** Each is an architect grilling session with the owner —
the decision, not the implementation, is the deliverable — recorded via `adr-keeper`.

- [ ] LT-239: Grill the Simulated tier against the framework goal — capability, coupling, distribution (ADR 0027/0029; M19/M20).
  **Skill:** architect
  **Context:** The reflection's §1 — the single biggest lever in the system. Against the tier stand:
  `sim/` (1,687 lines), jsdom + `@types/jsdom` as build deps, the fixed-point gate, the suppression
  pass, the CI equivalence audit (~4 s/run), `check:sim`/`eval:substrate`/`sim-portability-check`;
  for it stand exactly two corpus components (`form-combobox` via compose-read, `form-listbox`;
  census 20/2/0). **The reflection framed this as an internal-cost question; the framework premise
  changes the criteria**, and two REQUIREMENTS facts must sit on the table: M20 (Server Simulation
  realm) is a **Must-Have**, so retiring the tier is a requirements amendment, not a cleanup; and
  the no-JS question ("what does a reactive initial value render before JavaScript loads?",
  REQUIREMENTS §1) is plausibly the framework's differentiator for the CMS targets — a listbox that
  ships its options' initial state is a better no-JS page in every user project, not just here.
  **The question to grill is therefore capability vs coupling, not existence vs deletion:**
  (a) keep as-is, rationale recorded in ADR 0029; (b) keep the capability, cut the coupling —
  realm substrate pluggable (happy-dom/linkedom spike, the reflection's §5 row), Simulated opt-in
  per consumer project, the CI equivalence audit staying repo-side; (c) retire the tier and route
  the two components Static — amends M19/M20 and accepts the no-JS ceiling. Affects what jsdom
  costs every downstream build; the `sim-portability-check.ts` script exists and says something
  about how load-bearing the coupling already is.
  **Deliverable:** owner decision; ADR 0029 amendment (and M19/M20 amendment if the shape changes)
  via `adr-keeper`; if (b), the portability spike as an implementation task. **Gates:** the
  tier/evaluability-adjacent wave-3 items hold for this ruling (the front-end swaps proceed
  regardless); LT-188 (BACKLOG P3) runs only if the tier survives.
  **Check:** the reflection's falsifiable framing — "what is materially worse if the tier is
  deleted and form-combobox/form-listbox route Static?" — is answered in the ADR either way, so
  the next reviewer does not re-open it.
