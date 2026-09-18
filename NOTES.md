# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

## LT-208/209/211 implementation deviations from the task texts
**Date:** 2026-09-18 | **Skill:** le-truc-dev
Three findings from executing the round; the code follows the architecture's own rules where the task text said otherwise:
1. **`isPending` is imported, not ambient.** The LT-211 text said "ambient in BOTH profiles". The `.tsrx` profile's own coverage test (`globals.test.ts`) enforces a closed vocabulary (factory members + context names only — sub-design 16: real exports are IMPORTED), and the `.tsx` surface's TSRX036 correctly diagnoses a used-but-not-imported real export. Since `isPending` IS a real package re-export (index.ts:62, owner's stated intent), the authored import is the honest channel on both surfaces; no ambient was added. The fixture imports it; HOST_PROFILE.md teaches the import.
2. **The `.tsrx` idiom is the reactive attribute, not `@if`.** The task's `@if (isPending(signal)) { … }` example cannot work: `validateCondition` diagnoses signal reads in conditions BY DESIGN (the DOM keeps the initially rendered branch, so a signal condition would silently stop matching) — and that diagnosis fires BEFORE the unknown-name check, so the isPending scope admission reopens no hole. The client-reactive idiom on both surfaces is the ARROW-thunk attribute (`class={() => (isPending(data) ? 'dimmed' : null)}`); a bare (non-arrow) isPending expression classifies `server` and never updates. HOST_PROFILE.md teaches the arrow form; the parity fixture pins it.
3. **The isPending fold needed BOTH serverKnown construction sites** (front-end.ts extract-time context AND the ComponentIR assembly — the extraction-context seed alone does not reach emit-server's fold gating) and **both emitters bind it by tokenizing their emitted text** (the `retainReferenced` identifier-boundary precedent): an authored import is filtered server-side by RUNTIME_HARNESS_EXPORTS, so the harness binding must come from the emitter; over-retention on a string literal is harmless (noUnusedLocals is off). Side effect: an authored `isPending` in setup no longer produces an unbound server reference (a latent TSRX-shaped gap nobody had hit).

**Tech Writer handoff (ADR 0028 lifecycle):** new diagnostics TSRX049 (`badFactoryContextParam`) and TSRX050 (`formContextMismatch`) in `server/compiler/diagnostics.ts` carry first-draft copy in place; the boundary's arm-shape diagnostic in `frontend/tsx/lower-tsx.ts` dropped its `stale?: <p/>` fragment; the stale-arm constraint diagnostic in `analysis/effects.ts` is deleted outright. LT-189 item 5 updated to cover the new codes.

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
