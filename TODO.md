# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-25): wave 4 at cadence — six migrations, and the gates
they trip first.** Drawn from [BACKLOG.md](BACKLOG.md)'s P1, P3 and P5 bands. The previous
iteration ("opening wave 4 — the last gates cleared, and the first migrations land") is fully
landed and reviewed: ADR 0039's variant sets, ADR 0040's `ForIR` split, `@empty`, LTC053,
composition across tiers, the spike fixtures rehomed, module-codeblock served as `.tsx`,
LTC054 and suite determinism. Compacted records are in `DONE.md`; the public summary is in
`CHANGELOG.md [Unreleased]`.

**Why these fifteen.** Module-codeblock proved one migration end to end. This iteration moves
the wave from proof to cadence with the six components that need nothing undesigned:
four leaves (**LT-099** pagination, **LT-101** dialog, **LT-102** splitview, **LT-103**
scrollarea) and two composites over `.tsrx` children (**LT-098** colorinfo, **LT-100** catalog).
Each migration trips a filed gate, and those gates run first. **LT-291**: every migration
retains a `.ts` twin, so the first compiled parent that references a migrated tag (codeblock
renders `<module-scrollarea>`) would import the twin. **LT-312**: the two composites are `.tsx`
parents over `.tsrx` children, the case the hand-listed typings file cannot scale to.
**LT-307**: scrollarea is the migration most likely to land Simulated, and would be the first
`.tsx`-served Simulated entry. Each migration adds a variant set, so **LT-295/LT-296** put the
variant matrix in CI and make its surface tests fail loudly instead of passing vacuously.
**LT-292** rides with LT-291 (same `compileCorpus` code). **LT-299** turns `biome check ./server`
green, so the gates the migrations cite read true. **LT-313/LT-314** are the LT-258 riders, run in
a parallel slot. LT-313 is the last gate in front of LT-257 (template emission, pioneer 2's
critical path) that does not wait on publishing.

**Deliberately not here.** LT-104 lazyload waits on LT-303 (`truc:try`). LT-105 coloreditor and
LT-107 listnav compose the tags this iteration migrates, so they follow once LT-291 holds. LT-095
blogmeta is a contract reshape with consumer ports, and LT-106 context-media has no spec. All of
those form the next migration batch, together with LT-301 (the loop-in-branch gate) and LT-108
carousel. LT-280's grilling still waits for the iteration that implements it (it gates only
LT-109/110/111). LT-309–LT-311 (codeblock follow-through, plus two designs) wait until the
batch shows how often the root-attribute and compose-event patterns recur. The i18n chain
(LT-242 → LT-233 → LT-250), the ADR 0037 implementation (LT-274–276) and the ADR 0033 CSS track
(LT-268 → LT-304/306) do not contend with this iteration and keep for later ones.

**Exit criterion:** six more examples serve as compiled `.tsx` with their `.ts` twins retained,
every spec green on every surface they carry, zero warnings and tier + reason recorded
(LT-098–LT-103, scrollarea's wall-time figures included); a bundle defines each migrated tag
exactly once, from the generated client, even where a compiled parent references it (LT-291);
`tsrx-imports.d.ts` is generated, not hand-written (LT-312); CI runs `test:variants`, and a
broken twin fails it (LT-295, LT-296); a stale `variantOverrides` entry is a config error
(LT-292); `bunx biome check ./server` exits 0 (LT-299); a server-data loop over `document` and a
folded `crypto.randomUUID()` both fail the build (LT-313, LT-314).

**Next free task ID: LT-316.**

---

### Migrations (leaf components first, then the two composites, then scrollarea)

- [ ] LT-099: Migrate `module-pagination` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, pagination controls. Has a spec — keep it green against
  `/test/module-pagination`.
  **Iteration note (2026-09-25):** the ADR 0039 migration pattern — add the `.tsx` beside the
  retained `.ts` twin (the twin declares its own `HTMLElementTagNameMap` entry), point
  `examples/main.ts` at the generated client, spec green on every surface
  (`bun run test:variants <tag>`), zero warnings, tier + reason recorded in the handoff. The
  compiled sheet stays tag-led for now; LT-306's codemod converts it with the rest.

- [ ] LT-101: Migrate `module-dialog` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~75 lines, native `<dialog>` + `showModal()` orchestration. Has a spec. Watch
  for: `dialog.` method calls from client-only setup statements (LT-069 gate), focus-related
  event handlers as bare `on()` statements.
  **Iteration note (2026-09-25):** the ADR 0039 migration pattern — add the `.tsx` beside the
  retained `.ts` twin (the twin declares its own `HTMLElementTagNameMap` entry), point
  `examples/main.ts` at the generated client, spec green on every surface
  (`bun run test:variants <tag>`), zero warnings, tier + reason recorded in the handoff. The
  compiled sheet stays tag-led for now; LT-306's codemod converts it with the rest. `body.scroll-lock` stays as authored until
  LT-306 makes it `:global(body.scroll-lock)`.

- [ ] LT-102: Migrate `module-splitview` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~77 lines, pointer-capture drag between panes. Watch for:
  `setPointerCapture`/`PointerEvent` client-only ambients (LT-069 widened `JS_GLOBALS` for
  exactly this class of code).
  **Iteration note (2026-09-25):** the ADR 0039 migration pattern — add the `.tsx` beside the
  retained `.ts` twin (the twin declares its own `HTMLElementTagNameMap` entry), point
  `examples/main.ts` at the generated client, spec green on every surface
  (`bun run test:variants <tag>`), zero warnings, tier + reason recorded in the handoff. The
  compiled sheet stays tag-led for now; LT-306's codemod converts it with the rest.

- [ ] LT-098: Migrate `module-colorinfo` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~86 lines, color info display. culori usage follows the `asOklch.ts`/`_common`
  setup point (modes must be registered there, LT-091 finding 3).
  **Iteration note (2026-09-25):** the ADR 0039 migration pattern — add the `.tsx` beside the
  retained `.ts` twin (the twin declares its own `HTMLElementTagNameMap` entry), point
  `examples/main.ts` at the generated client, spec green on every surface
  (`bun run test:variants <tag>`), zero warnings, tier + reason recorded in the handoff. The
  compiled sheet stays tag-led for now; LT-306's codemod converts it with the rest. **Depends on LT-312.** Its `pass()` into `all('basic-number.…')`
  becomes one `truc:pass` per compose site; if the compiler cannot express it, surface the gap
  in NOTES.md rather than restructuring the component.

- [ ] LT-100: Migrate `module-catalog` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, component catalog. Has a spec — keep it green against
  `/test/module-catalog`.
  **Iteration note (2026-09-25):** the ADR 0039 migration pattern — add the `.tsx` beside the
  retained `.ts` twin (the twin declares its own `HTMLElementTagNameMap` entry), point
  `examples/main.ts` at the generated client, spec green on every surface
  (`bun run test:variants <tag>`), zero warnings, tier + reason recorded in the handoff. The
  compiled sheet stays tag-led for now; LT-306's codemod converts it with the rest. **Depends on LT-312.**

- [ ] LT-103: Migrate `module-scrollarea` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~104 lines, scroll area with `IntersectionObserver`. Has a spec. Watch for: the
  effect-with-cleanup idiom (`watch` + `return () => observer.disconnect()`, the LT-069
  acceptance case). **This component drove ADR 0029's three-tier shape and its tier is the thing
  to verify.** It reads `scrollLeft`/`scrollTop`/`scrollWidth`/`offsetWidth`/`scrollHeight`/
  `offsetHeight` and emits exclusively through `bindState(internals, …)`. **Expected tier:
  Folded** — the geometry reads live in scroll/observer callbacks and the
  `bindState(internals, …)` output never reaches served HTML (Static is equally acceptable; both
  are never simulated, so the ~2.3 s is unpaid either way). **Simulated is the outcome to
  investigate:** at 1,966–2,091 occurrences it reproduces the ~2.3 s ADR 0029 exists to avoid —
  either reshape the migrated component so its reads stay in client-only positions (per its
  demonstrated patterns) or surface the over-signal in NOTES.md. Record the actual tier, the
  reason, and the wall-time figures either way; only wrong served HTML is a correctness bug.
  **Iteration note (2026-09-25):** the ADR 0039 migration pattern — add the `.tsx` beside the
  retained `.ts` twin (the twin declares its own `HTMLElementTagNameMap` entry), point
  `examples/main.ts` at the generated client, spec green on every surface
  (`bun run test:variants <tag>`), zero warnings, tier + reason recorded in the handoff. The
  compiled sheet stays tag-led for now; LT-306's codemod converts it with the rest. **Depends on LT-291 and LT-307** (above).

### Parallel slot — the LT-258 riders

- [ ] LT-313: Check a server-data `@for`'s iterable against the partial-readiness invariant (LT-258 review). **Gate: before LT-257.**
  **Skill:** le-truc-dev
  **Context:** LT-258's `checkFoldInputs` covers every server-evaluated position except one:
  the iterable of a server-data loop, because `EachForIR` carries only `iterableText`, not a
  node. Verified at review: `{[...document.querySelectorAll('a')].map(a => <li>{a.href}</li>)}`
  compiles clean and classifies Folded, so the loop's item set is the build page's DOM. Add the
  iterable's `AstNode` to `EachForIR`, populated by both front ends. Adding an IR field before
  first publish is free under ADR 0034 s8 and ADR 0040, and the task has to land before LT-254
  anyway. Then check it in `checkFoldInputs` as an always-evaluated position. **Channel:**
  compiler. **Tier:** 1 Prevented. It reuses LTC054, so no new copy is needed beyond the
  `where` phrase (e.g. "the items of a loop"). Tech Writer reviews that phrase.
  **Check:** the probe above fails with LTC054 on both surfaces; the corpus is unchanged.

- [ ] LT-314: `crypto.randomUUID()`/`getRandomValues()` fold silently — close the impure-ambient gap (LT-258 review).
  **Skill:** le-truc-dev
  **Context:** `impureAmbientCauses` (`evaluability.ts`) flags `Math.random()` as `rng` but
  not `crypto`, which sits in `JS_GLOBALS`. Verified at review: `<span id={crypto.randomUUID()}>`
  compiles clean and classifies Folded, which bakes one build-time random id into the page. That
  is exactly the hazard LTC033 exists for. Add `crypto.randomUUID`/`crypto.getRandomValues` to
  the `rng` cause, so static positions get LTC033 and reactive ones are omitted, following the
  existing precedent. This is not the partial-readiness invariant: the RNG is unresolvable, not
  page context. **Channel:** compiler. **Tier:** 1 Prevented (existing LTC033, whose copy
  already names "a random id").
  **Check:** the probe errors LTC033 in a static position and omits in a reactive one; the
  corpus is unchanged.
