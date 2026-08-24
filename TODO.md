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

- [ ] LT-022: Restructure `analyze.ts`'s monolithic `analyzeClient` into explicit passes over a shared context (architecture deepening, deferred from LT-021)
  **Skill:** le-truc-dev
  **Context:** `analyzeClient` (~1400 of `analyze.ts`'s 1951 lines) is one function with ~25 nested closures sharing implicit state — none of its passes (selector addressing, `@for`→`each()` planning, reactive-list→`reconcile()` planning, harvest-plan selection, effect emission) are independently readable or testable. Thread the shared state through an explicit context object (mirroring `compiler.ts`'s own `ExtractContext` pattern) and split each pass into its own module.
  **Check:** Each extracted pass is independently unit-testable against a constructed context object. `analyzeClient`'s public contract (`ClientPlan` shape, diagnostics) is unchanged, verified by the existing `server/tests/tsrx` suite passing unmodified.

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

- [ ] LT-036: `recordSites` doesn't credit `style-map`/`class-map` usage as a harvest site (spurious TSRX004 on signals used only there)
  **Skill:** le-truc-dev
  **Context:** A `deriveCell`/`createCell` used only inside a `style-map` or `class-map` attribute thunk isn't recognized as "rendered into the DOM" — `recordSites` (`analyze.ts`) only credits `reactive`-kind attrs and lazy text children, so TSRX004 ("signal never rendered") fires even though the signal genuinely is rendered, just through a path the tracker doesn't know about. Found and worked around twice now without a task: once during `style-map`/`class-map` review (LT-028/LT-031), and again migrating `card-colorscale.tsrx` (LT-033, worked around by using plain non-signal setup functions instead of a `deriveCell`, since that component didn't need the caching). Low priority — always has a workaround — but worth closing since it'll keep resurfacing as more `style-map`/`class-map` usage lands.
  **Check:** A signal used only inside a `style-map` or `class-map` thunk compiles without TSRX004. Existing TSRX004 true-positive cases (a signal genuinely never rendered anywhere) still fire.

- [x] LT-037: `plain-imports.ts` never traces `'server'`-kind attribute expressions, so a plain import used only there is mis-diagnosed as unused and dropped from the server module (LT-034 review) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Added an `attr.kind === 'server'` branch (yielding `attr.node`) to `walkServerExprs` in `plain-imports.ts`, mirroring how `walkClientExprs` already walks `walkAttrs` for its own dynamic kinds — `'server'`-kind attributes are always emitted server-side unconditionally in `emit-server.ts`, so they belong in the always-server-rendered bucket, not the scope-gated `walkServerRenderedThunks` one. Did not change `emit-server.ts`'s unconditional-emission behavior itself (the "consider separately" note in this task's original write-up) — left alone since `'server'`-kind attrs are also produced by the `@for` hoisted-const rebinding mechanism (LT-002/LT-003), which may rely on the current unconditional emission; out of scope for this fix.
  **Check:** New `plain-imports.test.ts` case (`data-x={helper(count)}`): lands in the server module only, no TSRX014. `check:tsrx` 14/14 clean. `bun test src/tests server/tests` 1328 pass (2 known pre-existing flaky failures in `build-effect.test.ts`, confirmed 9/9 pass in isolation, unrelated). Lint/biome clean.

- [x] LT-038: `watch()` overload resolution fails for a lazy child whose expression is an arbitrary call/member expression, not thunk-wrapped automatically (found migrating `card-colorscale.tsrx`, LT-034) — done ✓
  **Skill:** le-truc-dev
  **Summary:** `lazyWatchSource` (`analyze.ts`) now auto-wraps any lazy-child expression that isn't an `Identifier`, a string `Literal`, or already an `ArrowFunctionExpression` in an arrow thunk (`() => ${child.exprText}`) before emission — the compiler now does automatically what `card-colorscale.tsrx`'s manual `&{() => formatHex(host.value)}` workaround already proved works. An already-authored arrow thunk is left as-is (not double-wrapped). Server-side rendering (`emit-server.ts`'s `lazyValueExpression`) is unaffected — it works off the original parsed `expr` node directly, not this client-side string, and already has its own `dependenciesOf(...).isSubsetOf(scope)` gate from LT-034.
  **Check:** New `server/tests/tsrx/lazy-watch-source.test.ts` (2 tests: bare `CallExpression` auto-wraps, explicit arrow thunk isn't double-wrapped). `check:tsrx` 14/14 clean. `bun test src/tests server/tests` 1328 pass (2 known pre-existing flaky failures, unrelated). Lint/biome clean.
