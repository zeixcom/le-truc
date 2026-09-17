# TSX Spike Findings — LT-183 §8 Verdict

> Executed 2026-09-17 on `spike/tsx-surface` (v3 tip `0b87a46c`), one session, per
> TSX_SPIKE.md. Everything here is measured in-repo; re-run with
> `bun test server/tests/tsrx-tsx/parity.test.ts` and the four tsc gates below.

## Verdict: **GO**

Every §8 acceptance criterion holds:

| Criterion (§8) | Result | Evidence |
| --- | --- | --- |
| Server renders **byte-identical** to the `.tsrx` originals, all four ported components (value harness) | ✅ | parity test, 4/4 (`basic-counter`, `basic-pluralize`, `form-listbox`, `form-combobox`) |
| CSS artifacts byte-identical | ✅ | parity test, 4/4 |
| Simulated-tier components render through the **unmodified `sim/` realm** and match | ✅ | combobox+listbox pair (the corpus's only two Simulated components) — realm renders byte-identical across surfaces |
| Compose site compiles with the child's real parameter types, proven negatively: deliberate type error reported by `tsc` **on the authored parent** | ✅ | `combobox-bad-args.tsx:17` → `TS2322: Type 'string' is not assignable to type 'FormListboxOption[]'` (`spike/tsx/tsconfig.neg.json`, exit 2) |
| Both §4.4 shapes workable through the **unmodified analysis** | ✅ | async boundary renders pending arm w/ 3-root hidden toggles + one `watch()`; switch IIFE, try/catch IIFE, indexed `.map`, `&&`/ternary arms all lower and render both states; reactive `createList` `.map` produces the `reconcile()` plan + extracted `<template>` |
| Front-end re-target materially smaller than the surface it replaces | ✅ (with projection caveat below) | ledger below |
| Machinery survives the IR seam untouched | ✅ | **zero changes to `server/tsrx/`** — `analysis/*`, both emitters, `runtime.ts`, `sim/*`, `evaluability.ts`, `reactivity.ts`, `tier.ts`, `first-refs.ts`, `imports.ts`, `i18n.ts`, `config.ts`, `infer-type.ts`, `css.ts`, `classify-attributes.ts` all imported as-is |

## Gates (exit codes, captured directly)

- `bun test server/tests/tsrx-tsx/parity.test.ts` — **26 pass / 0 fail** (4 snapshots).
- `bunx tsc -p spike/tsx/tsconfig.json --noEmit` (fixtures + host profile, `--strict --jsx preserve`) — **exit 0**.
- `bunx tsc -p spike/tsx/tsconfig.probe.json` (§7 positive) — **exit 0**; negative — **exit 2**, `TS2322 … Property 'truc:pass' does not exist` (namespaced attributes are per-element type-checkable in TS 6.0.3; the VALUE also checks against the declared key).
- `bunx tsc -p spike/tsx/tsconfig.neg.json` (compose negative) — **exit 2**, error on the authored parent.
- `bun run typecheck` (repo, includes `server/tsrx-tsx/`) — **exit 0**.
- `bun test server/tests` — 1530 pass; the 11 failures (docs route/HMR tests) reproduce on the clean tree — pre-existing, need a `build:docs` output, unrelated to the spike.

## Measured ledger

New `.tsx` front end (`server/tsrx-tsx/` + host profile): **3,335 lines**

| File | Lines | Classification |
| --- | --- | --- |
| `to-estree.ts` | 747 | **new** (TS→estree converter; the work the pinned `@tsrx/core` parser did upstream) |
| `compiler-tsx.ts` | 1,288 | 1,154 code lines — **1,044 verbatim** copies from `compiler.ts` (90%), 110 adapted (module-shape discovery: return-based instead of `@{ }` container; deleted scans; `.tsx` compose-import filter; template-literal CSS extraction) |
| `lower-tsx.ts` | 1,068 | 919 code lines — **699 verbatim** from `lower-template.ts` (76%), 220 adapted (directive cases → expression shapes; `boundary()`; `.map()` loops) |
| `index.ts` | 128 | adapted mirror of `compileComponent`'s assembly |
| `spike/tsx/host-profile.d.ts` | 104 | new (globals.d.ts vocabulary re-homed + `JSX.IntrinsicElements` surface) |

Replaced: `compiler.ts` (1,752) + `lower-template.ts` (1,148) + `core.ts` (21) + `core-shim.d.ts` (41) + `parseComposeImports` (~25) = **3,413 direct**, plus the deleted families/tooling (TSRX018/020, TSRX021–024, `REACT_ATTR_RENAMES`, `newerGrammarHint`, `scripts/codemod-react-jsx.ts`, authored-code span remap) ≈ the plan's **~5.4k format-specific layer**. `classify-attributes.ts` (451) is reused **verbatim, zero changes** — the estree JSXAttribute shapes matched exactly.

**Projection:** the spike keeps `compiler-tsx.ts`/`lower-tsx.ts` as *copies* because the shared loops are embedded inside `compileSource`/`lowerChildren` in `server/tsrx/` (untouched by constraint §6). A production merge extracts the setup-extraction loop and element/children lowering into shared modules used by both front ends, deleting ~950 copied lines → **projected ≈2.4k**, materially under both the direct (3.4k) and full (5.4k) replacements.

## Surface mapping — as measured (§5 outcomes)

- `@{ }` → setup statements + `return` — direct map; verbatim slices preserved (`paramsText`, setup text, handlers byte-identical into generated modules).
- `@if`/`@else` → `{c ? a : b}` / `{c && a}` — lowered to the identical `if` IR; union addressing, branch guards unchanged.
- `@switch` → switch IIFE — works through unmodified emitters (real `switch` + arm buffers in the server module).
- `@try`/`@catch` → try/catch IIFE; `@try`/`@pending`/`@catch` → **`boundary({ ok, pending, err })`** (ambient, recognized in child position; err arm's arrow param is the catch param). All three arms render + `hidden` toggles + one client `watch()` — the exact `@pending` IR.
- `@for` over server data (with `index i` + hoisted consts) → `.map((item, i) => { consts; return <jsx/> })` — identical `ForIR` (form-listbox's loop byte-identical through it).
- `@for` over reactive `createList` (+ `key k`) → `.map(item => …)`, **no key clause** — `keyName`/`keyText` were only ever bindItem param *names*; `keyParam ?? '_key'`/`'__key'` defaults already existed, so server bytes are keyName-independent and the client emits `_key` (structural, not byte, change — sanctioned by §4.3's client criterion).
- Bare `client-stmt` in a branch — **not expressible**, retired (diagnosed: `&&` arms must be JSX). Matches §4.4's likely-forbidden expectation; ADR 0024 s11 already restricted it.
- `{count}` attribute shorthand → `count={count}` (no JSX shorthand) — identical server-attr IR.
- `<style>` CSS → **template-literal child** (`<style>{`…`}</style>`) — raw CSS braces are illegal JSX text; bytes read from inside the backticks, dedented identically (CSS parity 4/4). A genuine surface change to teach in the host profile.
- `truc:pass` / `truc:case` / `truc:case-type` / function-valued attrs / `on*` — verbatim, and now type-checked (probe + fixtures).
- Reserved `i18n` param, `truc:case` pruning, `lang` config route — identical (pluralize Folded-tier on both surfaces, same tier, byte-identical render incl. pruned category spans).

## Notable facts for the ADR / migration tasks

1. **TS 6.0 AST/dts drift** (the new "pin"): `IfStatement.statement` → `thenStatement`; `isSequenceExpression`/`isAssignmentExpression`/`isJsxMemberExpression` exist at runtime but are **absent from the .d.ts**; `FirstStatement` is the display name for const statements — kind-name switches are wrong by construction, `ts.*` guards + the few casts in `to-estree.ts` are the boundary. `baseUrl` is deprecated (paths work without it).
2. **Global-script `.d.ts` cannot use `declare global`** — the JSX `IntrinsicElements` surface must be a top-level `namespace JSX` in a script `.d.ts` (the classic pattern); `declare global` remains correct inside module files.
3. **`@ts-expect-error` in a comment** suppresses the error on the next line even when the comment is prose saying "deliberately NOT used" — cost one debug cycle in the negative probe.
4. **Host profile is real surface**: the production profile needs per-element light-DOM attribute types (the spike's `HostAttrs` is permissive; the probes prove strict per-element/per-attribute checking works, incl. value-shape checking of `truc:pass` entries). `globals.d.ts`'s `host: HTMLElement & Record<string, unknown>` stand-in rejects managed-form member calls (`host.setCustomValidity(…)`); the spike widens to `FormAssociatedElement & Record<string, any>` — the generated client keeps precise types.
5. **Compose pass surface is child-declared**: `truc:pass={{…}}` type-checks against the child's args type only if the child declares `'truc:pass'?: { … }` on it (done for form-listbox in the fixture). The alternative — host-profile-level augmentation of function components — has no clean TS mechanism; this is the honest spelling and is part of ADR 0032 s3.
6. **IIFE recognition**: the corpus's IIFE shapes (`(() => { … })()`) are recognized structurally (0-arg call of a 0-param arrow with block body). Object identity between `callee` and `arguments[0]` does not survive a TS→estree conversion (two separate conversions) — a spike bug fixed by shape-based matching; noted for the production merge.
7. **`parsePlainImports` filters `.tsrx` specifiers only** — the `.tsx` front end must filter `.tsx` compose imports out of plain-import placement (spike does it by local-name overlap with the compose map). The production merge widens the filter to both extensions inside `imports.ts`.

## Where everything lives

- Front end: `server/tsrx-tsx/` (`to-estree.ts`, `lower-tsx.ts`, `compiler-tsx.ts`, `index.ts`).
- Fixtures: `spike/tsx/` — four ports (`basic/counter`, `basic/pluralize`, `form/listbox`, `form/combobox`), two §4.4 synthetics (`sync/sync-el.tsx`, `async/async-el.tsx`), two negatives (`jsx-probe-neg.tsx`, `combobox-bad-args.tsx`), probes (`jsx-probe.tsx`), host profile (`host-profile.d.ts`), five tsconfigs.
- Harness: `server/tests/tsrx-tsx/parity.test.ts` (26 tests).
- ADR: `adr/0032-adopt-tsx-as-the-authored-component-surface.md` (Proposed; 0024 status amended in place — unpublished).

Constraints honored: no changes under `examples/`, `server/generated/tsrx/`, or `src/`; `server/tsrx/` untouched (the reuse claim is testable by `git diff v3 -- server/tsrx` → empty).
