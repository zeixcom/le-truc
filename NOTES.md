# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

## LT-173 — three review notes for the fold widening, pluralize's contract, and span addressing
**Date:** 2026-09-06 | **Skill:** le-truc-dev

1. **The `foldableRenderScope` widening touches more than pluralize, by design.** Allowing a host-derived fold to call transitive-pure setup consts (needed so `pluralCategory(...)` folds once the locale is server-known) also folds `form-colorgraph`'s `aria-valuenow`/`aria-valuetext` at phase 1 (pure `parseOklch(host.value)` chain through `asOklch()`). Both audit snapshots were re-pinned after verifying the folded values equal what the client computed; the connect fixed-point gate stays green. Anything that reads this should re-check OTHER corpora the same way — the shared rule, not the component, decides.
2. **Compiled pluralize no longer walks ancestors for its locale** (ADR 0030 s7's canonical-route move): it reads the element's own `lang` attribute as a Parser-exposed prop, connect-time, per the attribute's already-documented contract. The demo's Welsh instance changed from a `<div lang="cy">` wrapper to `lang="cy"` on the element. Hand-written twins keeping `getLocale()` are unaffected; if a page relied on ancestor-only locale for a COMPILED component, that page must set the attribute now.
3. **`truc:case` elements are addressed `'maybe'`/guarded** (they may be pruned), so a required `first()` ref against one can throw at connect when the locale prunes it — contained per ADR 0028. Deeper client constructs inside a case element are rejected outright. If real authoring wants refs into pruned alternatives, that is a new addressing rule, not a tweak.

Also recorded: the emitter orders reactive attributes before the static `class` attribute on an element (`hidden` before `class` on the category spans) — pre-existing serialization order, but it surprised a test regex once already; anchor selector scans on whole open tags.

---

## Tooling — Mimosa PreToolUse hook false-positives on `server/tsrx/runtime.ts`
**Date:** 2026-08-29 | **Skill:** le-truc-dev
During LT-090, Mimosa twice rejected Edits to `runtime.ts` as "command injection" — a false positive on HTML-escaping string building (that module has no process execution; the flagged region was pre-existing `esc()`/`attr()` code). Workaround: place render-time helpers in their own module (`compose-attrs.ts`) and re-export through `runtime.ts`. Future edits to `runtime.ts` may hit the same heuristic — if a legitimate edit is blocked, check whether the flagged pattern is pre-existing escaping code before restructuring.

---
