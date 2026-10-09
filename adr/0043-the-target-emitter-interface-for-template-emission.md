# ADR 0043: The Target-Emitter Interface — Shared Decisions, Per-Target Syntax

## Status

✅ Accepted (owner, 2026-10-01; revised 2026-10-10 — D-28 ruled; the boundary, lists and children folded into s2–s5) — amends ADR 0034 s3 and ADR 0037 (see Related).

## Context

[ADR 0034](0034-distribution-compiler-package-and-template-emission.md) s3 commits 3.0 to template emission ([M27](../REQUIREMENTS.md#m27-backend-neutral-template-emission)): the fold resolves everything independent of server args and leaves each server arg as a **hole** in a backend template language. Twig is the first target and HTL is known to follow, so only the interface is a 3.0 commitment, and it must be decided before the first emitter. [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) adds IR that the interface must read: a reactive condition whose initial winner depends on server args. Three later decisions grew what a render contains — the three-arm boundary ([ADR 0041](0041-truc-intrinsic-elements-for-compiler-consumed-constructs.md); its mapping was deferred as D-28), reactive lists ([ADR 0046](0046-reactive-list-items-as-mount-scopes.md)) and the children region ([ADR 0048](0048-the-children-contract-parent-owned-content-child-declared-roles.md), holding a sanitized `truc:html` since LT-492) — and the 2026-10-10 revision folds their emission into this interface. Escaping in languages the compiler does not execute is a security boundary, so the interface has to make "a target forgot a case" a type error rather than a review finding.

## Decision

**The shared walk owns every decision; a target owns only syntax.** The walk classifies holes, assigns escaping contexts, refuses positions and picks the tier. A target maps a closed set of emission operations — text, hole, segment list, conditional, boundary, loop, list template, include, message format, arm template — to its language, and declares its file naming and the host helpers it needs. Targets never see IR nodes. The operation vocabulary is the narrower emitter-facing shape the IR's internal status anticipates; it stays internal for 3.0.

1. **Hole grammar: a closed portable subset every target must translate.** Arg and loop-item reads through static member paths (including `length`), literals, `!`, strict equality, numeric comparison, `&&`/`||`/`??`, the ternary, and message calls (s5). A template literal in a text or attribute position is not an operator: it lowers to a segment list of literal text and holes, each escaped on its own. Calls to arbitrary functions are outside the subset. A backend that cannot translate the whole subset does not qualify as a target, so **emittability is target-independent**.

2. **Emittability is classified per expression and decided per component**, like the [Evaluation Tier](0029-tiered-server-evaluation.md). A non-portable server-class expression has no client to correct it: compiler channel, Prevented. A non-portable *initial value* routes the component's partial to Static with a census reason — a routing outcome, not a fault, decided by what the value routes from: a task initial routes like a reactive one (s4); a key-alias harvest ([ADR 0047](0047-harvest-through-a-key-alias-witnessed-by-the-render.md) s4) and the synchronous error boundary (s4) are not emittable. Both checks run only when a template target is configured, so SSG-only builds and the warning baseline are unaffected.

3. **Escaping contexts are a closed union**: text, quoted attribute, URL attribute, boolean attribute, class token, style value, HTML, and composed markup. `class`/`style` maps lower to segment lists over these. The URL context carries the runtime's safe-protocol allowlist into the target, which must reject exactly what the fold rejects. The HTML context requires a target-side sanitizer hook, named in the target's manifest, implementing the application's one sanitize policy ([ADR 0010](0010-trusted-types-support-via-sanitize-hook.md)); an unregistered hook fails at render, which is fail-closed. **Composed markup** is markup the walk itself composed — a captured children region (s5) — emitted raw, without the hook: every part was safe at its source, its holes escaped by their own contexts and its `truc:html` hooked at its site. A context of its own stops a target from sanitizing authored markup that SSG never sanitizes. **Refused positions are decided in the shared walk**: holes in `<script>` or `<style>` content or comments, `on*` and `srcdoc` attributes, attribute names, a whole-string `style` attribute, and a server-arg tag name unless its type is a finite literal union (which lowers to a conditional). Compiler channel, Prevented. Every target switches exhaustively over the context union ([ADR 0040](0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md)).

4. **Conditions and boundaries emit their initial winner as a backend conditional beside inert arm templates.** The `conditional` node carries the mode, the keyed arms and an **initial winner** kept separate from the client thunk, derived by substituting signal initializers back to server args: a constant arm key, a select over portable cases with a fallback, or a marker that the value folds only through the value harness. An unresolvable initializer renders no live arm (ADR 0037 s5); a non-portable one routes the partial Static. A template emits the reactive winner as a backend conditional beside the inert arm templates — never as arms rendered live and hidden by expression, which would restore the toggled-arm model ADR 0037 rejects. In every inert template, server-arg sites emit as holes the backend fills per request, and client-written sites bake empty.

   The **`boundary` operation** (D-28) carries the arms `ok`/`nil`/`err`, the result test and the err scope. A template target executes no driver, so the boundary is emittable only when the task's initial value routes from a server arg — the **result arg**: `T`, `{ error: { code, message } }` or null renders `ok`, `err` (the catch parameter reads member paths over the shape's `error`) or `nil`, a total function over request-time input; the shape test is target vocabulary, not a portable-subset operator. A task with an opaque driver routes Static (s2); a result type with its own `error` member is refused (compiler channel, Prevented); the synchronous boundary catches a JavaScript throw, which no template observes — not emittable (s2).

5. **Loops, lists and composition.** A loop over server data becomes the target's native loop, the empty arm its `else`, the item binding a hole scope; a loop's source may be a member path over an enclosing item scope, so nested lists nest as native loops. A reactive list ([ADR 0046](0046-reactive-list-items-as-mount-scopes.md)) reuses that loop verbatim for its initial items and adds a **list-template operation** — the item shape, inert, no holes, one shape for all items — stamped `data-list="N"` as a direct child of the host in document order, whatever the depth. A composed child becomes an **include with an arg mapping** of portable expressions, closed-scoped where the target has a form (Twig `only`), so closed inputs hold on the CMS side too. **Children pass as a capture in the composed-markup context** (s3): the walk captures the parent-owned region ([ADR 0048](0048-the-children-contract-parent-owned-content-child-declared-roles.md)) and passes it as one more arg, emitted raw at the insertion element; the child writes the `data-children` marker from an implicit, minted `owner` arg only when a compiled parent passed children, and a pass-through forwards it verbatim. Partials are one file per component and locale.

6. **Locale: one partial per locale, no locale hole.** Everything arg-independent folds at build, including argument-less messages and the client `i18n` attribute. A message whose arguments read server args emits a **formatter call over the already-localized pattern literal** (PHP `MessageFormatter`, ICU4J), so no catalog reaches the CMS and a key still resolves in one place. `Intl` formatting over a hole is refused in favour of the equivalent ICU pattern: one formatting channel. Pre-formatted values supplied by the CMS are rejected; they break the raw-value-source rule.

7. **Every tier emits.** Folded components emit the full partial; Simulated and Static components emit the Static skeleton ([ADR 0029](0029-tiered-server-evaluation.md) s8). A Static partial still renders its server-class holes. The census records each component's tier per target.

8. **Equivalence is byte identity with SSG, checked on the real engine.** For each emittable corpus component, locale and fixture arg set, the target render equals the SSG render of the same tier. Holes render where the client harvests because it is one walk. Twig is checked by PHP with `twig/twig` and `intl` in CI, alongside adversarial escaping and ICU equivalence corpora; locally the check skips without PHP. A second, trivial target — an operation dump with an in-process interpreter — lives in the test suite only, proving the interface carries a second target unchanged.

## Alternatives Considered

- **Holes as bare arg reads only**: forces every condition, comparison and concatenation to fold or fail, which leaves most real components non-emittable.
- **Per-target emittability and refusal**: each target would re-derive security decisions, and a lax target becomes the unsafe one. A shared walk decides once.
- **Calls to functions marked pure in the subset**: no marking mechanism exists, and every target would need to translate arbitrary code.
- **Hidden-by-expression for reactive arms**: duplicate ids and names, submitting inactive controls, eager child upgrades — the class ADR 0037 retired.
- **Decomposing the boundary into the conditional operation**: forces a shape test into the portable subset and bends loop-item scope into an err scope. **An envelope result arg (`{ status, value, error }`)**: ceremony; the operation carries the test either way. **Mapping the sync throw to strict-variable failures**: the backend's error page is not the catch arm. **One `list` operation owning container and template**: a second code path for byte-identical container output. **A generic inert-template operation**: placement — beside the arm, hoisted to the host — is the semantics.
- **Inlining composed children**: multiplies partial size and stops a CMS from rendering a child alone. **`embed`/block override**: structure-preserving in Twig, but a second compose spelling per target — and HTL has none, so emittability would turn target-dependent. **Whole-region sanitization**: makes the application's sanitize policy load-bearing for authored markup that SSG never sanitizes.
- **A locale hole with backend translation catalogs**: requires exporting catalogs into each backend's format and a second key resolution path.
- **`twig.js` as the reference renderer**: diverges from PHP Twig on escaping and filters, and has no ICU.
- **Shipping the debug target**: would publish a serialized emitter shape by accident.

## Consequences

**Good:**
- Adding a target is a syntax table plus an escaping map; tsc flags a missing context or operation.
- Security decisions are made once, in code the SSG path already exercises.
- The equivalence check reuses SSG output as its oracle; the boundary, lists and children reuse the SSG walk's output shape, so it stays byte identity.
- CMS-side ICU runs on the platform's own ICU, without exported catalogs.

**Bad:**
- CI gains a PHP toolchain for one job.
- The portable subset is a second expression boundary authors meet, on top of closed fold inputs.
- Targets need small host helpers (URL check, sanitizer, formatter), which integrators must register.
- Locale × component partial count grows linearly with locales.
- CMS authors meet a three-state result arg and a minted `owner` arg.

## Related

- Requirements: [M27](../REQUIREMENTS.md#m27-backend-neutral-template-emission), [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)
- Amends: [ADR 0034](0034-distribution-compiler-package-and-template-emission.md) (s3: the interface is this ADR), [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) (a reactive condition travels as a backend conditional only)
- Builds on: [ADR 0010](0010-trusted-types-support-via-sanitize-hook.md), [ADR 0029](0029-tiered-server-evaluation.md), [ADR 0030](0030-internationalization-as-build-time-server-data.md), [ADR 0040](0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md)
- Reads: [ADR 0041](0041-truc-intrinsic-elements-for-compiler-consumed-constructs.md), [ADR 0046](0046-reactive-list-items-as-mount-scopes.md), [ADR 0047](0047-harvest-through-a-key-alias-witnessed-by-the-render.md) s4, [ADR 0048](0048-the-children-contract-parent-owned-content-child-declared-roles.md) — the constructs s2–s5 fold in
- Specification: `COMPILER_SPEC.md` §3.8, §6.3, §9.2
