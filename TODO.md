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
  **Summary:** Merged into `docs/server-components` (4 conflicts resolved). Delivered `bindStyle`/`bindAttribute`/`bindClass`/`bindProperty`/`bindState` array-target overloads matching LT-029's proposed shape, full test coverage.

- [x] LT-029: Add map-form overloads to `bindStyle()`/`bindAttribute()`/`bindClass()`/`bindProperty()` (`src/bindings.ts`) — done ✓ (delivered by LT-030's merge)
  **Skill:** le-truc-dev
  **Summary:** Verified the merged implementation against the proposed signatures and semantics — exact match. No net-new work needed.

- [x] LT-028: No sanctioned `.tsrx` lowering for reactive host-level style/CSS-custom-property updates — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** Added a `style-map` `AttributeIR` kind for `style={() => ({ … })}`, bypassing the custom-element gate on both descendant elements and the component root (lowers to `watch(thunk, bindStyle(host, keys))`). Server-side renders the initial value via a new `styleAttr()` runtime helper. `basic-gauge.tsrx` migrated off its static-string workaround.
  **Review:** Approved. Left two consistency gaps against `class-map`, split out as LT-031/LT-032.

- [x] LT-031: Migrate `class-map`'s lowering to `bindClass`'s array-form overload — one `watch()` call instead of N — done ✓
  **Skill:** le-truc-dev
  **Summary:** Added a `watch-class` `TopEffectPlan` kind; `class-map` now pushes one of these instead of looping per key, lowering to one `watch(thunk, bindClass(el, [keys]))` call. Pure codegen consolidation, behavior unchanged.

- [x] LT-032: Extend the component-root reactive exemption to `class-map` (host-level class-map) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Extended the root's `style-map` exemption to `class-map` (previously blocked outright at the root, not just under-optimized); added matching root-level class rendering server-side.

- [ ] LT-014: Type-flow diagnostics — Volar language-core plugin over the LT-011 span table (ADR 0024 milestone 4, stage 2)
  **Skill:** le-truc-dev
  **Context:** Scheduled after the `examples/` wholesale migration to `.tsrx` completes. CLI-first (LT-011) covers CI and AI-agent workflows; human authors still need in-editor squiggles. A `@volar/language-core` plugin projects the generated client module as the virtual file, reusing LT-011's span table — no new mapping mechanism. Trigger: last example in `examples/` ported to `.tsrx`.

- [x] LT-022: Restructure `analyze.ts`'s monolithic `analyzeClient` into explicit passes over a shared context (architecture deepening, deferred from LT-021) — done ✓
  **Skill:** le-truc-dev
  **Summary:** `analyze.ts` (2,512 lines) deleted; `server/tsrx/analysis/` now holds `plan.ts` (plan vocabulary + orchestration), `selectors.ts`, `naming.ts`, `harvest.ts`, `loops.ts`, `effects.ts` — each pass over an explicit shared `AnalysisContext`, bodies moved verbatim to avoid transcription risk.

- [x] LT-025: Async-boundary residue — reactive `html={() => …}`, optional addressing inside plain `@try` bodies, `createMemo` as a recognized signal constructor (split off LT-012) — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** `html={() => …}` lowers to `watch(thunk, dangerouslyBindInnerHTML(el))` (ADR 0010 sanctioned sink); a plain `@try`'s body and `@catch` arm are each independently DOM-existence-guarded like a single-branch `@if`; `createMemo` added as a recognized signal constructor with a sync server shim, closing a latent host/internals-in-signal-compute crash shared with `deriveCell`/`deriveStore`.
  **Review:** Approved. Flagged that `.tsrx` authors had no syntax to opt IN to a client-side HTML sanitizer — filed as LT-050.

- [x] LT-033: Migrate `examples/card/*` to TSRX, surface edge-cases/cliffs — done ✓
  **Skill:** le-truc-dev
  **Summary:** Migrated `card-collapsible`, `card-callout`, `card-blogpost` cleanly (the latter two are valid server-only components via `{children}` insertion). Three genuine compiler cliffs surfaced and left hand-written: `card-mediaqueries` needs context protocol support, `card-colorscale` needs plain-module imports, `card-blogmeta` reformats arbitrary light DOM (doesn't fit the template-ownership model). Findings recorded in `NOTES.md` for triage.

- [x] LT-034: Import-placement inference for plain (non-`.tsrx`) imports (ADR 0024 sub-design 14) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New `plain-imports.ts` classifies every plain import's bindings by free-identifier usage into server-only/client-only/both, rewrites relative specifiers for the flat output directory, and warns on dead imports (TSRX014). Surfaced and fixed three pre-existing bugs blocking `card-colorscale`'s re-migration: unguarded server-known lazy-child fallback rendering, plain setup consts never actually reaching the client module despite being documented as verbatim-in-both, and a Parser-factory `any`-stub shadowing a resolvable import.

- [x] LT-035: Context protocol support — `requestContext()`/`provideContexts()` in `.tsrx` (ADR 0024 sub-design 15) — done ✓
  **Skill:** le-truc-dev
  **Summary:** `requestContext(Context, fallback)` is a recognized signal-constructor-like call (server-known fallback required, renders `createCell(fallback)` server-side, exempt from harvest-site requirements); `provideContexts([...])` joins the client-only ambient allowlist. `card-mediaqueries.tsrx` re-migrated as the acceptance case, reshaped from a light-DOM enhancer into a props-driven component (real behavior change, flagged for the stale demo/e2e spec).

- [x] LT-036: `recordSites` doesn't credit `style-map`/`class-map` usage as a harvest site (spurious TSRX004 on signals used only there) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Signals read inside a `style-map`/`class-map` object or a computed reactive thunk are now credited into a `thunkRendered` set, allowing verbatim initializer reuse instead of a false-positive TSRX004 — root and descendant map forms both covered.

- [x] LT-037: `plain-imports.ts` never traces `'server'`-kind attribute expressions, so a plain import used only there is mis-diagnosed as unused and dropped from the server module (LT-034 review) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Added a `'server'`-kind attribute branch to the server-expression walk so such imports land in the always-server-rendered bucket instead of being dropped.

- [x] LT-038: `watch()` overload resolution fails for a lazy child whose expression is an arbitrary call/member expression, not thunk-wrapped automatically (found migrating `card-colorscale.tsrx`, LT-034) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Any lazy-child expression that isn't a bare identifier, string literal, or already an arrow thunk now auto-wraps in one before emission — the compiler now does automatically what the manual `&{() => …}` workaround proved works.

- [x] LT-039: Extract the shared IR vocabulary into `ir.ts` (compiler regrouping M1) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New leaf `ir.ts` owns the whole IR vocabulary as type-only exports; all sibling modules re-pointed from `./compiler`, eliminating the type-level hub-and-spoke.

- [x] LT-040: Extract `core.ts` — single `@tsrx/core` value-import adapter; kill the compiler⇄lower-template value cycle (compiler regrouping M2) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New leaf `core.ts` re-exports the five pinned `@tsrx/core` values; `lower-template.ts`/`emit-server.ts` call them directly instead of through `compiler.ts` wrappers, removing the last runtime value cycle. Pin-isolation preserved: an upgrade now touches `core.ts` + `core-shim.d.ts` only.

- [x] LT-041: De-duplicate shared predicates/helpers; bring `CONTEXT_HELPERS` under the vocabulary parity test (compiler regrouping M7) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Six duplicate helper homes collapsed into `ast-utils.ts`/`spans.ts` (`nodeType`, `hostPropOf`, `objectKeys`, `sanitizeVarName`, `reindent`, `FACTORY_CONTEXT_MEMBERS`). The last one gained a type-level parity test against the real `FactoryContext<ComponentProps>`, so a library rename now fails CI instead of drifting silently.

- [x] LT-042: Consolidate the bespoke `TemplateNode` walks into one `walk.ts` visitor (compiler regrouping M3) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New `walk.ts` (`childNodes`, `walkTemplate`, `collectAttrs`) absorbs six genuinely-uniform walks (plain-imports' four generators, `collectComposeElements`, `collectRefs`). Walks whose recursion IS the semantics (selector exclusivity counting, early-exit searches, depth-guarded/stateful passes) deliberately left bespoke.

- [x] LT-043: Single home for the server-known evaluability rule — `evaluability.ts` (compiler regrouping M4) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New leaf `evaluability.ts` exports `dependenciesOf`/`isServerEvaluable`, replacing three byte-identical copies; all server-render gate sites now call the shared implementation directly.

- [x] LT-044: Merge import handling into one module; remove `node:path` (compiler regrouping M6; browser-purity gate for ADR 0025) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New `imports.ts` owns all source-import collection and placement (compose + plain), replacing Node's `posix` path APIs with pure-string equivalents — the compiler is now browser-pure (ADR 0025 sub-design 6).

- [x] LT-045: Browser-bundle build + smoke test pinning compiler purity (ADR 0025 enabler) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New `scripts/build-tsrx-browser.ts` bundles the compiler for `target: 'browser'` with `external: ['node:*']` so a reintroduced Node import survives as a literal unresolvable specifier rather than being silently polyfilled; a new test confirms the bundle is byte-identical in output to the direct Node import. Seeds the playground's compile worker (ADR 0025).

- [x] LT-046: (Optional) Extend `walk.ts` coverage to the remaining bespoke `TemplateNode` walks — or document why not — done ✓
  **Skill:** le-truc-dev
  **Summary:** Reviewed all six holdouts; none generalize without losing behavior (exclusivity arithmetic, early-exit searches, a depth-conditional predicate, stateful ordering). Closed as won't-do, reasoning recorded in `LE_TRUC_COMPILER.md` §7.

- [x] LT-047: Direct unit test for `evaluability.ts` (`dependenciesOf`/`isServerEvaluable`) — done ✓
  **Skill:** le-truc-dev
  **Summary:** New `evaluability.test.ts` (5 tests) pins both functions directly against compiled fixtures rather than only transitively.

- [x] LT-048: Standalone unit tests for `analysis/loops.ts` (`runLoops`) and `analysis/naming.ts` — done ✓
  **Skill:** le-truc-dev
  **Summary:** New `loops-naming.test.ts` (10 tests) at the same hand-built-context granularity as `analysis.test.ts`: server-data and reactive-`List` `@for` planning, `uniqueName` collision suffixing, `addQuery` dedup/registration.

- [x] LT-049: Delete unused `diagnostic.withLine` (`diagnostics.ts`) — done ✓
  **Skill:** le-truc-dev
  **Summary:** Confirmed zero call sites repo-wide beyond its own definition; deleted.

- [x] LT-050: Client-side sanitizer-configuration path for TSRX reactive `html={}` (LT-025 review finding) — reviewed ✓
  **Skill:** le-truc-dev
  **Summary:** New `configureHtmlSanitizer()` (mirrors the server-side runtime helper by name) sets a module-level default sanitizer, read fresh per `dangerouslyBindInnerHTML().ok()` call; an unconfigured call stays byte-identical to today's raw passthrough. No compiler changes needed — the generated bare `dangerouslyBindInnerHTML(el)` call picks up whatever default the host app configures.
  **Review:** Approved. Recorded as an ADR-0010 amendment (additive to the existing `sanitize` hook, not a new decision surface).
