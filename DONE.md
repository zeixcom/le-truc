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

- [x] LT-242: Extend the parity suite to diagnostics — the equivalence contract covers failed compiles too (ADR 0032 amendment). — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** new `server/tests/compiler/tsx/diagnostic-parity.test.ts`; ADR 0032 s6 and
  `ARCHITECTURE.md` § Authoring Surfaces now read "render byte-identically **and diagnose
  identically**" (s6's stale suite path fixed too).
  **Ruling (Architect, 2026-09-25):** parity alone cannot see shared machinery that speaks one
  surface's vocabulary to both — identical, and wrong for one. The contract therefore has TWO
  checks, both standing: equal code + severity + message after translating `.tsx` through an
  allowlist, AND a leak scan that rejects `.tsrx` directive vocabulary in any `.tsx` message.
  The §2.3 per-item `ref` drift had already converged in practice (`classify-attributes.ts`
  retires `ref={}` on both surfaces first).
  **Review:** Approved. The pins were mutation-checked (reintroducing the §1.1 bug fails the
  suite); every allowlist entry must be exercised, so the table cannot rot.

- [x] LT-233: `SurfaceAdapter` + shared `runFrontEnd` — collapse the copied front-end drivers. — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** new `server/compiler/front-end.ts` (`SurfaceAdapter`, `runFrontEnd`,
  `createExtractContext`, `CompileResult`) and `server/compiler/surface.ts` (one
  `SurfaceWording` table per surface, `wordingOf`); `lower-shared.ts` owns the programs after
  header parsing (`lowerLoop` over a `LoopSource`, `finishIf`, `finishTry`,
  `reportEmptySwitch`); ~40 `.tsrx`-worded messages in `analysis/effects.ts`,
  `analysis/loops.ts` and five `diagnostics.ts` builders now compose from the vocabulary.
  Generated corpus artifacts byte-identical. User-visible (CHANGELOG `[Unreleased]` Fixed,
  landed): `.tsx` diagnostics no longer name `.tsrx` directives or the retired `&{}` sigil, and a
  `.tsx` list `.map()` body with statements besides its `return` is rejected instead of
  silently dropping them.
  **Rulings (Architect, 2026-09-25):**
  - **Shared compiler code never spells a surface's construct itself** — it reads
    `wordingOf(ctx | component)`. A message only one grammar can reach may stay a literal; two
    such (the `.tsrx` key clause, the `.tsx` `.map()` arity) sit in the shared `lowerLoop`
    because the check ORDER is shared — accepted, and each is commented as single-surface.
  - **`ComponentIR.surface` is OPTIONAL; absent ⇒ `.tsx` wording.** It is contract IR
    (`contract.ts`: a required field would be a tightened shape, i.e. major), and a third-party
    front end has neither vocabulary — `.tsx`'s JavaScript-expression spelling is the nearer
    fit. `ExtractContext.surface` is internal and required. No neutral third table unless a
    real third-party front end reads wrong under the `.tsx` words.
  - **The `.tsx` reactive-list key binding is a capability gap, not wording** → LT-342.
  **Handoffs:** LT-189 item 15 (the vocabulary's copy); LT-275 rider (ADR 0037 codes join
  `surface.ts`, the parity `CONDITIONS` cases flip with them); LT-342.
  **Review:** Approved. Diff re-read for order drift: the one reordering (the `.map()`
  callback-body check now precedes the item-name check) is unreachable for arrow callbacks.

Pruned 2026-09-25, third pass (Architect, after the "wave 4, second batch" iteration closed;
Changelog Keeper merged it into `CHANGELOG.md [Unreleased]` the same day). **No task entries
remain.** Every one was either consumed with nothing left to carry, or reduced to a ruling in
the standing notes below, tagged with its source ID. Consumed: LT-095, LT-104–LT-108, LT-179,
LT-188, LT-207, LT-212, LT-213, LT-258, LT-266, LT-290, LT-295, LT-296, LT-300–LT-303,
LT-312, LT-314, LT-316, LT-319, LT-320, LT-323, LT-325, LT-326, LT-328–LT-330, LT-332, LT-338,
LT-339, LT-341. Open handoffs are restated in their own entries: LT-189 items 5, 11–14, LT-297,
LT-309–LT-311, LT-331, LT-333–LT-337, LT-340. Earlier prunes: 2026-09-25 ×2, 2026-09-21 ×2.
Full entry text: `git log -p -- DONE.md`.

**Open obligations** (not yet discharged; check before closing the named work):
- **The first `@empty` over a reactive List owes a browser spec leg** for the empty → filled →
  empty cycle. No corpus component uses it yet (LT-212).
- **CI has not yet proved the variant spec matrix.** CI triggers only on `main`/`next` pushes and
  PRs, not `v3`, so the next PR's run is the first proof. It must list every variant set, and a
  throwaway broken `.ts` twin must fail the job on surface "ts" (LT-295).
- **The simulation realm's timer ownership is process-wide.** Any host timer scheduled while a
  realm is open is cancelled at `dispose()`. That is safe only because `simulateCorpus()` runs in
  one-shot builds. A task that opens a realm in a long-lived process (dev server, watch
  rebuilds) must revisit it (LT-207).
- **The trap in `src/tests/reactive.test.ts`:** one assertion passes under both the pre- and
  post-LT-178 spelling. Tighten it once LT-189 item 11 settles the wording (LT-179).

**Standing notes for compiler-adjacent tasks:**
- A compiler crash during a corpus build makes `typecheck`'s `&&`-chained `tsc` silently skip.
  Check the exit code, never grep for "error TS" (LT-226). A handoff's `check:corpus` claim is its
  **exit code**, not the warning baseline (LT-283).
- **A folded reactive thunk that reads page context is an error, not an omission** (LT-258).
  `Date.now()` is unresolvable in every tier; a page-context read is realm-answerable, so omitting
  it would silently re-route Folded → Simulated and out of template emission. The page-context
  side is the deny-list `PAGE_CONTEXT_GLOBALS` (`fold-inputs.ts`); the positive side is
  `assertFoldScopeClosed`. Keep that split. RNG stays on the impure-ambient side, and computed or
  aliased receivers (`crypto['randomUUID']()`, a destructured `randomUUID`) still fold as accepted
  residue, to revisit only on a real case (LT-314; LT-340 is the related indirection gap).
- **Client-only signal credit** means "at least one client-only read, none a render read" (not
  "every consumer client-only"), and the render read is transitive through setup consts
  (LT-323, LT-327). LT-333 extends it.
- **Harness-name aliasing covers only emitter-synthesized sites** (LT-302). Authored text keeps its
  spelling, and `host`/`internals` are never aliased.
- **`truc:pass` addressing** (LT-338, LT-319, LT-339). An auto-addressed site is a **required**
  query (`'one'`), the same as a raw custom element. A shared-class group lowers to one
  `pass(all(…))` only on **textual** identity of the `truc:pass` objects, never semantic
  equivalence, and only when every member would reach the fallback itself. The imperative
  `pass(all(…))` stays sanctioned as a client-only setup statement (tier 2).
- **A loop is diagnosed only when its output IS a branch root** (LT-301). A loop wrapped in an
  element inside a branch stays legal. Branch-scoped `each()` is a design task when a migration
  first needs it.
- **`<truc:try>`** (LT-303): `tsc` owns the arm types, the repeated arm and the missing `catch`.
  The compiler keeps one LTC005 shape error and also guards the missing `catch`, because it never
  runs `tsc`. As a `.map()` output root it is LTC053, matching `.tsrx`. LT-276 reshapes the `try`
  node under both front ends.
- **Generated typings** (LT-312, LT-325). Import keys are the shortest path suffix no other
  source shares, so a collision fails loudly. The file is always written, even empty. A
  `.tsx`-served tag gets no generated tag-map entry, because its authored source carries one and
  a second would be TS 2717. The examples typecheck leg needs a corpus build first.
- **The canonical output directory is not pruned** (LT-296). The route serves a canonical client
  only when `registry.json` selects that surface; `compileCorpus` owns and prunes only
  `variants/`.
- **The simulation realm** (LT-188, LT-332). A Folded/Static child in the composed closure runs
  its connect in the realm, and its diagnostics attribute to the rendering parent, which is
  intended. A connect-time page-context API the realm lacks (`history`, `requestAnimationFrame`)
  gets an **inert stub** in `patch-table.ts`/`capabilities.ts`, not a standing classification.
- **Dynamic tags** (LT-213, for the future `<truc:element tag={…}>`, ADR 0041). Address such an
  element by class/id/`data-*`, never by tag. No React-style `const Tag = …; <Tag>`, which
  collides with PascalCase compose dispatch. IR shape:
  `tag: { kind: 'static', name } | { kind: 'server', exprText }`.
- **`argsFromAttrs`** (LT-290, LT-095). Declaring a ref stub inside the page-occurrence helper
  was rejected, because a `refStub` value would reach the markup. A server arg's page-occurrence
  attribute is its **kebab-case** name; a `number` arg has a numeric channel (blank = absent,
  non-numeric = unrenderable). LT-297 and LT-336 continue this.
- **The size bet holds on the runtime, not the payload** (LT-266): 8.72 vs 64.38 kB gzip runtime;
  the payload line (3.07 vs 8.54) favours React. Any connector claim quotes **both** lines. Run of
  record: `spike/size-bet/FINDING.md`.

**Standing notes for wave-4 migrations:**
- **Don't contort a component to dodge a classifier gap; file the gap** (LT-103). Record tier and
  reason as they land. Tier predictions are often wrong: refs used only in `watch`/`on` never route
  (LT-096).
- **`bun run build:docs` is part of every migration's check** (LT-095): it caught a demo
  regression nothing else ran.
- **A Parser-exposed prop's text site is a `{() => host.<prop>}` thunk**, not the arg (LT-099).
- **A client that writes a style or ARIA value at connect gets a server render in the exact form
  the watcher writes**, so the connect diff is empty (LT-102).
- **A compose site cannot put attributes on the child's inner element**, so an opener needing
  `aria-haspopup` renders as a raw `<button>` (LT-101). The dialog's `body.scroll-lock` waits for
  LT-306's `:global()`.
- **A raw dashed tag seeds a child import only when a query addresses it** (LT-291).
- **A provider's context keys live in a module with no side effects**, never in the component
  module, because importing a component module defines the element (LT-106; docs in LT-189
  item 14).
- **Lazyload keeps its hand-written `watch(content, { ok, nil, stale, err })`**. The compiled
  boundary cannot express that contract until LT-334 (LT-104).
- **No compiler-stamped hash class for addressing** (LT-096): page-authored occurrences never pass
  through the compiler's render, so a stamped hook would be absent where the enhancer binds. The
  `:not(<tag> *)` exclusion is accepted; its only miss is an own element inside a same-tag
  ancestor of the host, which no composition produces.
- **Scrollarea's wall time at demo scale is noise** (LT-103).
