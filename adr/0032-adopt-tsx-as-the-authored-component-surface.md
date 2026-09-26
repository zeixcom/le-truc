# ADR 0032: Adopt `.tsx` as the Primary Authored Component Surface (`.tsrx` Retained)

## Status

✅ Accepted — supersedes [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md)'s surface sub-designs 4, 6 and 14 and amends 16, for `.tsx` components.

## Context

ADR 0024 adopted `.tsrx` — a bespoke grammar on a pinned `@tsrx/core` 0.x. The compiler splits into **machinery** (evaluation, analysis, emitters, simulation — format-independent, most of the compiler) and **surface**: the grammar, its pin, and the JSX-adjacency costs — React near-miss diagnostics, the attribute rename table, broken editors, span-table remapping so `tsc` can check authored code. A spike re-targeted the front end onto the `typescript` parser with measured parity: byte-identical renders through the unmodified machinery, compose type errors on the authored parent, workable control-flow spellings. REQUIREMENTS [§5](../REQUIREMENTS.md#5-technical-constraints) and [§7](../REQUIREMENTS.md#7-out-of-scope) are untouched. This is an authoring-surface decision; shipped contracts and the machinery are identical.

## Decision

Adopt standard **`.tsx`** as the **primary** authored surface — parsed by the `typescript` dependency through a small TS→estree converter, every downstream stage reused **unmodified** — and **retain `.tsrx` as a supported surface**: one machinery layer, two front ends, one registry. Owner ruling: `.tsx` delivers a mature format without waiting for TSRX 1.0, while the door stays open for `.tsrx`. Supersedes ADR 0024's surface sub-designs 4, 6 and 14 and amends 16 *for `.tsx` components*; the `.tsrx` sub-designs remain in force for `.tsrx` sources; 0024's 1, 3, 5, 7–13, 15 carry over for both — s1's full expressiveness is what s6's capability rule enforces.

1. **Module shape.** One exported component function per file: the first parameter, destructured, is the server args (types flow to compose sites for free, sub-design 3); statements before the `return` are the setup; the returned JSX — root or fragment — is the template; a `<style>` sibling carries the CSS as a template literal (JSX text cannot contain raw braces). `{count}` spells `count={count}` — identical server-attr IR.

2. **Control flow as expressions.** Ternary/`&&` → `if`; `map` → `for` (server data → `each()`, declared List → `reconcile()` — keyed by iterable type, not spelling); `@switch` → an IIFE; the boundaries → the `truc:try` intrinsic ([ADR 0041](0041-truc-intrinsic-elements-for-compiler-consumed-constructs.md)) — arms are template-cloned branches ([ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md)); which arm ships stays the compiler's decision. Statement arms and bare statements in a branch are unexpressible in `.tsx` — statements live in setup; where they read better as statements, author `.tsrx`.

3. **Authored sources are type-checked directly.** They use `jsx: preserve` and are never emitted by `tsc`; generated modules keep their own check path. TS 6 type-checks namespaced JSX attributes, so `truc:pass` survives verbatim *and* type-checks: the ambient `JSX.IntrinsicElements` profile declares the light-DOM surface per element (`class`/`for`, thunk overloads) — `className`/`htmlFor` have no entry, so the React prior errors (the near-miss family stays `.tsrx`-only). A composed child declares its pass surface on its args type, so `truc:pass` checks against the child's real shape, errors on the authored parent. Span tables survive for generated modules and `.tsrx` code. The boundary arms are typed precisely — a branded `JSX.Element` and a contextual `Error` parameter. **The factory context is typed by an annotated second parameter** — `, { host, first, expose }: FactoryContext<Props>` (`FormFactoryContext` for form-associated) — because ambients cannot see type parameters; it makes the whole context prop-precise (`watch`/`on`/`pass` key overloads, `expose()` drift a free tsc error) and is the authoring convention. The compiler validates the vocabulary (LTC049) and the annotation's surface agreement with `config.formAssociated` (LTC050). The ambients remain for migration, fate deferred; `.tsrx` keeps the ambient vocabulary — a designed asymmetry. `i18n` stays in the ARGS destructure (the generated client has zero i18n). No silent fallbacks: an unannotated parameter is an implicit-`any` error.

4. **Parser boundary.** `typescript` joins `@tsrx/core` as the second parser; the pin, shim and pin reviews are retained for `.tsrx`. The converter is the only `typescript`-API leaf (oxc a future swap behind it); no Babel — the transform is source-to-source, changing no artifact classes.

5. **Machinery boundary.** Analysis, both emitters, the runtime, the realm and the tier classifier are reused byte-identical — the spike changed zero lines. ADR 0024 s2's packaging gate dissolves: the standalone core ships with no upstream dependency on the `.tsx` path; a Vite adapter comes at packaging time.

6. **The dual front end.** Both surfaces feed the same machinery — one corpus scan, one registry; a tag declared by two same-surface sources, or outside one folder-local variant set, fails the compile naming both (LTC048, narrowed by [ADR 0039](0039-canonical-plus-variants-authored-surfaces.md)). `.tsx` is the default for new authoring; `.tsrx` remains supported where statement-context control flow reads better, and the upstream TSRX bet stays live. The parity suite (render and diagnostic, covering failed compiles and reactive conditions) is the standing **equivalence contract**: the same component in both surfaces renders byte-identically and diagnoses identically, modulo an allowlist naming the authored spelling — "the door stays open" as mechanics, and the drift guard. The in-repo surface set is closed. The ruling **defers rather than deletes** the `.tsrx`-specific costs (pin, near-miss families, rename table, `.tsrx` span tables, pin reviews), and every new front-end capability must be expressed and paid for in both surfaces (`.tsx` host vocabulary per ADR 0041's `truc:` rule); in exchange the forced corpus migration is cancelled and parser churn isolates. **The boundary is three-arm in both surfaces:** a fourth `stale` arm was withdrawn — the client never re-renders arm content; the in-flight state is the reactive `isPending(signal)` idiom beside the boundary, folded server-side, re-fired by the generated `watch` on settle. **Repo-internal at v3.0:** the published package ships the `.tsx` front end only ([ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s2); nothing in-repo changes. **Front ends are a stated extension point** (`source → { component, diagnostics, routingSignals }`); a connector for another framework's semantics is third-party by name, measured before any is contemplated against the falsifiable criterion — emitted bytes + this runtime vs. the target's payload + runtime. A foreign-runtime "Mounted" tier is recorded, not adopted: the value is compiling several surfaces to one runtime.

## Alternatives Considered

- **Full switch (delete `.tsrx`)**: sheds the pin and near-miss families at the price of a forced codemod; rejected — statement-context control flow is more natural, the upstream bet stays alive, the IR seam makes retention cheap.
- **Keep `.tsrx` only**: forfeits direct tsc checking and working editors.
- **oxc-parser**: fast but 0.x — recreates the pinned-parser problem ADR 0024 paid to contain.
- **Babel**: a transform step that does not fit server-rendered HTML; the chosen pipeline changes no artifact classes.

## Consequences

**Good:**

- Editors work through tsserver; the React prior becomes *correct* on `.tsx`; compose type-flow runs through real parameter types, errors on the authored file; the `.tsx` path has no upstream dependency.
- Semantics and shipped contracts unchanged — byte-identical renders proven across every Evaluation Tier; no forced corpus migration; parser churn isolates; "the door stays open" is a mechanical contract, not a promise.

**Bad / accepted tradeoffs:**

- Every new front-end capability is built and paid twice; the `.tsrx`-specific costs are retained, not deleted; two parser dependencies to track.
- The corpus is permanently mixed-surface; "which surface?" needs the default rule (`.tsx` unless statement-context control flow argues otherwise).
- On `.tsx`, statement arms are gone (ternaries/`&&`/IIFEs), `truc:` intrinsics are vocabulary to learn, CSS needs a template literal, and the `{count}` shorthand is gone.
- The converter must track `typescript`-major AST drift — the old pin's discipline at a slower-moving target.

## Related

- Evidence: [spike findings](archive/0032-spike-findings.md) — parity verdicts, the line-count ledger, and the engineering facts modules cite.
- Requirements [§1](../REQUIREMENTS.md#the-core-insight), [§5](../REQUIREMENTS.md#5-technical-constraints); host profile: [HOST_PROFILE.md](../server/compiler/HOST_PROFILE.md)
- Related: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md), [ADR 0028](0028-tiered-error-surfacing.md), [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md), [ADR 0039](0039-canonical-plus-variants-authored-surfaces.md), [ADR 0041](0041-truc-intrinsic-elements-for-compiler-consumed-constructs.md)
