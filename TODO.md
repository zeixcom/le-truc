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

---

## TSRX conformance & migration ergonomics (CHECKLIST.md triage, 2026-08-26)

Triaged against the compiler source. Three checklist items were **verified as already satisfied** and produced no task: statements-before-output inside control-flow bodies (`lower-template.ts` `lowerBranchBody` + `client-stmt` already handle it, §1), selector-literal type inference (`ElementFromSelector<S>` in `src/helpers/dom.ts` already yields precise non-nullable types, §3), and equality-by-value (`List`/`Store` already compare by value, §6).

- [x] LT-051: Reactive-lift analysis — lift lexical reads, hard-error on opaque call boundaries (CHECKLIST §2) — done, pending review ⏳
  **Skill:** le-truc-dev
  **Changed:** new `server/tsrx/reactivity.ts` (`classifyChild`, 145 lines); `lower-template.ts` (`liftsToReactive` wrapper, plain `{expr}` children now classified); `diagnostics.ts` (TSRX017); new `server/tests/tsrx/reactivity.test.ts` (11 tests).
  **How:** `classifyChild` walks the child expression collecting *reads* (`sig.get()`, `sig.<member>`, `host.<prop>` — the object is consumed at the MemberExpression, so it never counts as an escape) and *escapes* (a signal or `host` identifier reached as a bare value). Escapes → TSRX017; else reads → lift; else static. An authored `{() => …}` thunk short-circuits to reactive and is never inspected, so the override stays legal everywhere. Nested callbacks are walked, with params shadowing outer signal names.
  **Check:** (1) `host` is treated as reactive in *any* member position, so `{host.setFormValue}` would lift — harmless in child position but arguably sloppy; worth a decision before LT-052 widens the surface. (2) Bare `host` passed to a call is currently an escape (TSRX017) alongside signals — stricter than the checklist's wording, which names only signals. (3) TSRX017's fix-it always suggests wrapping the whole expression; it does not try to narrow to the offending subexpression.
  **Corpus impact:** none — every plain `{expr}` child in `examples/` is a server arg (`label`, `children`, `unit`, …), so all goldens are byte-identical. Verified `check:tsrx` emits the same 4 pre-existing diagnostics before and after.
  **Context:** Prerequisite for LT-052 — do this first. The lift line is *lexically visible reactive read* vs. *read behind an opaque call boundary*, not the current *single read* vs. *compound expression*. `{host.validationMessage}` and `{length.get() === 0}` must both lift; `{formatRemaining(maxlength, length)}` must not lift silently — it needs an explicit thunk. When the analysis cannot prove a child expression is static, emit a new hard diagnostic (`TSRX017`) demanding an explicit `{() => …}` thunk rather than falling back to a static server emit. Rationale: a missed lift is invisible — the server folds it, the HTML is correct, the demo looks right, and it never updates; over-lift is loud, under-lift survives review. Explicit thunks stay legal everywhere as an override.

- [x] LT-052: Remove the `&{}` lazy-child sigil; plain `{}` carries reactivity (CHECKLIST §1) — done, pending review ⏳
  **Skill:** le-truc-dev
  **Changed:** `lower-template.ts` (sigil branch deleted → TSRX018; `markPositionallyReactive`; TSRX019 gate); `diagnostics.ts` (TSRX018/019); `ir.ts` + `compiler.ts` (`ExtractContext.exposedProps`); `analysis/effects.ts` (`managedPropRead` — TSRX010 now fires on `host.<prop>`); codemod across 15 example files and 13 test files; `client.golden` expectation + `form-textbox` snapshot.
  **How:** `&{x}` → `{x}`, and `&{'prop'}` → `{host.prop}`. Three sub-problems the task description didn't anticipate: (1) `@catch`'s error param and a reactive `@for`'s item are reactive *by position*, not by declaration, so the lift rule alone left them static and `validateListBody` saw zero slot-fill holes — marked in `lowerTry`/`lowerFor`, recursing through element children since `{item}` is routinely nested; (2) `{'validationMessage'}` is indistinguishable from literal text without the sigil, so string-literal prop naming is retired via TSRX019; (3) `watch('validationMessage', …)`'s string-key overload becomes `watch(() => host.validationMessage, …)`'s thunk overload.
  **Check:** (1) The managed-prop watch no longer proves extension ordering through `watch()`'s FormFactoryContext key overload — it now rests on `host.validationMessage` typechecking against a `FormAssociatedElement`-typed host. Equivalent in effect, but a different enforcement route; confirm that's acceptable. (2) `emit-server.ts`'s `lazyValueExpression` and `harvest.ts`'s `lazyWatchSource` retain their now-unreachable string-literal prop branches — left in deliberately rather than churn two more modules, but they are dead code. (3) TSRX019 includes the managed props unconditionally (`config` is parsed after template lowering), so `{'validationMessage'}` errors even without `formAssociated`.
  **Not done:** diagnosing `&{`/`&[` lazy destructuring in *binding* position (the checklist's second half of this item). The child-position form is gone; the binding-position form still parses silently. Small, but genuinely untouched — needs its own pass over `compiler.ts`'s setup extraction reading `ObjectPattern.lazy`.
  **Context:** Depends on LT-051. `&{}` is not a TSRX construct at all: `@tsrx/core` 0.1.60 defines `&{…}`/`&[…]` as lazy *destructuring patterns* in binding position (`types/index.d.ts:347`, `LazyPattern`), and our "lazy child" is a string-adjacency hack in `lower-template.ts:535` — a `JSXText` whose raw value *ends in* `&` immediately before a `JSXExpressionContainer`. Side effect of that hack: `<span>Q&{a}</span>` silently swallows the `&` today. Delete the sigil-detection branch and the `lazy` flag's authoring surface (the IR `lazy` field may stay as an internal "is reactive" marker set by LT-051's analysis). Ship a codemod rewriting `&{x}` → `{x}` across the corpus (29 occurrences, 10 files) and make a stray `&` before an expression container a hard diagnostic with a fix-it. Lazy destructuring is not applicable to Le Truc at all — server composition needs eager snapshot evaluation — so also diagnose `&{`/`&[` in binding position in this host profile.

- [ ] LT-053: Rename the `pass` special attribute to the namespaced `truc:pass` (CHECKLIST §1)
  **Skill:** le-truc-dev
  **Context:** `classify-attributes.ts:113,266` matches the bare name `pass`, which collides with any user prop legitimately named `pass`. `JSXNamespacedName` is in the TSRX grammar and namespaced attributes are the ecosystem convention for host-owned attributes. Accept `truc:pass`, and keep bare `pass` working for one cycle with a deprecation diagnostic plus codemod, since it is load-bearing across the migrated corpus (ADR 0024 sub-design 10, LT-016/LT-017).

- [ ] LT-054: Hard errors with fix-its for near-miss JSX (CHECKLIST §11)
  **Skill:** le-truc-dev
  **Context:** TSRX is close enough to JSX that the React prior fires at full strength and agents fill the delta with React habits. Make the common near-misses hard diagnostics with fix-its rather than silently-something-else: `{cond && <x/>}` → `@if (cond) { … }`, `{cond ? <a/> : <b/>}` → `@if/@else`, `return (<>…</>)` → a bare `<>` output, `.map()` over an array in child position → `@for`, and `className`/`htmlFor` → `class`/`for`. Prefer loud failures over compact output.

- [ ] LT-055: Replace magic `ref={}` with the library's own `first(selector, required)` (CHECKLIST §3)
  **Skill:** le-truc-dev
  **Context:** `first()` is already real, shipped API (`src/helpers/dom.ts:373`) and `ElementFromSelector<S>` already gives precise non-nullable types when the `required` reason string is passed — so no new inference work is needed, only an authoring surface. Allow `first()` calls in TSRX setup position, resolved **structurally on the server** (reuse `analysis/selectors.ts`'s existing `resolveSelectorIn`/`discriminatorCandidates` machinery — it already does uniqueness counting) and via the DOM on the client. Then codemod the corpus off `ref={}` (14 occurrences, 10 files) and remove the `ref` attribute kind from `classify-attributes.ts`/`ir.ts`. Note `first('input, textarea', 'required')`'s second argument is a *reason string* used in `MissingElementError`, not a keyword — pick a descriptive one in migrated sources. Force narrowing where a reference spans `@if` branches with different element types.

- [ ] LT-056: `form.ts` — fix formReset ordering and dirty-flag sync-back (CHECKLIST §7)
  **Skill:** le-truc-dev
  **Context:** Form reset runs in tree order, so a form-associated host precedes its own inner control: `formResetCallback` fires **first**, then the native input resets itself to `defaultValue`. `makeResetCallback` (`form.ts:401`) currently restores the retained initializer during the callback, which is then overwritten by the native reset. Sync back *after* the native reset instead (`queueMicrotask`), reading the control's live value and calling `setFormValue`. The dirty flag cannot be cleared from JS — only the form reset algorithm clears it, which works here because the inner control is in the light DOM and owned by the same form.

- [ ] LT-057: `form.ts` — `defaultValue` as the typed reset-baseline channel (CHECKLIST §7)
  **Skill:** le-truc-dev
  **Context:** Mirror the native property pair rather than inventing a policy for "set from outside": `host.value` → `control.value` (current value, sets dirty, always applies), `host.defaultValue` → `control.defaultValue` (reflects the `value` content attribute, the reset baseline). Do **not** reflect `host.value` back to the content attribute — reflecting overwrites the reset baseline, and `formResetCallback` would then restore whatever the user last typed. Consequently drop `value` from `observedAttributes` in form-associated components; `defaultValue` becomes the reset baseline's public channel and the property becomes the sole live edit path. Document that `host.clear()` leaves the control permanently dirty (correct and native-matching, but the content attribute is inert from then on).

- [ ] LT-058: TSRX diagnostic — exposing a managed form member shadows the extension (CHECKLIST §7)
  **Skill:** le-truc-dev
  **Context:** `formAssociated()` installs `formResetCallback`/`formStateRestoreCallback`/`formDisabledCallback` on the prototype via `installManagedFormMembers` (`form.ts:271`), all `writable`/`configurable`. A component that exposes its own member of one of those names silently **shadows** the managed one and disables retained-initializer restore — no error, no warning. Make it a compile error in `.tsrx` (extend the `TSRX010` managed-prop family) naming the extension that owns the member. This is what makes LT-056/LT-057 safe to rely on.

- [ ] LT-059: TSRX diagnostic — a form-associated component's inner control must have no `name` (CHECKLIST §7)
  **Skill:** le-truc-dev
  **Context:** The inner native control stays out of form submission *only* because it is unnamed; the host submits via `setFormValue`. A named inner control submits the field twice — once via `setFormValue`, once natively. Compiler error rather than a doc note: the markup looks entirely reasonable and the failure is server-side and invisible in the browser. Fires when `config.formAssociated` is set and a descendant `input`/`select`/`textarea`/`button` carries a static or bound `name`.

- [ ] LT-060: Reconcile `form-textbox.revised.tsrx` into `form-textbox.tsrx` as the reference shape
  **Skill:** le-truc-dev
  **Context:** Depends on LT-051…LT-059. The revised draft is the target shape, with two corrections decided during triage: **drop** its `formResetCallback` and `defaultValue` `expose()` entries — both belong in the `formAssociated()` extension (LT-056/LT-057), and exposing `formResetCallback` from a component is exactly the shadowing bug LT-058 now catches. Carry over the rest: `first()` instead of `ref`, plain `{}` children, `:has(.clear)` instead of the imperative `internals.states.add()`, `aria-describedby` parity across both branches, an `id` prop distinct from `name` so two instances in one document don't collide, and `<textarea>`'s initial value as text content rather than a `value` attribute. Delete the `.revised` file once merged; retire `form-textbox.server.ts` if it is a leftover scratch artifact.

### Queued — sequence after the above (CHECKLIST §4–§6, §8–§11)

- [ ] LT-061: Server fold rule — one AST node, two bindings (CHECKLIST §4)
  **Skill:** le-truc-dev
  **Context:** The fold rule: the server may fold only expressions that are pure functions of props and the static template. Server = evaluate with props bound, client = evaluate with signals bound, from **one** AST node — never two lowerings of the same expression, which would reintroduce the three-file drift problem inside the compiler where it is invisible because both halves are generated. Trace live element properties to their origin (`first('input').value` → the server arg behind `<input value={arg}>`): structural use of `first()` folds, live reads do not. Fail loud on live element method calls (`checkValidity()`, `setCustomValidity()`), impure initializers (`Date.now()`, random ids), sensors (no server value exists — folding to the build machine's reading is the worst outcome), and ambient reads that pass a naive purity check (`Intl.*`, `toLocaleString`, `Date`, `getTimezoneOffset` read no signal but their inputs are build-machine locale and timezone; for SSG add the build-to-serve time gap).

- [ ] LT-062: Server defaults for semantically loaded attributes (CHECKLIST §5)
  **Skill:** le-truc-dev
  **Context:** Omission is not neutral for attributes whose absence carries meaning: `hidden` omitted → visible, `disabled` omitted → enabled **and submittable**, likewise `checked`/`selected`/`aria-expanded`. A sensor-driven `hidden` renders the element visible until the client corrects it; a sensor-driven `disabled` renders an interactive, submittable control. Require an author-declared server default for these, or err to the safe side. Text content may still be omitted — empty string degrades gracefully, leaving only CLS. Do not lean on "Le Truc is fast" here: the bound that matters is latency to *definition* (parse → module fetched → `defineComponent` executed), which is network-bound, hundreds of ms on a cold cache, and permanent on a 404 or CSP block.

- [ ] LT-063: Hydration — preserve pre-upgrade DOM divergence; dev-mode hydration assertion (CHECKLIST §6)
  **Skill:** le-truc-dev
  **Context:** Between parse and upgrade the user can type, and the browser can refill via session restore, password-manager autofill, or bfcache — so at upgrade `input.value` may be `"hello"` while the content attribute still says `""`. Adopting the attribute silently eats user input in exactly the window where people are most likely to be typing. For elements with a dirty flag (`input`/`textarea` value, `checked`, `selected`) adopt the **live IDL property**; everywhere else the attribute is the server's channel and adoption is correct. Add a dev-mode assertion that recomputes each folded expression once on upgrade and warns on mismatch — costs nothing in production and converts impure folds and missed lifts, both silent and both invisible in single-instance demos, into loud failures. The goal is not "all initial effects are no-ops" but "every non-no-op is attributable to a known cause" — sensor, async, or pre-upgrade divergence.

- [ ] LT-064: `@try`/`@pending`/`@catch` — non-active branches must not submit (CHECKLIST §8)
  **Skill:** le-truc-dev
  **Context:** All three branches render in the initial HTML with two hidden, but `display: none` and the `hidden` attribute exclude nothing from submission — only `disabled` does, so named controls in `@try`/`@catch` submit alongside `@pending`. Auto-wrap non-active branches in `fieldset[disabled]` (nested form-associated custom elements inherit it); `inert` is not a substitute. Reset the generated fieldset's `border`/`padding`/`margin`/`min-width` (the `min-content` quirk breaks flex/grid children). Also check or namespace duplicate `id`s across branches. Document two limits: descendants of a disabled fieldset's first `<legend>` are not disabled (authors must not put controls in a legend), and `<fieldset>` is invalid inside `<tr>`/`<select>`/`<ul>`/`<dl>`, so a generic wrapper cannot be used in those contexts.

- [ ] LT-065: Branch tree-shaking preconditions (CHECKLIST §9)
  **Skill:** le-truc-dev
  **Context:** Shake an `@try` to its resolved branch only when **both** hold: (1) the promise depends solely on server-definitive args — a reactive `src`, as in `ModuleLazyload`, disqualifies it — and (2) the resolved value is consumed only by the shaken markup, with no effect or exposed property outside it reading it. When both hold, emit no client task at all: the markup becomes static and the `@try` disappears from the client output. If (1) holds but (2) does not, the value must survive to the client, which needs a transfer mechanism that does not exist yet — until it does, render `@pending` visible and let the client resolve. Never shake otherwise: emitting only the resolved branch while the client still constructs a pending task flashes back to loading and re-fetches, which is worse than not shaking.

- [ ] LT-066: Component-authoring lint rules (CHECKLIST §10)
  **Skill:** le-truc-dev
  **Context:** Turn the recurring authoring gotchas into diagnostics: `<textarea value={…}>` (textarea has no `value` content attribute — the initial value must be text content); `aria-describedby` parity across `@if` branches; an `id` computed but never referenced by any `aria-describedby` (`role="alert"` announces but does not associate); ids derived from `name` colliding when a component renders twice in one document; binding markup to a nullable derived cell instead of to the exposed property; and prop objects typed without optional fields where defaults are supplied, which makes the defaults unreachable.

- [ ] LT-067: Re-run the agent evals after the grammar fixes; point codegen at `https://tsrx.dev/llms.txt`
  **Skill:** le-truc-dev
  **Context:** Depends on LT-052/LT-055. Prediction from the checklist: a large share of the observed migration struggle disappears once `&{}` is gone, without touching anything structural. If it does not, the remaining causes are elsewhere and worth isolating separately — so run this before scoping further ergonomics work.

- [ ] LT-068: Document the Le Truc TSRX host profile (CHECKLIST §1, §12)
  **Skill:** tech-writer
  **Context:** Depends on LT-052…LT-055. Core TSRX defines no attribute semantics at all — the host owns them — so the Le Truc profile must state its own: **unscoped styles** (light DOM, global selectors; Ripple scopes and hashes, so every tool and agent trained on Ripple will otherwise mis-explain our CSS), host-owned `truc:pass`, `first()`-based element references, no lazy destructuring, and statements-before-output being legal (already true, just undocumented). Being an early second host profile is leverage: a custom-element/light-DOM/signals target differs enough from Ripple's to surface where "host-defined" is under-specified — worth engaging upstream **before** the Le Truc profile is fixed rather than after.

### Component-shape coverage — no example stays hand-written (NOTES triage, 2026-08-26)

Policy decision: every component in `examples/` must be expressible in `.tsrx`. Where a component doesn't fit, the compiler is what changes — not the component, and not the corpus's coverage. "Leave it hand-written permanently" is ruled out as an outcome.

- [ ] LT-069: Widen the client-setup free-name gate to element locals and effect helpers (resolves NOTES LT-039)
  **Skill:** le-truc-dev
  **Context:** Depends on LT-055 (`first()`). `compiler.ts:463`'s client-only setup-statement gate accepts JS globals, context members, signals, and `expose()` ambients — but **not** element locals, so any bare statement touching a queried element fails TSRX005. That single restriction is what blocks the imperative-effect shapes: `on(host, 'keydown', …)`, `new ResizeObserver(…)` with a disconnect cleanup, `canvas.getContext('2d')` redrawn on signal change, and `pointerdown`→`pointermove`/`pointerup` capture sequences that attach and detach listeners for the duration of one drag. Widen the gate to element locals bound by `first()`, and admit the library's own effect helpers (`watch`, `on`, and the effect-with-cleanup form) as recognized ambients. No new construct is needed: le-truc's existing idiom for "run once at connect, clean up on unmount" is an effect returning a cleanup function, and the `@{}` setup block already *is* the factory body — making it accept the same names the hand-written factory accepts is both the smaller change and the easier one to explain. Rejected alternative: a bespoke `onConnect={() => { …; return cleanup }}` pseudo-event, which invents a second effect concept alongside the one authors already know. Statements referencing element locals are client-only by construction and must never be emitted into the server module.
  **Validating cases (three, not one):** `form-colorgraph` (ResizeObserver + canvas + pointer capture), `form-radiogroup` (whose doc comment at `form-radiogroup.tsrx:10-11` records the `on(host, …)` → `onKeydown` JSX-attribute workaround), and `form-inplace-edit` (same restriction). The NOTES entry's claim of "no concrete second use case yet" was inaccurate.

- [ ] LT-070: Migrate `form-colorgraph` to `.tsrx`; retire the `on(host, …)` workarounds (acceptance case for LT-069)
  **Skill:** le-truc-dev
  **Context:** Depends on LT-069. The composition and per-step pieces are already expressible — three `<FormSpinbutton>` instances via `pass={{ … }}`, eight `<li>` steps as plain non-loop `style={() => stepStyle(…)}` reactive attributes (no `@for`, so LT-037's loop machinery isn't involved). LT-069 unblocks the rest. While here, drop the `onKeydown`/`onKeyup` JSX-attribute workarounds in `form-radiogroup.tsrx` and `form-inplace-edit.tsrx` in favour of direct `on(host, …)` setup statements, and delete the deviation note in `form-radiogroup.tsrx`'s doc comment. This is the acceptance gate for "the compiler fits every example component."

- [ ] LT-071: Revisit the deferred component-shape questions after the conformance refactoring (NOTES LT-033, LT-035, LT-036)
  **Skill:** le-truc-dev
  **Context:** Gated on LT-051…LT-060 and LT-069 landing. Three NOTES entries are deferred, not closed, and each is annotated with this gate. Re-evaluate them against the refactored compiler *before* designing anything new — several of these walls may move or disappear once `&{}`, the lift rule, `first()`, and the widened setup gate are in: **LT-036** (signals rendered only through a style/class map still hit TSRX004 with a misleading "never rendered" message — at minimum make the diagnostic distinguish "never rendered" from "rendered but initializer not client-portable"); **LT-035** (`card-mediaqueries` reshaped from light-DOM enhancer to template owner, leaving `card-mediaqueries.html` and the `'multiple components receive same context values'` e2e spec stale); **LT-033** (`card-blogmeta` reformats arbitrary author-supplied light DOM at connect and owns no template — the hardest of the three, and the one most likely to need a genuine `{children}`-adjacent addressing mechanism). Per the policy above, all three must end in a migration, so the question for each is *which compiler capability* is missing, not whether to migrate.
