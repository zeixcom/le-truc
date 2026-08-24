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

- [ ] LT-030: Merge `feat/bindings-multiple-overloads` — map-form `bind*()` overloads
  **Skill:** le-truc-dev
  **Context:** This branch implements the map-form overloads for `bindStyle()`/`bindAttribute()`/`bindClass()`/`bindProperty()` proposed in LT-029. Merge it into `docs/server-components` (or `main`, per current branch strategy), then reconcile its implementation against LT-029's proposal below and close out any gaps. Unblocks LT-029 and, through it, LT-028.

- [ ] LT-029: Add map-form overloads to `bindStyle()`/`bindAttribute()`/`bindClass()`/`bindProperty()` (`src/bindings.ts`) — library API change
  **Skill:** le-truc-dev
  **Context:** All four helpers hard-code a single target (one CSS property, attribute, class token, or object key). A component whose one computed value drives several of these at once (e.g. `basic-gauge`'s ring: two CSS custom properties from one threshold lookup) needs a map-form overload — additive, keyed on the target parameter being a `readonly string[]` instead of a bare `string`. See LT-030: `feat/bindings-multiple-overloads` may already deliver this: verify against the proposal shape below before doing net-new work.
  ```ts
  bindStyle<P extends string>(element, props: readonly P[]): SingleMatchHandlers<Partial<Record<P, string | null>>>
  bindAttribute<N extends string>(element, names: readonly N[], allowUnsafe?): SingleMatchHandlers<Partial<Record<N, string | boolean>>>
  bindClass<Tk extends string>(element, tokens: readonly Tk[]): (value: Partial<Record<Tk, boolean>>) => void
  bindProperty<O, K extends keyof O & string>(object, keys: readonly K[]): (value: Partial<Pick<O, K>>) => void
  ```
  `bindStyle`/`bindAttribute`: `ok(map)` sets/removes each declared key per its presence; `nil()` removes all declared keys. `bindClass`: `ok(map)` toggles every declared token (absent = off). `bindProperty`: `ok(map)` is a partial patch — assigns only keys present in `map`.
  **Check:** New unit tests per helper's map form: multiple targets set in one `ok`, an absent/`null` key cleared individually, `nil` clearing every declared key/attribute, `bindClass`'s all-declared-tokens toggle, `bindProperty`'s partial-patch behavior. Existing single-target usage unaffected (additive, non-breaking).

- [ ] LT-028: No sanctioned `.tsrx` lowering for reactive host-level style/CSS-custom-property updates (found migrating `basic-gauge.tsrx`; depends on LT-029)
  **Skill:** le-truc-dev
  **Context:** `basic-gauge.ts`'s hand-written original reactively sets two CSS custom properties on the host from one `watch()` call. Blocked today by (1) sub-design 4's `pass`-only custom-element interop rule rejecting `style={() => …}` on a custom element root, and (2) `bindStyle()` only setting one property per binding. `basic-gauge.tsrx` (LT-026) works around this with a static, server-computed-once `style` attribute — a real, user-visible regression versus the hand-written component.
  **Decision (scope, not yet implemented):** Once LT-029 lands: (a) exempt `style={() => …}` from the custom-element reactive-attribute gate, the same way `class-map` already is; (b) lower a `style={() => ({ … })}` object-literal-bodied thunk to one `watch(reactive, bindStyle(el, map))` call, analogous to the existing per-key `class-map` lowering.
  **Check:** `basic-gauge.tsrx`'s ring updates live (color and rotation) when `value` changes after connect, parity-tested against the hand-written `basic-gauge.ts`.

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
