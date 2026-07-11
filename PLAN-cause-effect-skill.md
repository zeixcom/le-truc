# PLAN: Build the missing `cause-effect` skill

## Goal

`.agents/skills/cause-effect/` exists but contains **only a `.DS_Store` file** — no `SKILL.md`, no references. It is a dead directory: the skill loader can't pick it up, so any agent routed toward signal-level questions has nothing to load, while the sibling skills actively point there conceptually (the `le-truc` skill says "For signal-level questions, `@zeix/cause-effect` is re-exported by le-truc"; `le-truc-dev` keeps a thin `references/cause-effect-integration.md` that explicitly disclaims "This is NOT a full cause-effect API reference").

Signal-level questions are where agents most often go wrong in this codebase, because cause-effect has sharp, non-obvious constraints (`T extends {}`, owner requirements, updater-function ambiguity in `.set()`, `match()` routing precedence, lazy `watched` activation). A proper skill turns those recurring landmines into documented, retrievable guidance.

The source of truth is already local and current: `node_modules/@zeix/cause-effect/README.md` (v1.4, the pinned dependency) plus `node_modules/@zeix/cause-effect/src/` for details the README omits.

## Exact files to touch

| File | Change |
|---|---|
| `.agents/skills/cause-effect/SKILL.md` | **New** — main skill file with frontmatter |
| `.agents/skills/cause-effect/references/primitives.md` | **New** — signal-type decision guide |
| `.agents/skills/cause-effect/references/pitfalls.md` | **New** — constraints and failure modes |
| `.agents/skills/cause-effect/.DS_Store` | **Delete** |

Do not touch `.agents/skills/le-truc-dev/references/cause-effect-integration.md` — it stays as the "how *le-truc* uses cause-effect" view; the new skill is the "how cause-effect itself behaves" view. Cross-reference, don't duplicate.

## Step-by-step implementation plan

### Step 1 — Read the sources

1. `node_modules/@zeix/cause-effect/README.md` — full read; it is the API reference.
2. `.agents/skills/le-truc-dev/references/cause-effect-integration.md` — to know what *not* to duplicate and what to link.
3. `.agents/skills/le-truc/SKILL.md` and `.agents/skills/le-truc-dev/SKILL.md` — copy their frontmatter shape, tone, and section conventions exactly (frontmatter keys: `name`, `description`, `user_invocable: true`).

### Step 2 — Write `SKILL.md`

Frontmatter:

```markdown
---
name: cause-effect
description: Expert guidance for @zeix/cause-effect reactive primitives (signals, memos, tasks, sensors, slots, scopes). Use for signal-level questions, choosing the right primitive, or debugging reactivity — in le-truc projects or standalone.
user_invocable: true
---
```

Body sections (keep SKILL.md ≲ 150 lines; depth goes in references/):

1. **Purpose & scope** — cause-effect is le-truc's reactive layer and is fully re-exported from `@zeix/le-truc`; this skill covers the primitives themselves. For le-truc component patterns, defer to the `le-truc` skill; for le-truc internals, `le-truc-dev`.
2. **Primitive picker table** — one row per creator with "use when": `createState` (writable value), `createMemo`/`createComputed` (derived, lazy), `createTask` (async with pending/error states, AbortSignal), `createSensor` (event/callback-driven external source), `createSlot` (swappable backing signal — what le-truc props are made of), `createList`/`createStore`/`createCollection`/`deriveCollection` (keyed collections), `createEffect` (terminal side-effect sink), `createScope` (ownership/cleanup), `batch`/`untrack`/`unown`/`match` (coordination utilities).
3. **The ownership model** — effects and scopes form a tree; a scope created inside an owner registers its dispose there; `{ root: true }` opts out (external lifecycle authority, e.g. `disconnectedCallback`); effect cleanups run before every re-run and on dispose. This is the single most important mental model — summarize here, detail in `references/pitfalls.md`.
4. **`match()` routing** — precedence `nil` > `err` > `stale` > `ok`; `stale` only for Tasks with a seeded value; omitted handlers fall through.
5. **Pointers** — `references/primitives.md`, `references/pitfalls.md`, and (for le-truc use) `../le-truc-dev/references/cause-effect-integration.md`.

### Step 3 — Write `references/primitives.md`

For each primitive: creation signature, read/write API, laziness/activation behavior (`watched` callbacks on Memo/Sensor/Store/List/Collection — activate on first effect read, cleanup when last watcher leaves), equality options, and a short canonical example lifted from the README (verify each example against the README, don't write from memory). Include the collection layer (`createList` keying, `DuplicateKeyError`, `deriveCollection` watched propagation).

### Step 4 — Write `references/pitfalls.md`

Document at minimum these verified sharp edges (each with a one-line fix):

- **`T extends {}`** — no `null`/`undefined` in signal values; use fallback values or wrapper objects.
- **`.set(fn)` treats a function as an updater** — to store a function value, wrap it in an object (`{ get: fn }`) or use an updater returning it.
- **`createEffect` requires an active owner** — top-level effects throw (`Active owner is required`); wrap in `createScope` (or `{ root: true }` scope for component-lifecycle-managed teardown).
- **Scopes created inside an effect are disposed on every re-run** — per-element or cached scopes inside effects need `{ root: true }` + manual bookkeeping (this is the exact mechanism behind le-truc's `each()`; link there).
- **Synchronous Memo/Slot callbacks must not return a Promise** (`PromiseValueError`) — use an async callback to get a Task.
- **Async effect handlers can't be cancelled** — stale-run rejections still reach `err`; keep async handlers free of state writes (README documents this explicitly).
- **Unseeded Task first read** throws `UnsetSignalValueError` → routes to `nil`, not `stale`; seed with `{ value }` to get `stale` semantics.
- **`untrack`/`unown` distinction** — untrack suppresses dependency tracking; unown suppresses ownership registration.

### Step 5 — Clean up and verify

1. `rm .agents/skills/cause-effect/.DS_Store`.
2. Verify structure matches siblings: `ls .agents/skills/cause-effect` → `SKILL.md references`.
3. Start a fresh agent session (or ask the user to) and confirm `cause-effect` appears in the available-skills list with the new description.

## Edge cases a weaker model would likely miss

- **Write against the installed version, not training data.** The package is `@zeix/cause-effect` **1.4** (see `package.json` and `bun.lock`). APIs like `createSlot`, `Slot.replace`, `SlotDescriptor`, `match` handler shapes, and `ScopeOptions.root` are niche and version-specific — every claim in the skill must be checkable against `node_modules/@zeix/cause-effect/README.md` or its `src/`. If the README and src disagree, src wins; note the discrepancy.
- **`createComputed` vs `createMemo`:** both exist and both are used in le-truc (`component.ts` uses `createComputed`, `dom.ts` uses `createMemo`). Check the README/types for the actual distinction before describing them as synonyms.
- **Version drift:** add one line to SKILL.md stating which cause-effect version it was written against ("Written against @zeix/cause-effect 1.4 — verify against the installed README on major upgrades"), so future maintainers know when to refresh it.
- **Don't copy the whole README into references/** — the skill's value is selection and warnings, not mirroring; the README ships in `node_modules` and can always be read directly. Keep references/ files focused (≲ 200 lines each).
- **Frontmatter must match the loader's expectations** — copy the exact key set from a working sibling (`.agents/skills/le-truc/SKILL.md`); an invalid frontmatter block fails silently (the skill just doesn't appear — which is indistinguishable from today's empty-dir state, so verify step 5.3 explicitly).
- **The le-truc re-export is not 1:1 forever** — CHANGELOG 2.1.0 notes `valueString` was dropped from le-truc's re-exports while remaining in cause-effect. In the skill, say "most of the public API is re-exported by le-truc; when an import fails from `@zeix/le-truc`, try `@zeix/cause-effect` directly" rather than claiming full re-export.

## Acceptance criteria

1. `.agents/skills/cause-effect/` contains `SKILL.md` and `references/primitives.md`, `references/pitfalls.md`; no `.DS_Store`.
2. SKILL.md frontmatter parses (same key set as siblings) and the skill appears in a fresh session's available-skills list.
3. Every API name mentioned exists in `node_modules/@zeix/cause-effect/README.md` or `src/` — verify with grep for at least: `createSlot`, `SlotDescriptor`, `match`, `unown`, `PromiseValueError`, `DuplicateKeyError`, `UnsetSignalValueError`, `root: true`.
4. The pitfalls file covers all eight listed sharp edges.
5. No content duplicated verbatim from `le-truc-dev/references/cause-effect-integration.md`; the two files cross-reference each other instead.
