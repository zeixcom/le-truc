# ADR 0032 — TSX Surface Spike Findings

Historical record of the LT-183 spike behind [ADR 0032](../0032-adopt-tsx-as-the-authored-component-surface.md). Executed 2026-09-17 on the `spike/tsx-surface` branch (v3 tip `0b87a46c`) in one session, against the plan in the now-retired `TSX_SPIKE.md` (see git history). This is the evidence the §8 decision gate read — not documentation of shipped behavior. For that, see ADR 0032, `ARCHITECTURE.md` § Authoring Surfaces, `server/compiler/LE_TRUC_COMPILER.md` and `server/compiler/HOST_PROFILE.md`.

> **Gate outcome (LT-183, 2026-09-17): GO.** Every §8 acceptance criterion held — see the verdict table below. ADR 0032 is ✅ Accepted, carrying the owner's dual-front-end amendment recorded the same day: `.tsrx` is retained, not deleted. The spike's central claim — that `ComponentIR` is the seam and the machinery survives a front-end swap — was verified by **zero changes to the machinery layer**.
>
> **LT-202 (2026-09-18): the layout this file describes no longer exists.** The spike front end (`server/tsrx-tsx/`) was merged as `server/compiler/frontend/tsx/`, the whole compiler moved from `server/tsrx/` to `server/compiler/`, `host-profile.d.ts` moved beside the front end, and the parity harness moved to `server/tests/compiler/tsx/parity.test.ts`. Every `server/tsrx*` path named below is historical. Current locations are at the end of this file.

## Verdict: GO

| Criterion (§8) | Result | Evidence |
| --- | --- | --- |
| Server renders **byte-identical** to the `.tsrx` originals, all four ported components (value harness) | ✅ | parity test, 4/4 (`basic-counter`, `basic-pluralize`, `form-listbox`, `form-combobox`) |
| CSS artifacts byte-identical | ✅ | parity test, 4/4 |
| Simulated-tier components render through the **unmodified `sim/` realm** and match | ✅ | combobox+listbox pair — the corpus's only two Simulated components — byte-identical across surfaces |
| Compose site compiles with the child's real parameter types, proven **negatively** | ✅ | `combobox-bad-args.tsx:17` → `TS2322: Type 'string' is not assignable to type 'FormListboxOption[]'`, reported on the **authored parent** |
| Both §4.4 control-flow shapes workable through the **unmodified analysis** | ✅ | async boundary renders three arms + `hidden` toggles + one `watch()`; switch IIFE, try/catch IIFE, indexed `.map`, `&&`/ternary arms all lower and render both states; reactive `createList` `.map` produces the `reconcile()` plan + extracted `<template>` |
| Front-end re-target materially smaller than the surface it replaces | ✅ | ledger below |
| **Machinery survives the IR seam untouched** | ✅ | zero changes to `server/tsrx/` — `analysis/*`, both emitters, `runtime.ts`, `sim/*`, `evaluability.ts`, `reactivity.ts`, `tier.ts`, `first-refs.ts`, `imports.ts`, `i18n.ts`, `config.ts`, `infer-type.ts`, `css.ts`, `classify-attributes.ts` all imported as-is. Testable at the time by `git diff v3 -- server/tsrx` → empty. |

Gates, as captured: parity harness 26 pass / 0 fail (4 snapshots); positive tsconfig `--noEmit` exit 0; the `truc:pass` probe exit 0 positive / exit 2 negative (`TS2322 … Property 'truc:pass' does not exist` — namespaced attributes are per-element type-checkable in TS 6.0.3, and the *value* checks against the declared key); compose negative exit 2 on the authored parent; repo typecheck exit 0; `bun test server/tests` 1530 pass, with 11 pre-existing docs-route/HMR failures that reproduced on the clean tree.

## Measured ledger

New `.tsx` front end, as the spike left it: **3,335 lines**.

| File (spike-era path) | Lines | Classification |
| --- | ---: | --- |
| `to-estree.ts` | 747 | **new** — TS→estree converter; the work the pinned `@tsrx/core` parser did upstream |
| `compiler-tsx.ts` | 1,288 | 1,154 code lines — **1,044 verbatim** from `compiler.ts` (90%), 110 adapted (return-based module shape instead of `@{ }`; deleted scans; `.tsx` compose-import filter; template-literal CSS extraction) |
| `lower-tsx.ts` | 1,068 | 919 code lines — **699 verbatim** from `lower-template.ts` (76%), 220 adapted (directive cases → expression shapes; `boundary()`; `.map()` loops) |
| `index.ts` | 128 | adapted mirror of `compileComponent`'s assembly |
| `host-profile.d.ts` | 104 | **new** — `globals.d.ts` vocabulary re-homed + the `JSX.IntrinsicElements` surface |

Replaced: `compiler.ts` (1,752) + `lower-template.ts` (1,148) + `core.ts` (21) + `core-shim.d.ts` (41) + `parseComposeImports` (~25) = **3,413 direct**, plus the deleted dialect families and tooling (TSRX018/020, TSRX021–024, `REACT_ATTR_RENAMES`, `newerGrammarHint`, `scripts/codemod-react-jsx.ts`, the authored-code span remap) ≈ the plan's **~5.4k format-specific layer**. `classify-attributes.ts` (451) was reused **verbatim, zero changes** — the estree `JSXAttribute` shapes matched exactly.

The spike deliberately kept `compiler-tsx.ts`/`lower-tsx.ts` as *copies*, because the shared loops were embedded inside `compileSource`/`lowerChildren` and the machinery was off-limits by constraint. It projected ≈2.4k after a production merge extracted them. **LT-202 performed that extraction** (`front-end.ts`, `lower-shared.ts`, `pipeline.ts`); the 2026-09-18 compiler review found the two `compileSource*` drivers and the `lowerFor`/`validateListBody` triples still copied, and scheduled the remaining extraction as LT-232.

## Surface mapping

The measured `.tsrx` → `.tsx` mapping is **live documentation now**, not history: see `ARCHITECTURE.md` § Authoring Surfaces for the four axes on which the surfaces differ, and `HOST_PROFILE.md` § The `.tsx` surface for the authoring rules. Three spike-time findings are worth keeping here because they record a *decision*, not just a mapping:

- **`@for`'s `key k` clause retires.** `keyName`/`keyText` were only ever `bindItem` parameter *names*, and the `keyParam ?? '_key'` / `'__key'` defaults already existed — so server bytes are keyName-independent and the client emits `_key`. A structural, not byte, change, sanctioned by the §4.3 client criterion.
- **Bare `client-stmt` in a branch is not expressible** in `.tsx` and was retired rather than worked around (`&&` arms must be JSX). This matched the plan's expectation; ADR 0024 sub-design 11 had already restricted it.
- **`<style>` CSS became a template-literal child.** Raw CSS braces are illegal JSX text, so `.tsx` reads the bytes from inside the backticks and dedents identically. A genuine surface change, and the reason `css` is a recognized tag in the `.tsx` front end.

Everything else mapped directly: `@{ }` → statements + `return`; `@if`/`@else` → ternary / `&&`; `@switch` → switch IIFE; `@try`/`@catch` → try/catch IIFE; the async boundary → the recognized ambient `boundary({ … })`; `{count}` shorthand → `count={count}`; `truc:pass` / `truc:case` / `truc:case-type` / function-valued attrs / `on*` verbatim; the reserved `i18n` parameter, `truc:case` pruning and the `lang` config route identical, including pruned category spans.

## Notable facts

**Numbering is load-bearing** — `to-estree.ts`, `host-profile.d.ts`, `lower-tsx.ts` and `imports.ts` cite these by number. Do not renumber.

1. **TS 6.0 AST/dts drift.** `IfStatement.statement` → `thenStatement`. `isSequenceExpression` / `isAssignmentExpression` / `isJsxMemberExpression` **exist at runtime but are absent from the `.d.ts`** — this is why `to-estree.ts` probes `(ts.SyntaxKind as { JsxMemberExpression?: number })` and carries a handful of `as unknown as` casts at exactly those sites; they are the typed boundary, not sloppiness. `FirstStatement` is the display name for a `const` statement, so kind-name switches are wrong by construction and `ts.*` type guards are used exclusively. `baseUrl` is deprecated (paths work without it). *Recorded in `to-estree.ts`'s module doc.*
2. **A global-script `.d.ts` cannot use `declare global`.** The JSX `IntrinsicElements` surface must be a top-level `namespace JSX` — the classic global-JSX pattern. `declare global` stays correct inside module files, which is why the probe `.tsx` fixtures use it and the profile does not. *Recorded at `host-profile.d.ts:112`.*
3. **`@ts-expect-error` in a comment suppresses the next line even when the comment is prose** saying "deliberately NOT used." Cost one debug cycle in the negative probe. No code lives on this; it is a trap for whoever next edits the negative fixtures.
4. **The host profile is real surface.** The production profile needs per-element light-DOM attribute types — the probes proved strict per-element/per-attribute checking works, including value-shape checking of `truc:pass` entries. `globals.d.ts`'s `host: HTMLElement & Record<string, unknown>` stand-in rejects managed-form member calls (`host.setCustomValidity(…)`); the profile widens to `FormAssociatedElement & Record<string, any>` while the generated client keeps precise types. *Shipped as the 265-line `host-profile.d.ts`, hardened by LT-203.*
5. **The compose pass surface is child-declared.** `truc:pass={{…}}` type-checks against the child's args type only if the child declares `'truc:pass'?: { … }` on it. The alternative — host-profile-level augmentation of function components — has no clean TS mechanism. This is the honest spelling and became ADR 0032 sub-design 3.
6. **IIFE recognition must be shape-based.** Object identity between `callee` and `arguments[0]` does not survive a TS→estree conversion (two separate conversions) — a spike bug fixed by structural matching (0-arg call of a 0-param arrow with block body). *Shipped as `asIife` / `lowerSwitchIife`; cited at `lower-tsx.ts:158`.*
7. **`parsePlainImports` filtered `.tsrx` specifiers only.** The spike worked around it by local-name overlap with the compose map; the production merge widened the filter to both extensions. *Shipped at `imports.ts:100`; cited at `imports.ts:294`.*

## Where everything lives now

| Spike-era | Current |
| --- | --- |
| `server/tsrx-tsx/` | `server/compiler/frontend/tsx/` (`to-estree.ts`, `lower-tsx.ts`, `compiler-tsx.ts`, `index.ts`) |
| `server/tsrx/` (machinery) | `server/compiler/` |
| `spike/tsx/host-profile.d.ts` | `server/compiler/frontend/tsx/host-profile.d.ts` |
| `server/tests/tsrx-tsx/parity.test.ts` | `server/tests/compiler/tsx/parity.test.ts` (plus `tsx/typecheck.test.ts` for the tsconfig gates) |
| `spike/tsx/` fixtures | `spike/tsx/` — still the live parity and typecheck corpus; **scheduled to move into the example component folders by LT-237** |

Spike constraints honored at the time: no changes under `examples/`, `server/generated/tsrx/` or `src/`, and the machinery untouched.
