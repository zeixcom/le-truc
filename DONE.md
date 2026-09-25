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

Pruned 2026-09-25 (Architect, after the "opening wave 4" iteration closed; Changelog Keeper had
already merged it into `CHANGELOG.md [Unreleased]`). Consumed with nothing left to carry:
**LT-238, LT-283, LT-284, LT-285, LT-286, LT-293, LT-294, LT-298, LT-235, LT-237,
LT-315**. Their rulings live in [ADR 0039](adr/0039-canonical-plus-variants-authored-surfaces.md)
(s4 as amended 2026-09-24), [ADR 0040](adr/0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md),
`server/SERVER.md` § Component test surfaces (LT-284's surface selection), and
`LE_TRUC_COMPILER.md` §§ 4, 5.3, 7. Every live handoff is restated in its own open entry:
LT-287/LT-289 (§ 4 present-tense flips), LT-291 (with LT-285's tripwire pin), LT-292, LT-295,
LT-296, LT-297, LT-299, LT-308. Earlier prunes: 2026-09-21 ×2 (LT-239–LT-279 era, LT-178). Full
entry text: `git log -p -- DONE.md`.

**Standing notes for compiler-adjacent tasks:**
- A compiler crash during a corpus build makes `typecheck`'s `&&`-chained `tsc` silently skip.
  Check the exit code, never grep for "error TS" (LT-226 review).
- A handoff's `check:corpus` claim is its **exit code**, not the warning baseline (LT-283
  review, after a "green" gate turned out to be exit 2).

---

- [x] LT-291: A compiled parent registers a variant set's SERVED surface, not its retained twin — reviewed ✓
  **Changed:** `compileCorpus` sets `childImports[tag] = ./<tag>.client` for every compiled tag,
  overriding the sibling twin's module; only an uncompiled tag keeps its hand-written module.
  LT-285's tripwire pin is retired for a real fixture in `dual-corpus.test.ts` (one
  `defineComponent('basic-counter')` per bundle, from the generated client; a mistyped child
  prop still fails tsc). Internal build fix, no changelog entry.
  **For the migrations (recorded nowhere else):** a raw dashed tag seeds a child import only
  when a query addresses it (`first()` ref or `truc:pass` target, `addQuery`); a bare
  `<module-scrollarea>` with no binding imports nothing and is registered by `main.ts`. Type
  visibility rides the same import (ADR 0039 s4). Clears the gate on LT-103.

- [x] LT-292: A `variantOverrides` entry that names no variant set is a configuration error — reviewed ✓
  **Changed:** `validateVariantOverrides()` (`server/compiler/corpus-config.ts`), called by
  `compileCorpus` after the LTC048 pre-check, throws `le-truc.config.json:
  "variantOverrides["<tag>"]" names no variant set — …` for a tag no source declares, or one only
  a single surface authors. A multi-source non-set is left to LTC048. Documented in
  LE_TRUC_COMPILER.md § 7.1. Consumer-visible: a stale override now fails the build.
  **Ruling (recorded nowhere else):** a corpus-wide `variantSurface` with no variant set present
  is NOT an error — a policy default, not a pointer (pinned by a test). The copy is config-error
  text outside `errors.ts`/`TSRX`, so the Tech Writer handoff is optional, as for LT-273.

- [x] LT-312: Generate the `.tsx` → `.tsrx` compose-import typings — reviewed ✓
  **Changed:** `server/compiler/tsrx-imports.ts` (new); `compileCorpus` writes
  `<outDir>/tsrx-imports.d.ts` after `registry.json`, one ambient `declare module` per compiled
  `.tsrx` source typed through its tag's served `render<Name>` args. The hand-written
  `server/compiler/frontend/tsx/tsrx-imports.d.ts` is deleted; `examples/tsconfig.json` includes
  the generated file. Documented in LE_TRUC_COMPILER.md § 7.
  **Rulings (recorded nowhere else):** keys are the shortest path suffix no other listed source
  shares (`*/basic-button.tsrx`, lengthening only on a shared file name), so a collision is a loud
  "cannot find module", never a silent mistype. A variant set's unserved `.tsrx` member is listed
  too, typed through the served module (one contract per tag). The file is always written, even
  empty, so the tsconfig include never dangles. It needs a corpus build first, like every
  generated-module import: `typecheck.test.ts`'s examples leg relies on CI's `typecheck` step
  building the corpus before `test:server`. A consumer project's authored-`.tsx` tsconfig
  includes `<outDir>/tsrx-imports.d.ts` beside `host-profile.d.ts`. Clears the gates on LT-098
  and LT-100 — neither migration touches the typings.

- [x] LT-307: Derive the simulation pass's demo-markup path from the component folder — reviewed ✓
  **Changed:** `simulationSubjects()` (`server/effects/simulate.ts`) resolves `markupPath` as
  `<dir of entry.source>/<tag>.html`, independent of extension. LT-096 had already widened the
  regex to `.tsx`; `.ts` twins and sources whose file name is not the tag now resolve too.
  SERVER.md updated. Internal fix, no changelog entry. Clears the gate on LT-103.

- [x] LT-296: Surface-route hardening: stale `variants/` clients and vacuous surface tests — reviewed ✓
  **Changed:** `compileCorpus` owns `variants/`: each run deletes every client there it did
  not write (a dissolved set, a flipped `variantOverrides`, an LTC051-dropped set, a member
  that stopped compiling). The runtime seam gains `removeFile` (Bun + Node).
  `serve.test.ts`'s surface legs now throw without a corpus build and pin `?surface=X` → 200
  iff `basic-counter.X` is authored. Internal tooling, no changelog entry.
  **Ruling (recorded nowhere else):** the canonical directory is deliberately NOT pruned — the
  route serves a canonical client only when `registry.json` selects that surface, so a
  stale canonical file cannot 200. Verified by the owner (2026-09-25): `serve.test.ts` passes
  with a corpus build and fails without.

- [x] LT-295: Run the variant spec matrix in CI (ADR 0039 s2) — reviewed ✓
  **Changed:** `ci-cd.yml` `test` job gains a "Run variant spec matrix" step
  (`bun run test:variants --no-build`) after "Run tests"; `scripts/test-variants.ts` gains
  `--no-build` (runner-owned, not forwarded to Playwright). Internal tooling, no changelog entry.
  **Open verification (recorded nowhere else):** not run locally, because the agent sandbox cannot bind
  a port. CI triggers only on pushes and PRs to `main`/`next`, not on `v3`, so the first proof
  is the next PR's run. It must list all five sets (basic-counter, basic-pluralize,
  form-combobox, form-listbox, module-codeblock), and a throwaway broken `.ts` twin must fail
  the job on surface "ts". Every migration in this iteration (LT-098–LT-103) adds a set, so
  its handoff's `test:variants` claim also stands as a local proof of the runner.

- [x] LT-299: Hygiene sweep from the 2026-09-24 review — reviewed ✓
  **Changed:** `emitTopEffects` drops the last `as ForIR` cast; `ForIRBase.emptyArm` doc now
  states both front ends and ADR 0040 s1's shared-roots placement; two demo comments point to
  `server/generated/components/`. Item (a) needed no change (`biome check ./server` already 0).

- [x] LT-207: Stop the simulation realm's dependency-wait timers from leaking past teardown — reviewed ✓
  **Ruling (recorded nowhere else):** timer ownership is process-wide, not realm-scoped — ANY
  host timer scheduled while a realm is open is cancelled at `dispose()`. That is safe because
  `build.ts` runs `simulateCorpus()` only for one-shot builds. A future task that opens a realm
  inside a long-lived process (dev server, watch rebuilds) must revisit this.

- [x] LT-258: Make the partial-readiness invariant a compiler check (LTC054) — reviewed ✓
  **Rulings (Architect, 2026-09-25; recorded nowhere else):**
  - **A folded reactive thunk that reads page context is an error, not an omission.** LTC033's
    omit-the-reactive-form precedent does not transfer: `Date.now()` is *unresolvable* (no tier
    has an answer), while a page-context read is *realm-answerable*, so omitting it would
    silently re-route the component Folded → Simulated and out of template emission (ADR 0035
    s2) — the quiet foreclosure ADR 0034 s4 exists to prevent. A thunk only errors when the
    server would actually fold it.
  - **The page-context side is an explicit deny-list** (`PAGE_CONTEXT_GLOBALS` in
    `server/compiler/fold-inputs.ts`); the positive side is closed by `assertFoldScopeClosed`.
    Together they make the invariant checkable without a pure-globals allow-list over
    `JS_GLOBALS`. LT-313 and LT-314 extend this, and must keep that split.

- [x] LT-096: Migrate `module-codeblock` to `.tsx` with same-commit cutover — reviewed ✓
  **For the next migrations:** the tier prediction was wrong (predicted Simulated, landed
  **Folded, no routing signals**): refs used only in `watch`/`on` never route. The compiler now
  emits `base:not(<child-tag> *)` for a synthesized selector that a composed child's markup
  could match; `ElementFromSelector` ignores pseudo-class arguments.
  **Rulings (2026-09-25):** the `:not(<tag> *)` exclusion is accepted — its only miss is an own
  element inside a same-tag ancestor of the host, which no composition produces. **No
  compiler-stamped hash class for addressing:** the component's occurrences are page-authored
  (fence schema, tab fragments) and never pass through the compiler's render, so a stamped hook
  would be absent exactly where the enhancer must bind, and it would put a compiler-versioned
  token into the hand-authoring contract (the move ADR 0033 declined for styles).
  **Live handoffs:** LT-309, LT-310, LT-311, LT-312.

- [x] LT-212: `@for`'s `@empty` arm, on both surfaces and both loop paths — reviewed ✓
  **Ruling (owner, 2026-09-24):** `.tsx` pays the cost too (ADR 0032 s6, no exception) — the
  empty-state idiom is recognized by shape, and its test is never evaluated as an `if`
  condition, which is what lets it cover a reactive List. The IR shape is ADR 0040 s1's.
  **Open obligation:** no browser run of the reactive-List toggle exists, because no corpus
  component uses `@empty` yet. **The first migration that does owes a spec leg for the
  empty → filled → empty cycle.** Live handoffs: LT-300, LT-301, LT-302.

- [x] LT-213: Dynamic `<{expression}>` tags — reject on both surfaces (LTC053, scope A0) — reviewed ✓
  **Ruling (owner, 2026-09-24):** reject now. [ADR 0041](adr/0041-truc-intrinsic-elements-for-compiler-consumed-constructs.md)
  records `<truc:element tag={…}>` (server-known HTML element names only), built when a migration
  needs it. **Recorded only here, for that task:** `first()`/CSS address such an element by
  class/id/`data-*`, never by tag; `.tsx` does not use React's `const Tag = …; <Tag>` (collides
  with PascalCase compose dispatch); the IR shape is `tag: { kind: 'static', name } |
  { kind: 'server', exprText }`. Live handoff: LT-303 exempts `truc:try` from LTC053 (recorded
  there).

- [x] LT-188: Load the composed-children closure before the simulation pass renders — reviewed ✓
  **Ruling (recorded nowhere else):** a Folded/Static child in the closure now runs its connect
  inside the realm, so its diagnostics land in the build report attributed to the rendering
  parent. That is intended (it is what the browser runs) and gated like any other entry.
  Live handoff: LT-307 (in the current iteration).

- [x] LT-266: Measure the size bet — reviewed ✓
  **Ruling (recorded nowhere else):** the bet holds, and the margin is the **runtime, not the
  payload** (8.72 vs 64.38 kB gzip runtime; the payload line, 3.07 vs 8.54, favours React and
  never flips). **Any connector claim quotes BOTH lines.** Run of record:
  `spike/size-bet/FINDING.md`. It is the REQUIREMENTS §1 acceptance number for any future
  hydration-blob proposal.

- [x] LT-290: `argsFromAttrs` re-emits Parser fallbacks that read `first()` refs out of scope — done ✓
  **Ruling (recorded nowhere else):** declaring the ref stub inside the page-occurrence helper
  was rejected, because a `refStub` value would reach the markup (§ 8). Live handoff: LT-297.

- [x] LT-179: Remove the explicit factory return contract and `forEachUnseen` — reviewed ✓
  **Trap (recorded nowhere else):** one `src/tests/reactive.test.ts` assertion is worded to pass
  under either the pre- or post-LT-178 spelling. Tightening it is free once the LT-178 copy
  rider (LT-189 item 11) settles the final wording.
