# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

## LT-266 residue: module-todo is not expressible on the authored surface — file for the Architect (2026-09-21)

The size-bet task asked for module-todo converted to the `.tsx` surface. The conversion was
drafted in full and driven through the compiler until it hit three hard walls; it did **not**
land, and `examples/module/todo/module-todo.ts` remains the tag's one authored source. The
walls (full evidence in [spike/size-bet/FINDING.md](spike/size-bet/FINDING.md)):

1. **Reactive-list loops lower to a text fill + events — nothing else**
   (`ReconcilePlan`, `server/compiler/analysis/plan.ts`; `emitReconcileBlock`,
   `server/compiler/emit-client.ts`). The generated bindItem is
   `watch(item, bindText(...))` plus per-item event listeners. There is no per-item
   `truc:pass` channel (the twin wires `checked`/`value` into the item's
   form-checkbox/form-inplace-edit), no per-item reactive attribute (the reorder button's
   `disabled` watch), and no per-item id/`for` wiring. The fill must be the bare `{item}` —
   store-backed items (`createItem: createStore`) would render as `[object Object]`.
2. **The `.tsx` surface has no `key k` clause** (`keyName` hard-coded `null`,
   `frontend/tsx/lower-tsx.ts`); `item.id` closes over the gap only where the lowering
   accepts item references at all, which per wall 1 is almost nowhere. An ADR 0032 parity
   question, not just a module-todo gap.
3. **Sanctioned setup subset (LTC005) + LTC045**: mutable `let`s, hoisted `function`s and
   module-level state references are refused in authored setup; `watch()`/`pass()` inside
   deferred callbacks are static errors. Mechanical rewrites exist (a `const` state holder,
   `const` arrows, top-level handlers) and were applied — they are the shallow part; walls
   1–2 are the structural ones.

Suggested shape for the task (Architect's call): either extend the reactive-list lowering
with a per-item pass/attribute channel (this is the wave-4 gate question — module-todo is
the flagship example migrations would hit it on), or rule module-todo permanently
hand-authored and say so in the migration plan. Next free ID at time of writing: LT-280.

## LT-266 method notes (2026-09-21)

- `bun add -d react react-dom @types/react @types/react-dom` (React 19.3) — measurement
  fixture deps only, imported exclusively under `spike/size-bet/react/`, which has its own
  tsconfig and must NOT be absorbed into the root tsc program (React's JSX table; same
  never-roommates principle as the two Le Truc ambient profiles). The measurement script
  keeps the program boundary by rendering via a subprocess (`spike/size-bet/react/render.ts`).
- GOTCHA worth keeping: `Bun.build` with `target: browser` defaults `process.env.NODE_ENV`
  to `"development"` — without pinning it, React silently resolves and ships its DEV bundle
  (~2× the production bytes). The measurement script pins both `NODE_ENV="production"` and
  `DEV_MODE="false"`.

