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

### Gate and hygiene (first; parallel with each other)

- [x] LT-291: A compiled parent must register a variant set's SERVED surface, not its retained twin (LT-283 review follow-up; ADR 0039). **Gate: before the first wave-4 migration that retains a twin whose tag a compiled component references.** — done
  **Skill:** le-truc-dev
  **Context:** `compileCorpus` seeds `childImports` from the sibling modules
  (`examples/**/*.ts`) and keeps them over the generated client: "a tag in a dual state —
  compiled AND its hand-written twin still on disk — keeps the TWIN's module: the twin is
  what main.ts registers". ADR 0039 inverts that premise. The twin is the artifact of record
  and is never served, while `examples/main.ts` imports the generated client. So a compiled
  parent referencing a twin-carrying tag (a `pass()` target, or a compose-import child tag)
  would emit a side-effect import of the twin. The bundle would then define the tag twice,
  or ship the unselected surface. The premise holds only for a tag that is not compiled at
  all.
  **Ruling (Architect, this review):** two concerns, two channels.
  - **Runtime registration** always follows the served surface: a compiled tag's child
    import is `./<tag>.client`, whether or not a twin exists.
  - **Type visibility** needs no separate channel any more. ADR 0039 s4 as amended
    2026-09-24 (LT-237) has every member declare its own `HTMLElementTagNameMap` entry,
    so the served client that `./<tag>.client` imports already carries it for the
    parent's `first()`/`pass()` sites. (This superseded the earlier ruling here: a
    types-only channel to a twin-owned entry.)

  Record the served-surface rule in the `childImports` comment.
  **Channel:** none new. This fixes the emitter and the corpus orchestration.
  **Check:** a fixture with a retained twin that a compiled parent references bundles with
  exactly one `customElements.define` for the tag, from the generated client; check:corpus
  still reports a mistyped `pass()` prop on that tag (the types channel is live); goldens
  unchanged for twin-less tags.
  **Iteration note (2026-09-25):** gates **LT-103** in this iteration: `module-codeblock.tsx`
  renders a raw `<module-scrollarea>`, so once scrollarea is migrated with its `.ts` twin
  retained, a compiled parent references a twin-carrying tag. Confirm at pickup whether raw
  dashed tags seed `childImports` as compose imports do, and cover whichever path does. LT-285
  left a tripwire pin in `dual-corpus.test.ts` that fails as soon as a corpus source outside
  `examples/basic/counter/` references `basic-counter`; this task retires it for the real
  assertion.
  **Done (2026-09-25):** `compileCorpus` now sets `./<tag>.client` for every compiled tag,
  overriding the sibling twin's module; the served-surface rule is recorded in the
  `childImports` comment. Pickup answer: a raw dashed tag seeds a child import only when a
  query addresses it (`addQuery`: a `first()` ref or a `truc:pass` target, the same path a
  compose child takes). A bare `<module-scrollarea>` with no binding imports nothing, and
  `main.ts` registers it. Both paths read the same `childImports` map, so the one fix covers
  them. The tripwire pin is gone. In its place, `dual-corpus.test.ts` has a compiled parent
  that holds a `first('basic-counter')` ref beside the live counter set. The test asserts
  that the parent's client imports `./basic-counter.client`, that a `Bun.build` bundle has
  exactly one `defineComponent('basic-counter'…)` and no twin, and that tsc passes on
  `counter.count` but reports a mistyped `counter.cuont`. The fixture uses a `first()` ref,
  not `truc:pass`: basic-counter's `count` is read-only (LTC012), so it cannot be a legal
  pass target. The test fails on the old code. `check:corpus` passes and the client goldens
  are unchanged.

- [x] LT-292: A `variantOverrides` entry that names no variant set is a configuration error (LT-283 review follow-up). — done
  **Skill:** le-truc-dev
  **Context:** `compileCorpus` applies `config.variantOverrides[tag]` only inside a variant
  set. An override for a tag with one authored source, or for no tag at all (a renamed or
  deleted component, or a typo that is still tag-shaped), is silently ignored. That is the
  failure LT-273 ruled out for unknown keys: "it compiled, but nothing is where I asked".
  Validation cannot catch it at config-load time, because the variant sets are only known
  after the scan. So check after the LTC048 pre-check and throw the LT-273-style config
  error, naming the file, the key (`variantOverrides["<tag>"]`), and the reason ("no
  variant set declares this tag" / "only one surface authors it"). **Channel:** config
  validation, a thrown startup error, untiered by construction like LT-273 (ADR 0028). No
  `LTC` code applies, because no component source is at fault. Also consider whether a
  corpus-wide `variantSurface` with no variant sets present deserves the same treatment.
  The recommended answer is no: it is a policy default, not a pointer.
  **Check:** unit tests in `corpus-config.test.ts`/`dual-corpus.test.ts` for both
  stale-override shapes; the repo corpus (no overrides) is unaffected.
  **Done (2026-09-25):** added `validateVariantOverrides(config, sourcesByTag)` in
  `corpus-config.ts`. `compileCorpus` calls it right after the LTC048 pre-check. It throws
  `le-truc.config.json: "variantOverrides["<tag>"]" names no variant set — no variant set
  declares this tag.` or `… — only one surface authors it (<source>).` A tag with several
  sources that are not a set is left to LTC048. Following the recommendation, a corpus-wide
  `variantSurface` with no sets present is not an error, and a test pins that. Tests: three
  unit tests in `corpus-config.test.ts` and one end-to-end test in `dual-corpus.test.ts`
  covering both stale shapes. `check:corpus` is unaffected. The rule is documented in
  LE_TRUC_COMPILER.md § 7.1. The message copy is new config-error text; it is not in
  `errors.ts` or a TSRX code, but Tech Writer may want to review it.

- [x] LT-312: Generate the `.tsx` → `.tsrx` compose-import typings — done
  **Skill:** le-truc-dev
  **Context:** `server/compiler/frontend/tsx/tsrx-imports.d.ts` (LT-096) hand-lists one
  `declare module '*/<tag>.tsrx'` per `.tsrx` child that a `.tsx` parent composes, typed through
  the generated server module's args. The next migration composing a still-`.tsrx` child
  (module-list, form-colorgraph) would add entries by hand, and a wildcard pattern colliding
  across two same-named files would mistype silently. Emit the file from the registry during the
  corpus compile, one entry per compiled `.tsrx` source keyed by its path suffix, and have
  `examples/tsconfig.json` include the generated file. Acceptance: deleting the hand-written
  file leaves `bunx tsc -p examples/tsconfig.json` green.
  **Iteration note (2026-09-25):** gates **LT-098** (composes `basic-number`) and **LT-100**
  (composes `form-spinbutton` and `basic-button`) in this iteration: both are `.tsx` parents
  over `.tsrx`-only children. Land it before either, so neither migration hand-edits the file.
  **Done (2026-09-25):** new module `server/compiler/tsrx-imports.ts`, which `compileCorpus`
  calls to write `<outDir>/tsrx-imports.d.ts` after `registry.json`. The file has one ambient
  `declare module` per compiled `.tsrx` source, typed through the tag's SERVED server
  module's `render<Name>` args. A variant set's unserved `.tsrx` member is listed as well,
  with one contract per tag. Each key is the shortest path suffix that no other source
  shares: `*/basic-button.tsrx` today, lengthening only when two sources share a file name.
  So a collision now surfaces as a loud "cannot find module" instead of a silent mistype.
  Entries are sorted, so the file is stable across compile orders. It is always written,
  even with no entries, so the tsconfig include never dangles. The hand-written file is
  deleted and `examples/tsconfig.json` now includes
  `../server/generated/components/tsrx-imports.d.ts`. Acceptance holds:
  `bunx tsc -p examples/tsconfig.json` is green. A probe with a bogus `BasicButton` arg
  in module-codeblock fails with TS2322. `typecheck` and `check:corpus` are green. Tests
  are in the new `tsrx-imports.test.ts`: generator unit tests, plus a corpus compile over
  basic-button and the counter variant set. Documented in LE_TRUC_COMPILER.md § 7.

- [x] LT-307: Derive the simulation pass's demo-markup path from the component folder, not by rewriting `.tsrx` (LT-188 review finding). **Land before any Simulated-tier component's served surface becomes `.tsx`.** — done ✓
  **Skill:** docs-server-dev
  **Context:** `simulationSubjects()` in `server/effects/simulate.ts` builds `markupPath` as
  `entry.source.replace(/\.tsrx$/, '.html')`. For a `.tsx`-sourced entry (the default served
  surface since ADR 0039 — `basic-counter` already is one) the regex misses and `markupPath` IS
  the `.tsx` source, which exists, so `readMarkup` returns TypeScript and `occurrencesOf` finds
  whatever JSX literals happen to parse as the tag — silently wrong input, no assertion fires.
  No symptom today only because every Simulated-tier entry is still `.tsrx`-sourced. Fix: derive
  `<dir>/<tag>.html` from the source's folder and the tag (the demo file's own naming rule),
  independent of the source's extension; `.ts` twins included.
  **Channel:** none new — a missing demo file keeps reporting through `withoutMarkup`.
  Acceptance: a `.tsx`-sourced Simulated entry resolves to its `.html` sibling (pin with the
  `readMarkup` seam capturing `subject.markupPath`), a `.tsrx` one still does; `bun test server`
  green.
  **Iteration note (2026-09-25):** gates **LT-103** in this iteration — Simulated is the tier
  that migration must investigate, and it would be the first `.tsx`-served Simulated entry.
  **Changed:** `simulationSubjects()` in `server/effects/simulate.ts` now builds `markupPath` as
  `<dir of entry.source>/<tag>.html` (`join(root, dirname(entry.source), tag + '.html')`). LT-096 had already widened the old
  regex to `\.tsr?x$`, so `.tsx` resolved correctly; `.ts` twins and sources whose file name
  is not the tag did not, and now do. The new test in `simulate.test.ts` pins both cases
  through the `readMarkup` seam; the existing `.tsx`/`.tsrx` pin still passes. Updated the
  rule in SERVER.md.

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
