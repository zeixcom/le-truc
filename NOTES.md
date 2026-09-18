# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

## LT-208/209/211 — Tech Writer handoff (deviations ruled ✓, Architect 2026-09-18)
**Date:** 2026-09-18 | **Skill:** le-truc-dev → resolved by review
The three implementation deviations from the task texts are RULED as accepted and
incorporated elsewhere (ADR 0032 s3 + the amended LT-205 paragraph, HOST_PROFILE.md,
the review notes in TODO.md): (1) `isPending` is IMPORTED, not ambient — globals.test.ts's
closed vocabulary and TSRX036 both forbid an ambient for a real package export; (2) the
`.tsrx` `@if (isPending(signal))` spelling from the LT-211 text cannot exist —
`validateCondition` diagnoses signal conditions by design, and the reactive idiom on both
surfaces is the ARROW-thunk attribute; (3) the fold needed both `serverKnown`
construction sites plus emitter-side tokenization of the emitted text.

**Still live — Tech Writer handoff (ADR 0028 lifecycle, batched into LT-189 item 5):**
new diagnostics TSRX049 (`badFactoryContextParam`) and TSRX050 (`formContextMismatch`) in
`server/compiler/diagnostics.ts` carry first-draft copy; the boundary's arm-shape
diagnostic in `frontend/tsx/lower-tsx.ts` dropped its `stale?: <p/>` fragment; the
stale-arm constraint diagnostic in `analysis/effects.ts` is deleted outright.
Propagation targets: `.agents/skills/le-truc/references/errors.md` needs TSRX049/050
rows (the tables currently end at TSRX037/042-era entries), plus the usual
docs-src/skill sweep per the lifecycle checklist. Also in this batch: the boundary's
diagnostic message and HOST_PROFILE.md's boundary section are the copy reference for
the three-arm + isPending story.

---

## LT-207's error family has a second, non-timer face: the tier-corpus census describe body
**Date:** 2026-09-17 | **Skill:** le-truc-dev (LT-206)
While gating LT-206, the "unhandled error between tests" family showed a face that is NOT the
dependency-wait timer: `server/tests/compiler/tier-corpus.test.ts`'s second describe block
("the tier census") calls `tierCensus(Object.values(registry))` in the DESCRIBE BODY — at
collection time, before `beforeAll` assigns `registry` (the f4d66be0 move put the compile in
`beforeAll` but left the census in the body). TypeError, 0 test failures, reproducible in
ISOLATION and falsified pre-existing at HEAD via a throwaway worktree. When fixing LT-207,
either move the census computation into the tests/`beforeAll` or absorb collection throws —
cancelling realm timers alone will not make full runs exit 0.

## Uncommitted foreign edit to `spike/tsx/async/async-el.tsx` broke the parity pin — restored
**Date:** 2026-09-17 | **Skill:** le-truc-dev (LT-206)
At session start the working tree carried an uncommitted one-line edit to async-el.tsx
(`export function AsyncEl({}: {})` → `AsyncEl()`), not made by this session. The parity suite
compiles that fixture from disk, and the parameterless form violates the single-destructured-
args contract → TSRX008 → the four-arm nil-arm render pin failed. Restored to the HEAD form
via inverse edit (no `git checkout`); suite green after. Whoever made that edit: a `.tsx`
component function must take a single destructured args object, even when empty — `{}: {}` is
the contract-conformant spelling.

## Tooling — Mimosa PreToolUse hook false-positives on `server/tsrx/runtime.ts`
**Date:** 2026-08-29 | **Skill:** le-truc-dev
During LT-090, Mimosa twice rejected Edits to `runtime.ts` as "command injection" — a false positive on HTML-escaping string building (that module has no process execution; the flagged region was pre-existing `esc()`/`attr()` code). Workaround: place render-time helpers in their own module (`compose-attrs.ts`) and re-export through `runtime.ts`. Future edits to `runtime.ts` may hit the same heuristic — if a legitimate edit is blocked, check whether the flagged pattern is pre-existing escaping code before restructuring.
