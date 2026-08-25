# TODO

- [x] LT-001: Inlined TSRX compiler — emitter core (ADR 0024 milestone 1) — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** Built the in-repo compiler (`server/tsrx/`) on pinned `@tsrx/core` 0.1.60 — parses `.tsrx`, emits server HTML render functions, extracts verbatim tag-scoped CSS, maintains the component registry; wired into `server/build.ts`. Golden-tested against the hand-written `.html`/`.css` artifacts.

- [x] LT-002: Inlined TSRX compiler — client codegen, sanctioned subset (ADR 0024 milestone 2) — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** Generates `defineComponent()` factories from the same sources (bindings, events, refs, server-data `@for` + `each()`, hoisted-const rebinding, harvest rules). Golden-tested against the hand-written trio; typechecks via emit-then-check.

- [x] LT-005: Isomorphic format for form components — extensions, attribute-driven props, `internals` (ADR 0024 acceptance gate) — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** Added `export const config` for extension activation (`formAssociated`/`observedAttributes`), Parser-exposed attribute-driven `expose()` props, `internals`/`defineMethod()` support — unblocking form-component authoring in `.tsrx` (ADR 0024 sub-design 8).

- [x] LT-006: Custom Element Manifest generation for `.tsrx` components (ADR 0024 acceptance gate) — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** Generated clients now carry the component JSDoc verbatim so `@custom-elements-manifest/analyzer` + `@zeix/cem-plugin-le-truc` extract identically from compiled output; corpus compiles before `cem analyze`. Equivalence golden-tested (ADR 0024 sub-design 9).

- [x] LT-003: Reactive lists — `@for` over a `List` → template extraction + `reconcile()` (ADR 0024 milestone 3) — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** Server renders keyed items in place plus an extracted `<template>`; client lowers to `reconcile()` with a generated `bindItem`. Un-gated `module-list.tsrx`.

- [x] LT-004: Type-flow wiring — Volar projection + editor tooling (ADR 0024 milestone 4) — reviewed ✓ (approach reconsidered → LT-011)
  **Skill:** le-truc-dev
  **Summary:** Delivered `globals.d.ts`'s ambient contract, child-module side-effect imports, and emit-then-check in CI. The Volar-projection half proved infeasible (`createVolarMappingsResult` is transform-coupled to Ripple's own esrap output) and was reshaped into LT-011 (CLI-first span tables).

- [x] LT-008: Form-corpus migration enablers — arg→DOM harvest substitution, `@if`, setup side-effects — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** Added arg→DOM-site substitution harvest, `@if` conditional templates (union addressing), client-only setup side-effect statements, a `formAssociatedCheckbox` fixture, and more parser ambients — unblocking `form-textbox`/`form-checkbox` migration.

- [x] LT-009: `verify:cem` duplicate-tag guard — done ✓
  **Summary:** `scripts/verify-cem.ts` now fails with an exclude hint on duplicate `tagName` across declarations.

- [x] LT-010: Template-literal-safe reindentation in codegen — done ✓
  **Summary:** `server/tsrx/indent.ts` correctly reindents generated code around template literals, nested interpolation, and comments.

- [x] LT-013: tsrx.dev feature parity — `@switch`, `@try` error boundaries, `html={expr}`, parse-error hints — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** Added `@switch`, sync `@try`/`@catch` error boundaries, server-side sanitized `html={expr}` dynamic rendering, and parse-error hints for unsupported newer-grammar constructs — every tsrx.dev feature now handled deliberately (supported or gated).

- [x] LT-011: Type-flow diagnostics — CLI-first span-table mapping (ADR 0024 milestone 4, reconsidered) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Compiler records a span table mapping generated code back to `.tsrx` source; new `check:tsrx` CLI runs `tsc` and remaps diagnostics to authored line:col. Editor-level (LSP) diagnostics deferred to LT-014.

- [x] LT-015: Component composition — server-side PascalCase invocation (ADR 0024 sub-design 10) — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** A capitalized JSX tag bound to a `.tsrx` import composes that component server-side (splices its `render<Name>()` output); top-level attributes forward as typed server args.

- [x] LT-016: Explicit `pass={{ ... }}` special attribute — unify client-prop dispatch (ADR 0024 sub-design 10, amends sub-design 4) — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** Replaced shape-inferred client-prop dispatch with one explicit `pass={{ }}` attribute for both raw and composed custom-element targets. Composed-element `pass` requires an explicit `ref` (known limitation: can't address a duplicated composed child).

- [x] LT-017: Two-way `pass()` codegen — wire `{ get, set }` descriptor entries (ADR 0024 sub-design 4/10) — reviewed ✓
  **Summary:** `pass={{ prop: { get, set } }}` now emits real two-way bindings; getter-only shorthand unchanged.

- [x] LT-018: Children — `{children}` insertion point (ADR 0024 sub-design 10) — done ✓
  **Skill:** le-truc-dev
  **Summary:** A composed element's children substitute into the child's bare `{children}` expression, rendered unescaped; a missing required `children` argument is a real type error.

- [x] LT-019: Extend `check:tsrx` to type-check generated server modules (ADR 0024 sub-design 10, extends LT-011) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Generated server modules are now type-checked too, so a missing/mistyped composed server arg or child is a real compile error, not silent.

- [x] LT-020: Migrate `module-list`/`form-textbox` example to real composition (ADR 0024 sub-design 10, proof) — done ✓
  **Skill:** le-truc-dev
  **Summary:** `module-list.tsrx` composes `<FormTextbox>` instead of hand-duplicating its markup. Fixed two pre-existing compiler bugs only surfaced by real composition (pass-1 registry was empty; ref-only composed elements weren't addressed).

- [x] LT-012: Async boundaries via `isPending` routing (ADR 0024 sub-design 13) — done ✓ (residue queued as LT-025)
  **Skill:** le-truc-dev
  **Summary:** `@try`/`@pending`/`@catch` routes on `isPending(signal)`; all three arms server-render and are `hidden`-toggled client-side via one `watch()` call — mirroring `module-lazyload.ts`'s hand-written shape.

- [x] LT-021: Split `compiler.ts` into locality-focused sibling modules (architecture deepening) — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** Extracted `ast-utils.ts`, `infer-type.ts`, `classify-attributes.ts`, `lower-template.ts`, `config.ts` from a 2363-line `compiler.ts` (now 811 lines). `analyze.ts`'s own monolithic-function problem deferred to LT-022.

- [x] LT-023: Optional `@if` branches (no `@else`) + hoisted event-handler consts (ADR 0024 sub-design 11) — done ✓
  **Skill:** le-truc-dev
  **Summary:** A single-branch `@if` now addresses via a non-throwing `first()` (`'maybe'` cardinality); hoisted setup consts usable as shared event handlers across branches. Fixed a latent branch-root selector-uniqueness bug along the way.

- [x] LT-024: Widen arg→DOM-site substitution to any descendant attribute + multiple args per initializer (ADR 0024 sub-design 12) — done ✓
  **Skill:** le-truc-dev
  **Summary:** A signal's client harvest can trace multiple arg identifiers to any descendant's rendered attribute, not just the root's one. `form-textbox.tsrx`'s reactive `description` reaches full hand-written parity.

- [x] LT-026: Migrate `examples/basic/*` (button, hello, number, pluralize, gauge) to TSRX — done ✓
  **Skill:** le-truc-dev
  **Summary:** Converted all five `examples/basic/*` components, exercising patterns the original 5-component corpus never hit. Found and fixed two real compiler defects (Parser-exposed lazy-child rendering; `freeIdentifiers` mishandling TS type positions, split to LT-027). `basic-gauge` drops its live CSS-custom-property updates pending LT-028/LT-029.

- [x] LT-027: `freeIdentifiers` doesn't recognize TS type-annotation positions, causing spurious TSRX004 (found migrating `basic-gauge.tsrx`) — done ✓
  **Summary:** `freeIdentifiers`'s generic AST walk no longer treats type annotations/casts as value reads, fixing false-positive `badFreeNames` rejections.

---

- [x] LT-030: Merge `feat/bindings-multiple-overloads` — map-form `bind*()` overloads — done ✓
  **Skill:** le-truc-dev
  **Summary:** Merged into `docs/server-components` (4 conflicts resolved: adr-index, CHANGELOG, package.json, docs-src restructure). Delivered `bindStyle`/`bindAttribute`/`bindClass`/`bindProperty`/`bindState` array-target overloads exactly matching LT-029's proposed shape, with full test coverage — no gaps to close.

- [x] LT-029: Add map-form overloads to `bindStyle()`/`bindAttribute()`/`bindClass()`/`bindProperty()` (`src/bindings.ts`) — done ✓ (delivered by LT-030's merge)
  **Skill:** le-truc-dev
  **Summary:** Verified the merged implementation against the proposed signatures and semantics — exact match, including test coverage for multi-target `ok`, per-key/`nil` clearing, and `bindProperty`'s partial-patch behavior. No net-new work needed.

- [x] LT-028: No sanctioned `.tsrx` lowering for reactive host-level style/CSS-custom-property updates — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** Added a `style-map` `AttributeIR` kind (`classify-attributes.ts`) for `style={() => ({ … })}`, classified separately from `reactive` so it bypasses the custom-element gate — both on descendant elements and, newly, the component root itself (previously hard-blocked; now lowers to `watch(thunk, bindStyle(host, keys))` targeting the ambient `host`). Server-side renders the initial value via a new `styleAttr()` runtime helper. `basic-gauge.tsrx` migrated off its static-string workaround; ring color/rotation now update live, parity with the hand-written version. New tests in `server/tests/tsrx/style-map.test.ts`. Along the way, rebuilt the stale `types/` declarations (hadn't been regenerated since LT-030's merge), which was masking a real `tsc` failure in the new lowering.
  **Review:** Approved as implemented — correct and well-tested. Left two consistency gaps against the pre-existing `class-map` lowering, split out below as LT-031/LT-032. `bindProperty`/`bindAttribute`'s array forms and `bindState`'s map form are unaddressed in `.tsrx` too; see those tasks' rationale for why that's not the same kind of gap.

- [x] LT-031: Migrate `class-map`'s lowering to `bindClass`'s array-form overload — one `watch()` call instead of N — done ✓
  **Skill:** le-truc-dev
  **Summary:** Added a `watch-class` `TopEffectPlan` kind (`analyze.ts`, next to `watch-style`) carrying `{ query, keys, thunkText, … }`; `class-map`'s branch in `emitConstructEffects` now pushes one of these instead of looping per key. `emit-client.ts` lowers it to one `watch(thunk, bindClass(el, [keys]))` call. Behavior unchanged (per-token `Boolean()` coercion, absent-token-is-off — `bindClass`'s array form already implements this); pure codegen consolidation. `class-map`'s object-literal form had zero prior test coverage anywhere in the corpus — added `server/tests/tsrx/class-map.test.ts`.

- [x] LT-032: Extend the component-root reactive exemption to `class-map` (host-level class-map) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Extended the root's `style-map` exemption (`analyze.ts`'s `emitTopEffects`, `node === component.root` branch) to `class-map`, pushing a `watch-class` effect targeting `host` and dropping `class-map` from the root's forbidden-kinds list. Server-side: the root's own opening-tag builder (`emit-server.ts` `rootParts`, distinct from `emitElement`'s descendant path) had **no** existing class-map handling at all — root class-map was previously blocked outright, not just under-optimized — so this added a case rendering `attr('class', cls((thunk)()) || null)`, mirroring the `style-map` case beside it. Covered by `class-map.test.ts`'s root-level cases.

- [ ] LT-014: Type-flow diagnostics — Volar language-core plugin over the LT-011 span table (ADR 0024 milestone 4, stage 2)
  **Skill:** le-truc-dev
  **Context:** Scheduled after the `examples/` wholesale migration to `.tsrx` completes. CLI-first (LT-011) covers CI and AI-agent workflows; human authors still need in-editor squiggles. A `@volar/language-core` plugin projects the generated client module as the virtual file, reusing LT-011's span table — no new mapping mechanism. Trigger: last example in `examples/` ported to `.tsrx`.

- [x] LT-022: Restructure `analyze.ts`'s monolithic `analyzeClient` into explicit passes over a shared context (architecture deepening, deferred from LT-021; = move M5 of `server/tsrx/LE_TRUC_COMPILER.md` §7) — done ✓
  **Skill:** le-truc-dev
  **Summary:** `analyze.ts` (2,512 lines) is deleted; `server/tsrx/analysis/` now holds the client analysis: `plan.ts` (the whole plan vocabulary — `ClientPlan`/`QueryPlan`/`HarvestPlan`/`TopEffectPlan`/… — plus the `AnalysisContext` type and `analyzeClient` orchestration: builds the context, runs the passes in their original order, returns the plan), `selectors.ts` (pure selector engine: synthesis, structural uniqueness with the branch-exclusivity max/sum arithmetic, union addressing, `enclosingIfOf`, `loopFor`), `naming.ts` (`uniqueName`, `addQuery` as pure functions), `harvest.ts` (Passes 2+3: render sites incl. the LT-036 `thunkRendered` credit, harvest selection, `paramDomRead`, `substituteArgExpr` — plus the signal-read AST predicates shared with the other passes), `loops.ts` (Passes 1+1b: `each()` and `reconcile()` planning), `effects.ts` (Pass 4: the document-ordered effect walk with all structural handlers). The shared closure state (queries/harvests/effects/childTags/ambient/usedNames/refNames/forPlans/reconcilePlans + `addQuery`/`collectAmbient`/`badFreeNames`) is an explicit `AnalysisContext`; each pass destructures it at entry, so the ~1,800 lines of pass bodies moved VERBATIM (the transcription-risk-free path — one genuine slip, the custom-element reactive-attribute gate at `emitConstructEffects`' head, was caught immediately by the pass.test.ts golden and restored from git). `emit-client.ts`/`index.ts`/`smoke.ts` re-pointed to `./analysis/plan`.
  **Check:** New `server/tests/tsrx/analysis.test.ts` (4 tests: `runHarvest` alone, `runEffects` alone over a hand-constructed context, composed-vs-orchestrated agreement, selector engine independence). `bunx tsc --noEmit` clean; `bun test server/tests src/tests` 1355 pass / 1 known-flaky `file-watcher` timing test (passes in isolation); goldens + diagnostics byte-identical; `check:tsrx` 15/15; biome clean.

- [ ] LT-025: Async-boundary residue — reactive `html={() => …}`, optional addressing inside plain `@try` bodies, `createMemo` as a recognized signal constructor (split off LT-012)
  **Skill:** le-truc-dev
  **Context:** Three items deliberately not attempted in LT-012, each independent enough to stand alone: (1) `html={() => …}` reactive dynamic HTML has no client-side lowering (no sanitizer contract wired to compiler-generated code yet); (2) client constructs inside the plain sync `@try` body are still diagnosed TSRX005 — needs its own optional-addressing treatment, distinct from `@if`'s; (3) `createMemo` is not yet a recognized signal constructor (derived-over-`host`-prop-reads has no `paramDomRead` substitution site).
  **Check:** Each item ships its own test coverage and either a working lowering or a clear, actionable diagnostic — never silent mishandling.

- [x] LT-033: Migrate `examples/card/*` to TSRX, surface edge-cases/cliffs — done ✓
  **Skill:** le-truc-dev
  **Summary:** Migrated three of six `card/*` components cleanly: `card-collapsible.tsrx` (straightforward `expose`/`on`/`bindProperty` shape, one deviation: `open` becomes a Parser-exposed prop instead of DOM-harvested, per the `basic-button.tsrx` precedent); `card-callout.tsrx` and `card-blogpost.tsrx` — initially misjudged as "structural stubs, out of scope" since they have no client-side `.ts` file at all, but they're valid server-only TSRX components once composition doesn't require any `expose()`/`watch` (zero client behavior, just static/attribute-driven markup + `{children}` insertion — the reserved bare-identifier form from LT-018, previously unused anywhere in the corpus). Corrected after the user pointed out the gap. The other three hit a genuine compiler cliff each, none previously documented: `card-mediaqueries` needs `requestContext()` (Web Components context protocol has zero `.tsrx` support — no ambient, no lowering); `card-colorscale` needs plain (non-`.tsrx`) module imports for its color-math helpers (`config.ts`'s `parseComposeImports` only recognizes sibling-`.tsrx` imports — every other import is silently dropped, causing downstream `tsc` failures with no compiler-level diagnostic); `card-blogmeta` doesn't render a template at all — it reformats arbitrary, structurally-varying author-supplied light DOM at connect time, which doesn't fit `.tsrx`'s template-ownership model in any shape (no props to convert to, unlike the already-precedented missing-element-fallback deviation). All three left hand-written; full findings and options recorded in `NOTES.md` for architect triage into follow-up tasks/ADR notes.
  **Check:** `check:tsrx` compiles clean (13 components); `bun test src/tests server/tests` 1321 pass; lint clean.

- [x] LT-034: Import-placement inference for plain (non-`.tsrx`) imports (ADR 0024 sub-design 14) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New `server/tsrx/plain-imports.ts`: `parsePlainImports` collects every top-level `ImportDeclaration` not resolving to a `.tsrx` compose target, rewriting a relative specifier from "relative to the `.tsrx` source" to "relative to the flat `server/generated/tsrx/` output directory" (previously would have resolved to the wrong path even once placed). `placePlainImports` classifies each import's local bindings by free-identifier usage — reusing `dependenciesOf`/`freeIdentifiers` — into server-only/client-only/both, and pushes a new **TSRX014** warning for a bound name used nowhere detectable (dead import) instead of dropping it silently. A side-effect-only import (`import 'culori/css'`) has no bound name to trace, so it defaults to both (a missing side-effect import is a silent runtime bug, not a compile error — safer to over-include). Wired into `compiler.ts` (`ComponentIR.imports: {server, client, serverLocalNames}`) and spliced into the generated headers in `emit-server.ts`/`emit-client.ts`.
  Three additional pre-existing bugs surfaced and fixed along the way, all blocking `card-colorscale.tsrx`'s re-migration (the task's own acceptance case) and none previously caught since no prior example exercised these shapes: (1) `emit-server.ts`'s `lazyValueExpression` rendered a lazy child's fallback-case expression (anything past a bare signal identifier or string-literal prop name — e.g. `&{formatHex(host.value)}`) verbatim server-side with no server-known check, unlike attribute thunks which already have one — a lazy child referencing `host` broke with "Cannot find name 'host'"; now gated by the same `dependenciesOf(...).isSubsetOf(scope)` check, rendering `''` when not server-known (client corrects on connect, same DOM-is-truth posture as an omitted thunk attribute). (2) Plain (non-signal) setup consts were documented everywhere (`ast-utils.ts`, `diagnostics.ts`) as emitted verbatim into *both* generated modules, but `emit-client.ts` never actually did — only `emit-server.ts` did; new `ComponentIR.plainSetup` (a tracked subset of `setup`) plus `computeClientNeededNames()` (a fixpoint over which plain consts are transitively reachable from an always-client-emitted position) now emits exactly the client-needed subset — found this makes a real difference: `form-textbox.tsrx`'s `validatable` const (referenced only from an `@if` condition, i.e. genuinely server-only) is correctly *excluded* from the client module, while a `style-map`-referenced helper is correctly *included*. (3) The `exposeArgNode` `any`-stub (LT-019) unconditionally stubbed any custom Parser factory name (e.g. `asOklch`) not in the small hardcoded `PARSER_FACTORIES` set, shadowing a real resolvable import with `const asOklch: any = undefined` — now skips stubbing a name already covered by a placed server import.
  `card-colorscale.tsrx` re-migrated with its real `culori/fn` + local-helper imports (no workaround functions needed for the import gap itself; still uses plain non-`deriveCell` helpers to sidestep the separate, still-open LT-036 harvest-site gap). New `server/tests/tsrx/plain-imports.test.ts` (6 tests: server-only, client-only, both, relative-specifier rewriting, unused-import diagnostic, side-effect-only default).
  **Check:** `check:tsrx` compiles 14/14 clean (corpus + re-migrated `card-colorscale`). `bun test src/tests server/tests` 1326 pass (1 known pre-existing flaky test, confirmed passes in isolation). Lint/biome clean.

- [x] LT-035: Context protocol support — `requestContext()`/`provideContexts()` in `.tsrx` (ADR 0024 sub-design 15) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Consumer side: `requestContext(Context, fallback)` is now a recognized setup-declaration call form (`compiler.ts`, handled as its own branch before the `SIGNAL_CONSTRUCTORS` check, since its emission differs in both generated modules) — registered as a `SignalIR` with `constructor: 'requestContext'` so all existing signal-identifier lowering (reactive attrs, lazy children, `.get()`) treats it exactly like `createCell`/`deriveCell` downstream. The fallback argument must be server-known (validated against params + prior setup names; TSRX016 otherwise) and a 2-argument call shape is required (TSRX015 otherwise). Server rendering substitutes `createCell(fallback)` for the whole call (`emit-server.ts`) — `requestContext` itself has no server behavior (it dispatches a DOM event against `host`) — and is exempted from the TSRX004 harvest-site requirement entirely (`analyze.ts`): the client never harvests a context signal's initial value from DOM, it re-dispatches the context-request itself. Provider side: `provideContexts`/`requestContext` both added to `CONTEXT_NAMES` (`ast-utils.ts`), which is reused everywhere free-name gates already treat `host`/`internals` as client-only-resolvable — `provideContexts([...])` as a bare setup statement needed no other compiler.ts changes, since the existing "client-only setup side effect" statement mechanism (LT-008) already handles arbitrary bare calls whose free names are all recognized ambients. Both names also added to `CLIENT_ONLY_PRIMITIVES` (defensive TSRX013 guard against nesting either inside a plain setup const, which would otherwise try to run client-only code server-side). `globals.d.ts` gained matching `declare const` ambients (required by the existing vocabulary-parity coverage test) using `FactoryContext<Record<string, unknown>>` member types.
  `card-mediaqueries.tsrx` re-migrated as the acceptance case, but required RESHAPING, not just a source-of-truth swap: the hand-written original is a light-DOM ENHANCER (queries page-author-supplied `.motion`/`.theme`/etc. elements), which `.tsrx`'s template-ownership model can't express — same category of mismatch as `card-blogmeta` (NOTES.md), except here a workable prop conversion existed (a `label` prop replaces the page author's own heading). This is a real behavior change and leaves the demo `.html`/e2e spec stale (flagged in a new NOTES.md entry for architect: update them to match, or revert this one component to hand-written like `card-blogmeta`).
  **Check:** New `server/tests/tsrx/context.test.ts` (9 tests: consumer fallback+client-correction, reactive attr referencing a context signal, 3 misuse diagnostics, provider bare-statement lowering, factory-destructuring not module-import, provider misuse diagnostic). `globals.test.ts` passes (parity + tsc probe against the new ambients). `check:tsrx` compiles 15/15 clean (corpus + re-migrated `card-mediaqueries`). `bun test src/tests server/tests` 1339 pass (1 known pre-existing flaky test in `build-effect.test.ts`, unrelated). Lint/biome clean on all touched files.

- [x] LT-036: `recordSites` doesn't credit `style-map`/`class-map` usage as a harvest site (spurious TSRX004 on signals used only there) — done ✓
  **Skill:** le-truc-dev
  **Summary:** `recordSites` (`analyze.ts`) now credits any signal read via `sig.get()` inside a `style-map`/`class-map` object — and, discovered while reproducing, inside a **computed reactive thunk** (`title={() => prefix.get() + '!'}`), which had the identical spurious TSRX004 — into a new `thunkRendered` set (new local helper `containsSignalGet`, composed with the existing `isSignalGetCall`). These credits are deliberately NOT harvest sites: the object/thunk can't be spliced back into an initializer. Instead Pass 3's no-direct-site branch now allows verbatim initializer reuse for credited signals (`substituteArgExpr(init, isDerivedCallback || thunkRendered.has(name))`) — the same mechanism `deriveCell` callbacks already used, sound because both generated halves construct the cell from the identical initializer, so the rendered style/class/attribute agrees by construction. A pure `deriveCell` used only in a map thunk already compiled clean before this fix (forced verbatim route); the fix targets `createCell`/`createState`. Root and descendant (incl. custom-element) map forms both covered — the credit runs in the same attr loop that already handles the root. Remaining boundary (new NOTES.md entry): an initializer referencing plain setup consts/imports still falls to TSRX004 with a misleading message — the free-name gate can't widen without feeding harvest exprs into `computeClientNeededNames`. Regression tests: `style-map.test.ts` / `class-map.test.ts` ("signal used only inside the … thunk", root + descendant) + a NOT-TSRX004 boundary test in `diagnostics.test.ts` beside the true-positive.
  **Check:** Signal used only in a `style-map`/`class-map`/computed thunk compiles without TSRX004 (root + descendant, both map forms); client emits `createCell(<identical init>)` + the `bindStyle`/`bindClass` watch; TSRX004 true-positive (`ghost`, never rendered anywhere) still fires. `bun test src/tests server/tests` 1343 pass (1 known flaky `file-watcher.test.ts` timing test, passes in isolation). `check:tsrx` 15/15 clean. Lint/biome clean.

- [x] LT-037: `plain-imports.ts` never traces `'server'`-kind attribute expressions, so a plain import used only there is mis-diagnosed as unused and dropped from the server module (LT-034 review) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Added an `attr.kind === 'server'` branch (yielding `attr.node`) to `walkServerExprs` in `plain-imports.ts`, mirroring how `walkClientExprs` already walks `walkAttrs` for its own dynamic kinds — `'server'`-kind attributes are always emitted server-side unconditionally in `emit-server.ts`, so they belong in the always-server-rendered bucket, not the scope-gated `walkServerRenderedThunks` one. Did not change `emit-server.ts`'s unconditional-emission behavior itself (the "consider separately" note in this task's original write-up) — left alone since `'server'`-kind attrs are also produced by the `@for` hoisted-const rebinding mechanism (LT-002/LT-003), which may rely on the current unconditional emission; out of scope for this fix.
  **Check:** New `plain-imports.test.ts` case (`data-x={helper(count)}`): lands in the server module only, no TSRX014. `check:tsrx` 14/14 clean. `bun test src/tests server/tests` 1328 pass (2 known pre-existing flaky failures in `build-effect.test.ts`, confirmed 9/9 pass in isolation, unrelated). Lint/biome clean.

- [x] LT-038: `watch()` overload resolution fails for a lazy child whose expression is an arbitrary call/member expression, not thunk-wrapped automatically (found migrating `card-colorscale.tsrx`, LT-034) — done ✓
  **Skill:** le-truc-dev
  **Summary:** `lazyWatchSource` (`analyze.ts`) now auto-wraps any lazy-child expression that isn't an `Identifier`, a string `Literal`, or already an `ArrowFunctionExpression` in an arrow thunk (`() => ${child.exprText}`) before emission — the compiler now does automatically what `card-colorscale.tsrx`'s manual `&{() => formatHex(host.value)}` workaround already proved works. An already-authored arrow thunk is left as-is (not double-wrapped). Server-side rendering (`emit-server.ts`'s `lazyValueExpression`) is unaffected — it works off the original parsed `expr` node directly, not this client-side string, and already has its own `dependenciesOf(...).isSubsetOf(scope)` gate from LT-034.
  **Check:** New `server/tests/tsrx/lazy-watch-source.test.ts` (2 tests: bare `CallExpression` auto-wraps, explicit arrow thunk isn't double-wrapped). `check:tsrx` 14/14 clean. `bun test src/tests server/tests` 1328 pass (2 known pre-existing flaky failures, unrelated). Lint/biome clean.

- [x] LT-039: Extract the shared IR vocabulary into `ir.ts` (compiler regrouping M1, `server/tsrx/LE_TRUC_COMPILER.md` §7) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New leaf `server/tsrx/ir.ts` owns the whole IR vocabulary (`SourceRange`, `SetupStmt`, `SignalConstructor`, `SignalIR`, `TemplateNode`, `PassEntryIR`, `AttributeIR`, `ComposeAttrIR`, `ForIR`, `ConfigIR`, `ComponentIR`, `ExtractContext`) — type-only imports (`TsrxNode`, `CompileDiagnostic`), no runtime values. `compiler.ts` keeps only `CompileResult` (the front end's own return type) + the extraction code; all eight siblings (`analyze`, `plain-imports`, `lower-template`, `classify-attributes`, `emit-client`, `emit-server`, `config`, `index.ts`) and `compiler.test.ts` re-pointed from `./compiler` to `./ir`. The type-level hub-and-spoke is gone: no module imports types from the front end any more. (The compiler⇄lower-template VALUE cycle is deliberately untouched here — that's LT-040.)
  **Check:** `bunx tsc --noEmit -p tsconfig.json` clean; `bun test server/tests src/tests` 1344 pass / 0 fail (goldens byte-identical); `check:tsrx` 15/15; biome clean.

- [x] LT-040: Extract `core.ts` — single `@tsrx/core` value-import adapter; kill the compiler⇄lower-template value cycle (compiler regrouping M2) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New leaf `server/tsrx/core.ts` — a pure re-export of the five pinned VALUES (`parseModule`, `isStyleElement`, `getStyleElementStylesheet`, `isTemplateForOfNode`, `isVoidElement`), nothing else. `compiler.ts` now imports `parseModule`/`isStyleElement`/`getStyleElementStylesheet` from it and its `isForOfNode`/`isVoidTag` wrapper re-exports are DELETED; `lower-template.ts` calls `isTemplateForOfNode` directly (2 sites), `emit-server.ts` calls `isVoidElement` directly (5 sites). The compiler⇄lower-template runtime value cycle is gone — `lower-template.ts` no longer imports `compiler.ts` at all; no module imports both `compiler.ts` values and is imported by it except through types (`ir.ts`). Pin-isolation goal preserved: an `@tsrx/core` upgrade touches `core.ts` + `core-shim.d.ts` only. `SERVER.md` § TSRX Compiler module map updated for `core.ts` + `ir.ts`.
  **Check:** `grep isForOfNode|isVoidTag server/tsrx server/tests` → only `core.ts`'s historical comment; `bunx tsc --noEmit` clean; `bun test server/tests src/tests` 1344/0 (goldens byte-identical); `check:tsrx` 15/15; biome clean.

- [x] LT-041: De-duplicate shared predicates/helpers; bring `CONTEXT_HELPERS` under the vocabulary parity test (compiler regrouping M7) — done ✓
  **Skill:** le-truc-dev
  **Summary:** All six duplicate homes collapsed into ast-utils/spans: (1) `nodeType` moved to ast-utils (built on `isNode`); emit-server's `isTsrxNode` deleted (its only user, `hostPropMirrorExpr`, now delegates the pattern match to `hostPropOf`); (2) new `hostPropOf(thunk)` — the `() => host.<prop>` match shared by analyze's dispatch decision and emit-server's `hostPropMirrorExpr` (which keeps only the parserExposeProps/root-attr lookup); (3) `classMapKeys`/`styleMapKeys` → one `objectKeys(object, { allowStrings })`; (4) `sanitizeVarName` exported from ast-utils, emit-client's structurally-identical `ariaProperty` dash-case split now delegates to it; (5) emit-server's `reindent` moved VERBATIM to spans.ts (single-caller helper; deliberately NOT merged into `appendWithSpans` — detailed comparison found three real behavioral differences (first-line strip, `*`-exclusion in common-indent, fallback strip), so unifying would change golden bytes; both doc comments now state the precise difference, and the stale `pushStatement (emit-client)` reference is gone); (6) emit-client's local `CONTEXT_HELPERS` → ast-utils `FACTORY_CONTEXT_MEMBERS` (+ exported `FACTORY_CONTEXT_MEMBER_NAMES` literal). `globals.test.ts` gained a third parity test: type-level assertion that every listed member is a key of the REAL `FactoryContext<ComponentProps>` (checked by the standing tsc gate — a rename/removal in @zeix/le-truc now fails CI), runtime channel-split assertions (never signal constructors/parser factories), and the deliberate `expose` ambient overlap.
  **Check:** `bunx tsc --noEmit` clean (incl. the type-level subset assertion); `bun test server/tests src/tests` 1345 pass / 0 fail (goldens byte-identical — the ariaProperty delegation and reindent move are behavior-equal); `check:tsrx` 15/15; biome clean.

- [x] LT-042: Consolidate the bespoke `TemplateNode` walks into one `walk.ts` visitor (compiler regrouping M3) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New `server/tsrx/walk.ts`: `childNodes(node)` (the traversal table — element/compose children, `@if` branches, `@switch` arms, `@try` arms pending-last), `walkTemplate(node, visit, { intoPending, intoCompose })` (pre-order, parent-paired), and `collectAttrs(node, options)`. The two cross-cutting rules vary by consumer and are explicit options rather than per-walk re-implementations. Six genuinely-uniform walks migrated: plain-imports' four generators (`walkAttrs`/`walkServerExprs`/`walkClientExprs`/`walkServerRenderedThunks` → `collectAttrs` + `serverExprNodes`/`clientExprNodes`/`serverRenderedThunkNodes` — the originals' subtree-repeated yields fed only Set-building, so the name sets are provably unchanged), `collectComposeElements` (compiler.ts, `{intoCompose: false, intoPending: false}` + the original fors-driver preserved), and `collectRefs` (analyze, same options). The remaining walks are deliberately NOT visitor-ized — their recursion IS the semantics: selector-engine exclusivity counting (`countForSelector`/`countComposeBySource` max-vs-sum), element-chain-only searches (`parentOf`, `findHoleParent`, `findMirror`/`findAttrSite`, `gatedLazyChild`), depth-guarded `hasDeepConstruct`, control-flow-blind `hasClientConstructs`, loop-scoped `collectItemEvents`, pass-interleaved `recordSites`, and lower-template's validators — they regroup with their passes in LT-022. Discovered en route: `walkClientExprs` never traced compose `pass` thunks (a plain import used only there is invisible to placement) — preserved exactly, not silently "fixed".
  **Check:** New `server/tests/tsrx/walk.test.ts` (7 tests: visit order over every node kind incl. client-stmt/compose/pending, parent pairing, both options, `collectAttrs` under both options). `bunx tsc --noEmit` clean; `bun test server/tests src/tests` 1352/0 (goldens + diagnostics byte-identical); `check:tsrx` 15/15; biome clean.

- [x] LT-043: Single home for the server-known evaluability rule — `evaluability.ts` (compiler regrouping M4) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New leaf `server/tsrx/evaluability.ts` exporting `dependenciesOf` (free identifiers minus `JS_GLOBALS` — the three byte-identical copies in analyze/emit-server/plain-imports are deleted) and `isServerEvaluable(node, scope)` — the one gate behind what the server renders. All seven emit-server gate sites (lazy children, `html`, reactive attrs, element-level and root-level class/style maps) and plain-imports' `serverRenderedThunkNodes` now call `isServerEvaluable` directly; the "mirrors emit-server exactly" comment is now an actual shared implementation. The analyzer imports `dependenciesOf` for its client-portability checks (same helper, different scope vocabulary — documented in evaluability.ts's header).
  **Check:** `grep "const dependenciesOf" server/tsrx` → evaluability.ts only; `bunx tsc --noEmit` clean; `bun test server/tests src/tests` 1352/0 — server goldens byte-identical, proving the server render set is unchanged; `check:tsrx` 15/15; biome clean.

- [x] LT-044: Merge import handling into one module; remove `node:path` (compiler regrouping M6; browser-purity gate for ADR 0025) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New `server/tsrx/imports.ts` owns all source-import collection and placement: `parseComposeImports` (moved from `config.ts` — sibling-`.tsrx` compose targets) + `parsePlainImports`/`placePlainImports`/`computeClientNeededNames` (moved from `plain-imports.ts`, now deleted); `config.ts` keeps only `readConfig` as a single-purpose file. The package's only Node APIs are gone: `posix.dirname`/`join`/`normalize` replaced by three small pure-string helpers inside `imports.ts` (matching `posix.normalize` semantics, incl. leading-`..` preservation for relative paths and root-clamping for absolute ones) — the compiler is now browser-pure (ADR 0025 sub-design 6). One transcription slip during the move (an inverted `!specifier.endsWith('.tsrx')` filter that skipped every plain import) was caught immediately by the four plain-imports tests and fixed.
  **Check:** `grep "from 'node:" server/tsrx --include="*.ts"` → nothing (smoke.ts untouched, runtime.ts never had Node APIs); `bunx tsc --noEmit` clean; `bun test server/tests src/tests` 1356/0 (goldens byte-identical — the pure path helpers produce identical specifier rewrites); `check:tsrx` 15/15; biome clean.

- [ ] LT-045: Browser-bundle build + smoke test pinning compiler purity (ADR 0025 enabler)
  **Skill:** le-truc-dev
  **Context:** ADR 0025 embeds the compiler client-side, but nothing today stops a Node API from creeping back into `server/tsrx/`. Add a browser-target bundle of the compile pipeline (front end + analyze + both emitters + spans) and a test that compiles a fixture through the browser-shaped bundle and asserts the artifacts are identical to the Node-side compile of the same fixture. The bundle doubles as the seed of the playground's compile worker and lazy-loads from the docs site.
  **Check:** CI runs the browser smoke; a deliberately reintroduced `node:` import fails it; fixture artifacts byte-identical across the two contexts.

- [ ] LT-046: (Optional) Extend `walk.ts` coverage to the remaining bespoke `TemplateNode` walks — or document why not
  **Skill:** le-truc-dev
  **Context:** Post-LT-042/022 review (`server/tsrx/LE_TRUC_COMPILER.md` §7) found `walk.ts` covers only the uniform walks; `countForSelector`/`countComposeBySource` (branch-exclusivity counting), `parentOf`, `findHoleParent`, `findMirror`/`findAttrSite`, `hasDeepConstruct`, `recordSites`, and the list-body/composed-children validators remain bespoke recursion in `analysis/selectors.ts`, `analysis/loops.ts`, `analysis/harvest.ts`, `analysis/effects.ts`. Each has genuinely different traversal rules (early exit, exclusivity arithmetic, chain-only search) — assess whether any generalize cleanly onto `walkTemplate`'s visitor without losing that logic, or whether the current split is the right permanent shape and `walk.ts`'s doc comment is sufficient documentation (in which case close this as won't-do).
  **Check:** Either new walks land with goldens byte-identical, or a decision is recorded (ADR or a note in `LE_TRUC_COMPILER.md` §7) that the split stays.

- [ ] LT-047: Direct unit test for `evaluability.ts` (`dependenciesOf`/`isServerEvaluable`)
  **Skill:** le-truc-dev
  **Context:** `evaluability.ts` (LT-043) is the single home of the server-known dependency-closure rule that decides what the server renders — a divergence here is a wrong *component*, not a wrong diagnostic message. It's currently only exercised transitively through golden/diagnostic tests across `imports.ts`, `emit-server.ts`, and `analysis/harvest.ts`. Add a small direct test file pinning both functions against hand-built AST fixtures (server-known scope subset/superset cases, `JS_GLOBALS` exclusion).
  **Check:** New `server/tests/tsrx/evaluability.test.ts`; no change to existing goldens.

- [ ] LT-048: Standalone unit tests for `analysis/loops.ts` (`runLoops`) and `analysis/naming.ts`
  **Skill:** le-truc-dev
  **Context:** `server/tests/tsrx/analysis.test.ts` (from LT-022) covers `runHarvest`/`runEffects`/the selector engine at the "hand-build an `AnalysisContext`, call one pass" granularity, but `runLoops` (`each()`/`reconcile()` planning) and `naming.ts` (`addQuery`/`uniqueName`) have no equivalent — only indirect coverage via full `analyzeClient` through golden/feature tests. Add tests at the same granularity as the existing ones so a regression in loop/name planning fails locally instead of only via a golden diff.
  **Check:** `analysis.test.ts` gains `runLoops`/naming coverage; no change to existing goldens.

- [ ] LT-049: Delete unused `diagnostic.withLine` (`diagnostics.ts`)
  **Skill:** le-truc-dev
  **Context:** Post-refactor review found `diagnostic.withLine` (recomputes a diagnostic's line from a node offset) has no call sites anywhere in `server/tsrx/` or `server/tests/tsrx/` — dead code, likely superseded when the line-computing diagnostic factories (e.g. `contextFallbackNotServerKnown`) were added directly with `lineOf` inline. Confirm no external consumer via a repo-wide grep, then delete.
  **Check:** `grep -rn "withLine" server/` finds only the deletion diff; `bunx tsc --noEmit` clean; `bun test server/tests` unchanged.
