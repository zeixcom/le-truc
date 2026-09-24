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

Pruned empty 2026-09-21 (Changelog Keeper, after the 2026-09-21 iteration opened): the
2026-09-18/21 entries — LT-239/240/241, LT-263, LT-265/267, LT-255/256, LT-271/272 and the
closed P0–P7 bands — are consumed. The integrator-visible facts are in
`CHANGELOG.md [Unreleased]` (jsdom optional peer + absent-substrate routing, the two-prefix
`LTC`/`TSRX` skill vocabulary); the rulings live in `adr/0027`–`adr/0037`,
`server/compiler/VOCABULARY_LEDGER.md` and `LE_TRUC_COMPILER.md` §2; and every live handoff is
restated in the owning `TODO.md`/`BACKLOG.md` entry (LT-254's `runtimeImport` default flip,
LT-257's emitter-interface rescope, LT-273's validation + channel ruling, LT-277's glob edges,
LT-278's ADR duty, LT-279's SERVER.md/TESTS.md re-pin). Full entry text: `git log -p -- DONE.md`.

**Standing note for compiler-adjacent tasks:** a compiler crash during a corpus build makes
`typecheck`'s `&&`-chained `tsc` silently skip — check the exit code, never grep for
"error TS" (LT-226 review).

---

Pruned again 2026-09-21 (Architect, owner direction: `CHANGELOG.md [Unreleased]` carries
everything public-facing, so keep only what a future task still needs): **LT-273** (the
consumer-facing behavior is the CHANGELOG entry; the provenance-header disposition lives in
`VOCABULARY_LEDGER.md` §6; the design in [ADR 0036](adr/0036-corpus-configuration-surface.md)),
**LT-278** ([ADR 0038](adr/0038-runtime-neutral-build-path.md) is the record),
**LT-279** (`server/SERVER.md` and `server/TESTS.md` carry it), and **LT-178** (the
retirement ruling is verbatim in AGENTS.md's `pass()` bullet and the CHANGELOG Removed
entry; its OPEN Tech Writer copy rider moved to LT-189 item 11). Full entry text:
`git log -p -- DONE.md`.

- [x] LT-238: Relax "one authored source per component tag" to a canonical-plus-variants rule — reviewed ✓
  **Ruling:** build-selected variants, `.tsx` served by default — recorded in
  [ADR 0039](adr/0039-canonical-plus-variants-authored-surfaces.md) (amends ADR 0032 s6 by
  reference). Implementation: LT-283, LT-284, LT-285 (all below).

- [x] LT-283: Variant sets in the corpus scan — compile-both/serve-selected, LTC048 narrowed, LTC051 added, surface-selection config — reviewed ✓
  **Changed (for Changelog Keeper):** `le-truc.config.json` accepts `variantSurface`
  (`"tsx"`|`"tsrx"`, default `"tsx"`) and `variantOverrides` (tag → surface), both validated
  per LT-273; LTC048 narrowed to "not a folder-local variant set"; new error LTC051 (a
  variant set's members compile to different CSS). One registry entry per tag, and its
  `source` names the served member. Commit 4d15eac6.
  **Review (Architect, 2026-09-23):** approved. The ADR 0039 shape is implemented as ruled:
  grouping by folder-local base name, all-dropped semantics for both rules, and the compose
  registry keeping both source-keyed entries. Live handoffs: **LT-293** (the Tech Writer
  handoff was never executed), **LT-290** (the gate line's "check:corpus green" was the
  warning baseline, not the exit code, which was 2), **LT-291** (`childImports` prefers a
  retained twin over the served client, which is wrong under ADR 0039), **LT-292** (stale
  `variantOverrides` are silently ignored), and the LT-237 parity rider (build-time
  equivalence is CSS-only). **Gate-reading rule, recorded nowhere else:** a handoff's
  `check:corpus` claim is its exit code.

- [x] LT-213: Dynamic `<{expression}>` tags — reject on both surfaces (scope A0) — reviewed ✓
  **Changed (for Changelog Keeper):** new compile error **LTC053**. An element tag that is not
  a static name used to lower silently to `tag: ""`. Now it fails the compile on both
  surfaces: the `.tsrx` dynamic `<{expr}>…</{expr}>`, and in `.tsx` any namespaced
  (`<truc:element>`) or member (`<a.b>`) tag. It is raised in the shared `lowerElement`,
  so host root, nested, `@for`/`map` bodies and branch arms are all covered. The fix-it
  names each surface's conditional spelling: `@if … @else` in `.tsrx` (the ternary is
  TSRX022 there), the ternary in `.tsx` (`SurfaceWording.conditionalTag`). Compose
  dispatch is unchanged.
  **Ruling (owner, 2026-09-24):** scope A0 — reject now. The server-known-tag design is
  recorded but built only when a migration needs it: (1) only a server-known tag
  expression (literal, server arg, `i18n`), folded so the client sees a static element;
  (2) HTML element names only — no dashed names, no `script`/`style`/`template`/`iframe`,
  no void-with-children; (3) `first()`/CSS address it by class/id/`data-*`, never by tag;
  (4) `.tsx` spells it `<truc:element tag={…}>`, not React's `const Tag = …; <Tag>`
  (collides with PascalCase compose dispatch); (5) IR `tag: { kind: 'static', name } |
  { kind: 'server', exprText }`.
  **Review (Architect, 2026-09-24):** approved. Channel compiler, tier 1 Prevented, as
  specified. A probe confirmed that host-root, member and map-body placements all raise
  LTC053. Live handoffs: **LT-303** must exempt `truc:try` from LTC053 in
  `lower-shared.ts` (recorded there). **Copy (Tech Writer, 2026-09-24):** final LTC053
  wording in `diagnostics.ts`, plus new rows in `errors.md` and the `LE_TRUC_COMPILER.md`
  `TemplateNode` table.

- [x] LT-212: `@for`'s `@empty` arm, on both surfaces and both loop paths — reviewed ✓
  **Changed (for Changelog Keeper):** `.tsrx` `@for (…) { … } @empty { … }` and the `.tsx`
  empty-state idiom `{xs.length === 0 ? <empty/> : xs.map(…)}` now compile. Before this, `.tsrx`
  rejected `@empty` (LTC005), and `.tsx` compiled the ternary+map shape with no diagnostic but
  **silently dropped the loop**. A `.map()` in any other conditional arm is now LTC005. Over
  server data the arm renders when the loop renders no item. Over a reactive List it is always
  rendered in the container with `data-unreconciled`, and the client toggles `hidden` from the
  List's `length`. The arm is client-inert (LTC005 otherwise). Emitted output for components
  without an arm is unchanged.
  **Rulings (owner, 2026-09-24; recorded nowhere else):** (1) `.tsx` pays the cost too (ADR 0032
  s6, no exception): the idiom is recognized by SHAPE, like the switch IIFE. The test must
  compare the map receiver's own `length` to `0`, and it is never evaluated as an `if`
  condition, which is what lets it cover a reactive List. (2) `@empty` has its own IR
  (`emptyArm`), not a desugaring to `@if` + `@for`. The shared conditional+loop shape is
  mis-addressed on both surfaces (LT-301). (3) The arm's roots sit in the template tree as the
  loop output's following siblings, so selector resolution, id checks and prose checks cover them
  by construction, and the server emitter defers them into the loop.
  **Review (Architect, 2026-09-24):** approved. It matches ADR 0037 s5 (toggle path, out of the
  keyed arm space) and ADR 0040 s1 (the reserved field, produced without reshaping). The
  premise correction was the right call: the task's "`.tsx` needs no new spelling" was false at
  HEAD. Live handoffs: **LT-300** (Tech Writer: the three new LTC005 phrases), **LT-301** (the
  loop-in-branch mis-addressing, plus an authored `hidden` on a reactive-List arm root that is
  emitted twice), **LT-302** (arg names that shadow the render harness). Not proven: no browser run
  of the toggle, because no corpus component uses `@empty` yet. The first migration that does
  owes a spec leg for the empty→filled→empty cycle.

- [x] LT-298: The `.tsx` front end dropped the args parameter's type annotation, so every arg read as untyped — done ✓
  **Changed (for Changelog Keeper):** `server/compiler/frontend/tsx/to-estree.ts` closes
  three conversion gaps that made `.tsx` differ silently from `.tsrx`. (1) The args
  parameter annotation is now converted, so `.tsx` gets the right harvest parsers
  (`basic-counter` counted `"42" + 1 = "421"`), arg optionality, `string` attribute channels,
  LTC032, and a typed render signature. (2) Exported `type`/`interface` declarations are now
  converted, so `.tsx` clients get `defineComponent<Props>`. (3) The key of a renamed or
  nested destructure is now read from the property name, so `.tsx` sees the reserved `i18n`
  arg. Parity pins each variant pair's derived client facts. Its `AUTHORED_ARGS_DRIFT` set
  (listbox/combobox) removes its own entries when they stop drifting; LT-237 reconciles them.
  **Closed 2026-09-24:** the owner ran `bun run test:variants` and `bun run test`, and both
  are green.

- [x] LT-285: The three-spelling exemplar — `basic-counter`'s `.ts` twin restored as a variant (the LT-238 exit criterion) — done ✓
  **Changed:** `examples/basic/counter/` carries `.ts`, `.tsrx` and `.tsx` for one tag. The
  twin is byte-identical to its pre-deletion self and owns the `HTMLElementTagNameMap`
  entry. The CEM leaves the twin out while its component is compiled (`isVariantTwin`,
  `custom-elements-manifest.config.mjs`). The twin restore landed in 640922d5 (titled
  LT-284); this task adds the live pins in `dual-corpus.test.ts`.
  **Live handoff:** `childImports` resolves `basic-counter` to the twin, not the served
  client. That is **LT-291**, and a tripwire pin fails as soon as a corpus source outside the
  folder references the tag.
  **Closed 2026-09-24:** `bun run test:variants basic-counter` is green on all three
  surfaces (owner run).

- [x] LT-286: ForIR → `EachForIR | ReconcileForIR`, with the `@empty` reservation and the key-clause rule (ADR 0040 s1) — reviewed ✓
  **Changed (for Changelog Keeper):** the compiler contract (`contract.ts`) now exports
  `EachForIR` and `ReconcileForIR` next to the `ForIR` union, and loops are discriminated by
  `kind: 'each' | 'reconcile'`. New error **LTC052**: a `key` clause on a `@for` over server
  data fails the build. The clause used to be silently dropped. It is tier 1 Prevented and
  fires in the `.tsrx` front end only: `.tsx` has no spelling for a key on a server-data
  `map`, and a third `map` callback parameter stays LTC005. Emitted output is byte-identical.
  **Review (Architect, 2026-09-24):** approved. It matches ADR 0040 s1 as ruled.
  `iterableText`/`iterableName` went each-only, following the ADR over the task text (reconcile
  never read them). The plan maps are member-typed, so reading the wrong map is a type error.
  Live handoffs: **LT-212** (produce `emptyArm`) and **LT-299** (`effects.ts`'s residual
  `loopFor(…) as ForIR` null cast).
  **Copy (Tech Writer, 2026-09-24):** LTC052 final wording is in `diagnostics.ts`, and the
  `errors.md` row was applied by the owner.

- [x] LT-294: Point the CEM at the corpus output directory — done ✓
  **Changed:** `custom-elements-manifest.config.mjs` derives its client glob from the corpus
  configuration's `outDir` (a `bun -e` subprocess into `server/corpus-sources.ts`, because
  `cem` runs under Node), so a `le-truc.config.json` `outDir` is honoured.
  `custom-elements.json` is gitignored, so no manifest diff exists. **Residue:** two example
  demo comments (`form-radiogroup.html`, `form-colorgraph.html`) still name
  `server/generated/tsrx/`. That is folded into LT-299.

- [x] LT-284: Per-surface test-route serving + the variant spec matrix (LT-238/ADR 0039 s2) — reviewed ✓
  **Changed:** `/test/:component?surface=ts|tsrx|tsx` and `/test/:component/surface.js`
  (`server/serve.ts`); `{{ test-script }}` slot in `docs-src/layouts/test.html`; the
  unserved member's client under `variants/<tag>.<surface>.client.ts`, with
  `relocateClientSpecifiers` (`server/corpus-compile.ts`); `bun run test:variants`
  (`scripts/test-variants.ts`); `server/SERVER.md`.
  **Rulings (recorded nowhere else):** (1) surface selection is **server-side**: specs keep
  hard-coding `/test/<tag>`, and the runner sets `TEST_SURFACE` per server process. That is
  ADR 0039 s2's "unchanged spec" in its purest form, so specs never learn about surfaces.
  (2) "Defined once" holds **by construction**: the surface bundle is the `main.ts` graph
  with the tag's canonical client emptied and one module appended, not a per-surface
  bundle. (3) The runner refuses to start while port 3000 is taken, because Playwright's
  `reuseExistingServer` would otherwise test the default page.
  **Review (Architect, 2026-09-23):** design approved. **Unproven gate:** no run of
  `test:variants` exists yet (the sandbox can't bind a port), so the Check "spec passes
  against all three surfaces" moves to LT-285's Check, which already requires it green ×3.
  Follow-ups: LT-295 (CI runs the matrix), LT-296 (stale `variants/` clients; the vacuous
  surface tests).

- [x] LT-290: `argsFromAttrs` re-emits Parser fallbacks that read `first()` refs out of scope (LT-194 defect) — done ✓
  **Changed:** `server/compiler/emit-server.ts`: a Parser prop keeps its attribute channel
  in the page-occurrence helper only when its fallback's free names resolve at module scope
  (JS globals, harness exports, server imports). Otherwise a present attribute leaves the
  occurrence authored (`unrenderable-args`), and a required prop withholds the helper.
  `form-spinbutton` is the only live case (`value`/`min`/`max`/`step`/`bigStep` lose their
  channel). `LE_TRUC_COMPILER.md` § 5.3 amended; Architect read the wording at close-out and
  it matches the code. Commit 6ce64761; `check:corpus` exits 0 again.
  **Ruling (recorded nowhere else):** declaring the ref stub inside the helper was rejected,
  because a `refStub` value would reach the markup (§ 8). Follow-up: LT-297 (camelCase
  attribute keys).

- [x] LT-293: Propagate the LT-283 variant-set rule and LTC051 through the docs and the error copy — done ✓
  **Changed (for Changelog Keeper):** final copy for LTC048 (the fix names the variant-set
  shape: one source per surface, one base name, one directory) and LTC051 (no artifact of
  the set is written; copy the served member's styles into the others), plus the
  `errors.md` rows. `HOST_PROFILE.md` and `LE_TRUC_COMPILER.md` §§ 1, 6, 7, 7.1 now state
  the variant-set rule and the `variantSurface`/`variantOverrides` keys. It landed inside
  640922d5 (titled LT-284). The § 7 `variants/` sentence became true in the same commit.

- [x] LT-235: Wave-4 type-level design session — IR discriminated unions, pass contracts (review §2.6–2.7) — reviewed ✓
  **Ruling:** [ADR 0040](adr/0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md)
  (🔄 Proposed; owner rulings 2026-09-21). Implementation: LT-286 (ForIR — this iteration,
  gates LT-212), and LT-287/288/289 (SignalIR, first()/expose(), pass contracts — BACKLOG
  P2b); item (e) stays LT-244.
  **Review (Architect, 2026-09-23):** approved. The ADR's "Related → Tasks" line cited
  LT-283–LT-286, which collided with LT-238's implementation IDs; it is corrected to
  LT-286–LT-289. The `LE_TRUC_COMPILER.md` §4 amendment had described the ruled shapes as
  landed; it now states today's shape plus each *target shape* with its landing task. **Live
  handoff:** each of LT-286/287/289 flips its own §4 passage to present tense when it lands.

- [x] LT-266: Measure the size bet — emitted bytes for the same component authored in Le Truc and in React — reviewed ✓
  **Ruling (recorded nowhere else):** the bet holds, and the margin is the **runtime, not
  the payload** — 8.72 vs 64.38 kB gzip runtime, while the payload line (3.07 vs 8.54)
  favours React and never flips. **Any connector claim quotes BOTH lines** (totals
  18.61/16.53 gzip/brotli vs React 19.3's 68.62/59.21; run of record in
  `spike/size-bet/FINDING.md`). This is the REQUIREMENTS §1 acceptance number for any
  future hydration-blob proposal.

- [x] LT-179: Remove the explicit factory return contract and `forEachUnseen` (ADR 0018 v3.0 milestone) — reviewed ✓
  **Trap (recorded nowhere else):** one `src/tests/reactive.test.ts` assertion is worded
  to pass under either the pre- or post-LT-178 spelling — a leftover of a parallel
  session's in-flight `swapSlots` edit reverted so the branch landed pure. Tightening it
  is free once the LT-178 copy rider (LT-189 item 11) settles the final wording.

- [x] LT-188: Load the composed-children closure before the simulation pass renders (LT-169 review finding) — reviewed ✓
  **Skill:** docs-server-dev
  **Changed:** `server/effects/simulate.ts` — the realm now LOADS each Simulated subject plus the
  transitive `composesTags` closure over the registry (children-first, de-duplicated against
  `realm.loadedTags`, unregistered tags skipped), whatever the children's tier; the RENDER set
  is unchanged. A pass that throws before its report prints the captured diagnostics first.
  Build-internal; no changelog line.
  **Review:** Approved. Ruling recorded nowhere else: a Folded/Static child in the closure now
  runs its connect inside the realm, so its diagnostics land in the build report attributed to
  the rendering parent — intended (it is what the browser runs) and gated like any other entry.
  Follow-up LT-307 (the `.tsx` markup-path derivation found in review) must land before any
  Simulated-tier component migrates to a `.tsx` source.
