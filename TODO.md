# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-18): the three S0 framework-goal grilling sessions — and
nothing else.** Each is an architect session with the owner; the deliverable of each is a
decision plus an ADR amendment (via `adr-keeper`), and the rulings gate the backlog bands
beneath them (see BACKLOG.md's strategic framing).

**Next free task ID: LT-254.**

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

- [ ] LT-241: Declare the general-purpose framework goal in REQUIREMENTS and schedule the packaging track (the second-consumer milestone).
  **Skill:** architect
  **Context:** The reflection's §1 ratio test and §7's non-compiler item, made concrete by the
  owner's premise. The ambition is now stated — thousands of projects via the OSS library — but
  **every v3 success criterion is repo-internal** ("the example corpus is 100% compiled", "the
  warning baseline holds at zero", "the equivalence audit is green"): they confirm the compiler
  works, not that it was worth building. REQUIREMENTS already declares the destination
  (§5 Required: "From v3.0 it [the compiler] ships as a separate package (`@tsrx/le-truc` or
  `@zeix/tsrx-le-truc`), while `@zeix/le-truc` remains the backend-agnostic client layer") — what
  is missing is the track that gets there and the criteria that test the thesis.
  **Deliverable:** (a) REQUIREMENTS round: the framework-goal framing in §1; success criteria that
  can fail — **one real project outside this repo compiling through the published tool** (the only
  evidence that confirms the drift-cost thesis), and a measured drift-cost data point from it;
  the distribution constraints a published compiler inherits stated where users will read them
  (dependency weight policy — jsdom stays build-time-only; browser purity per M25; adapter
  surface). (b) The packaging track written as tasks: the publishable package (the LT-206
  deferrals — `check:tsrx`/`build:tsrx` script names, `server/effects/tsrx.ts`,
  `server/generated/tsrx/`, `@tsrx/core` names, TSRX diagnostic codes as public API — become
  scheduled work, not "revisit at packaging only"); the corpus-scan generalization (glob the
  *user's* components; today's registry/TSRX048 contract is this-repo-shaped); an adapter beyond
  Bun (Vite-first was the transform-basis ruling; adapter surface = the second-consumer
  onboarding path). Personas: REQUIREMENTS §2's design-system author is the first external
  consumer — write the track against their setup, not the docs-site's.
  **Check:** the reflection's standard holds — until a project outside `examples/` compiles
  through it, every compiler line amortizes over 22 demo components; this task is what stops that
  being permanently true. Compiler growth beyond v3's corpus goal gates on this track, not the
  reverse.
