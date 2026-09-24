# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-21): opening wave 4 — the last gates cleared, and the
first migrations land.** Drawn from [BACKLOG.md](BACKLOG.md)'s P1, P2b, P3, P4 and P5 bands.
The previous iteration ("the compiler measured, its install story sound, and the last v3.0
deprecation gates cleared") is fully landed and reviewed — LT-266, LT-273, LT-278 and LT-279
are in `DONE.md`, and LT-178 (PR #131) and LT-179 (PR #132) are merged from the removal
branch, so wave 4's original gate is discharged.

**Why these nine.** The last iteration cleared LT-178/LT-179 expressly so this one could
open the wave-4 migrations (P5, the biggest remaining band). Opening the wave is gate work
first, and the gates are serialized in front of the first migration: **LT-238** gates every
remaining migration and LT-237 (the canonical-plus-variants ruling is the owner's call and
must be grilled before any migration lands — **ruled 2026-09-21: build-selected variants,
[ADR 0039](adr/0039-canonical-plus-variants-authored-surfaces.md); the gate is now carried by
its implementation tasks LT-283 → LT-285**). **LT-235** runs before LT-212's implementation
per its own sequencing note and lays the IR foundation the ADR 0037 chain and LT-280 both
coordinate against — **ruled 2026-09-21:
[ADR 0040](adr/0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md); the
type-level gate is carried by LT-286**. **LT-212 and LT-213** are the owner-sequenced gates in front of the
FIRST migration; **LT-188** (reviewed, in DONE.md) cleared composition across tiers (the
first migrated component, module-codeblock, composes basic-button). With the gates
through, **LT-237** gives the spike fixtures a real home and **LT-096** — the smallest
example — proves the wave actually opened: compiled `.tsx`, spec green, tier + reason
recorded. **LT-258** is the one runnable P1 task (the partial-readiness invariant is
checkable now, and LT-257 — template emission, the release mechanism — depends on it), and
**LT-207** is small suite-determinism insurance: the wave runs the test suite constantly
and it currently exits 0-or-1 nondeterministically. Both run in parallel slots at any time
(LT-207 worth doing first). **Deliberately not here:** LT-280's grilling waits for the
iteration that implements it — its gate binds only the wave's final three composites
(LT-109/110/111), and its rulings will be better-informed once LT-235's IR ADR has landed.
The remaining text-shape migrations (LT-095, LT-097–LT-108) follow next iteration once the
gates hold; the i18n chain (LT-242 → LT-233 → LT-250) and the ADR 0037 implementation
(LT-274/275/276) keep for later iterations — nothing in this iteration contends with them.

**Exit criterion:** a corpus carrying all three spellings of one example compiles clean,
its spec passes against each, and LTC048 still fires for two canonical sources
(LT-283–LT-285, the LT-238 ruling's implementation);
the IR ADR is recorded (LT-235) and `@empty` lands and dynamic tags are rejected (A0 ruling) with parity green, the
warning baseline at 0 and census 20/2/0 (LT-212, LT-213); a Simulated parent
server-splicing a Folded child renders the child UPGRADED (LT-188); `spike/tsx/` is deleted
and the parity suite, tsx typecheck gates and dual-corpus test run from the new fixture
homes (LT-237); module-codeblock serves as compiled `.tsx` with its spec green, the
copy-click bug fixed and pinned, zero warnings and tier + reason recorded (LT-096); a
fixture reaching page context outside the declared ambient set fails the build while the
corpus passes unchanged (LT-258); three consecutive full `bun test server/tests` runs exit
0 (LT-207).

**Next free task ID: LT-313.** (LT-280/281/282 are filed in BACKLOG.md — LT-280 gates the
wave's loop-heavy composites, LT-281/LT-282 are the LT-179 review riders. The LT-238 and
LT-235 sessions consumed LT-283–LT-285 and LT-286–LT-289 respectively for their
implementation tasks. The 2026-09-23 compiler review filed LT-290; the LT-238/LT-283/LT-235
review filed LT-291–LT-294; the LT-284 review filed LT-295/LT-296; LT-290's close-out filed LT-297; the first `test:variants` run filed LT-298; the LT-286 review filed LT-299; the LT-212 review filed LT-300–LT-302; the LT-213 deliberation filed LT-303 (ADR 0041); the ADR 0033 ruling filed LT-304–LT-306; the LT-237 review filed LT-308; the LT-096 review filed LT-309–LT-312.)

**Iteration amendment (Architect, 2026-09-23 review of LT-238, LT-283, LT-235).** All three
are reviewed ✓ and moved to `DONE.md`. Three tasks join the iteration, ahead of the in-flight
LT-284 → LT-237 → LT-285 chain: **LT-290** (pulled from BACKLOG P3 — `check:corpus` exits 2
at HEAD, so no task's gate can read green until it lands), **LT-293** (the LT-283 Tech
Writer handoff, never executed — the exit criterion's LTC048 must read true in the docs as
well as the build), and **LT-294** (the CEM reads a stale output directory, so LT-285's CEM
proof would prove nothing). LT-291 and LT-292 (LT-283 review follow-ups) are filed in
BACKLOG P3. LT-291 is latent today, but it gates the first wave-4 migration that retains a
twin that a compiled parent references. The exit criterion gains: `check:corpus` exits 0
(LT-290).

**HEAD state after 640922d5 (LT-284 review, 2026-09-23).** That commit, titled LT-284,
also carries LT-293 (error copy + compiler docs) and the in-progress LT-237/LT-285 work
(`basic-counter.ts` twin, `examples/tsconfig.json`, CEM twin exclusion, the parity/typecheck
test edits). It is pushed, so history stays; attribute by file, not by title. HEAD is red:
`bun test server/tests/compiler` has the 9 LT-237 rider failures. tsc is clean. The
`serve.test.ts` route legs and the Playwright matrix need port binding, which no review
sandbox has.

---

- [ ] LT-258: Make the partial-readiness invariant a compiler check.
  **Skill:** le-truc-dev
  **Context:** ADR 0034 s4. The invariant — folded output depends only on the component's own
  props plus a closed, enumerable set of page-ambient values — is checkable **now**, before the
  emitter exists, and it must be, because the failure mode is a design landing between now and
  LT-257 that quietly forecloses template emission. The closed ambient set today is the reserved
  `i18n` parameter's five members ([ADR 0030](adr/0030-internationalization-as-build-time-server-data.md) s2).
  **Deliverable:** a check in the fold path that a folded expression's inputs are the component's
  own args or a member of the declared ambient set, and nothing else; the ambient set declared in
  **one** place the check reads, so adding to it is a visible, reviewable act rather than a
  diffuse one. Violations are a compile-time diagnostic (channel: compiler; tier 1 Prevented);
  new code, Tech Writer owns the copy.
  **Check:** the corpus passes unchanged; a fixture that reaches page context outside the
  declared set fails the build with the ruled message.
  **ADR 0037 rider (2026-09-21):** the check classifies a reactive condition's initial
  winner as prop-dependent output — legal, but the emitted backend conditional must be one of
  the invariant's named representations (see the LT-257 rider).

- [ ] LT-207: Stop the simulation realm's dependency-wait timers from leaking past teardown (LT-202 NOTES residue).
  **Skill:** le-truc-dev
  **Context:** `bun test server/tests` exits 0 or 1 nondeterministically at HEAD: 3
  unhandled `DependencyTimeoutError` "errors between tests" with 0 failures (verified
  pre-existing on the clean base, f4d66be0). Mechanism (hypothesis from LT-202): the
  parity suite's sim-realm disposal leaves the library's 200 ms dependency-resolution
  timer running; its rejection then lands on the torn-down window (`customElements.get`
  on a disposed realm) and bun fails whichever test is awaiting when it arrives.
  Timing-dependent — corpus-order failed twice in a 3-file subset run, passed in both
  full-suite runs. The realm should cancel or absorb in-flight dependency-resolution
  timers on `dispose()` (or the driver should drain them before teardown) so a disposed
  realm can never emit an unhandled rejection into the next test.
  **Acceptance:** three consecutive full `bun test server/tests` runs exit 0; the
  3-file subset that failed during LT-202 exits 0 repeatedly; no test asserts on the
  leaked rejection today, so fixing it changes no pinned behavior.
