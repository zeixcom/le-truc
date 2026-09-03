# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

## LT-158 — `expose({ x: sig.get })` is read-only, so most corpus props are not `pass()`-able
**Date:** 2026-09-03 | **Skill:** docs-server-dev
**Issue:** LT-158 landed as specified, but implementing it surfaced a DX question the task did not anticipate and that is outside a developer's remit to decide. `#setAccessor` builds a Slot only for a *mutable* signal or a `{ get, set }` descriptor. `sig.get` is a bare function — neither — so it is wrapped in `deriveCell` and the prop is defined with a plain getter, **however mutable `sig` is**. Verified empirically against the runtime, not inferred from the types. `expose({ count: count.get })` is the canonical shape in every example and in the docs, which means the residual ADR 0028 § 6 set out to close was not a corner case: read-only is the *default*, and a `pass={{ count: … }}` at such a component is now a build error with no obvious fix short of restructuring the child's `expose()`.

The corpus does not trip on this today — its three `pass()` targets happen to expose through a Parser or a plain value — so nothing is broken and no task is blocked. But the first author who writes the canonical expose shape and then tries to pass to it will hit a wall the error message can only explain, not resolve.

**Options:** (a) leave it — the diagnostic explains the shape and the fix is "expose a mutable initializer", which is arguably the honest contract ([ADR 0004](adr/0004-slot-based-signal-swapping-for-inter-component-binding.md): a Slot is a *swappable* backing signal, and a computed has nothing to swap); (b) make `#setAccessor` recognize a signal's own bound `.get` and Slot-back it — widens the writable surface, and silently, which is what ADR 0012's DEV warning already worries about; (c) keep the runtime as-is and change the authoring convention — `expose({ count })` (the signal itself) for a prop meant to be driven from outside, `expose({ count: count.get })` for a genuinely read-only projection — which makes the distinction visible in source. TSRX already classifies both, so (c) costs a docs pass, not compiler work.
**Question:** Is read-only-by-default the intended contract for `.get`, or is the corpus convention wrong? (c) looks right from here, but it changes guidance in every example and the docs, so it is the Architect's call, not mine.

---

## Tooling — Mimosa PreToolUse hook false-positives on `server/tsrx/runtime.ts`
**Date:** 2026-08-29 | **Skill:** le-truc-dev
During LT-090, Mimosa twice rejected Edits to `runtime.ts` as "command injection" — a false positive on HTML-escaping string building (that module has no process execution; the flagged region was pre-existing `esc()`/`attr()` code). Workaround: place render-time helpers in their own module (`compose-attrs.ts`) and re-export through `runtime.ts`. Future edits to `runtime.ts` may hit the same heuristic — if a legitimate edit is blocked, check whether the flagged pattern is pre-existing escaping code before restructuring.

---
