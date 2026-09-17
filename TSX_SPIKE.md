# TSX Surface Spike — Re-targeting the Compiler Front End from `.tsrx` to `.tsx`

> **Status:** EXECUTED 2026-09-17 — verdict **GO** (`spike/tsx/FINDINGS.md`, commit db0a0be5);
> ADR 0032 Accepted with the owner's dual-front-end amendment (`.tsrx` retained). This plan is
> now the historical record of the spike's design; the ADR owns the decision. Written 2026-09-06 after an architecture review of
> ADRs 0024/0027/0028/0029/0030, `TSRX-HOST-PROFILE.md` and
> `server/tsrx/LE_TRUC_COMPILER.md`; facts refreshed 2026-09-17 after the `next`
> (ADR 0031) and `feature/internationalization` merges landed on v3. Execute on a spike
> branch (`spike/tsx-surface`, fast-forwarded to the v3 tip, baseline verified green) in a
> dedicated session; time-box to one session.
> §2 records decisions already made — do not re-litigate them. §8 is the decision gate.

## 1. Why this spike exists

The 2026-09-06 architecture review concluded that "the TSRX compiler" is two things
stacked on each other, and only one of them is worth re-examining:

- **The machinery** — server evaluation (value harness, jsdom realm, tiering), harvest
  rules, DOM-is-truth seeding, contract checking, censuses (~10k of the compiler's ~17k
  lines). This is the price of the actual goal — *reactive initial values in served HTML
  without hydration* — and no format choice sheds it. Upstream SSR pipelines (React,
  Solid) **hydrate**; Le Truc **harvests** (ADR 0003, no payload). Nothing off the shelf
  does harvest-based enhancement.
- **The surface** — `.tsrx` as a bespoke grammar on a pinned 0.x parser (`@tsrx/core`).
  This is where complexity has accumulated, and it is largely optional.

A **custom JSX profile** — standard `.tsx` plus one host transform, Solid's shape but
with an enhancement target instead of a render target — can carry the entire ADR
0024–0030 design. The spike tests that claim empirically before anything is committed.

What switching the surface would delete (see Appendix A for the full ledger):

| Deleted | Cause |
| --- | --- |
| `@tsrx/core` pin, `core-shim.d.ts`, `newerGrammarHint`, upstream-alignment effort | Bespoke parser at 0.x |
| TSRX021–024 React near-miss family, `REACT_ATTR_RENAMES`, `scripts/codemod-react-jsx.ts`, the "ground an agent at tsrx.dev/llms.txt" caveat | TSRX is JSX-adjacent-but-not-JSX; with real JSX the React prior becomes *correct* |
| Span tables + emit-then-check remapping **for authored code** | Editors cannot check `.tsrx`; with `.tsx`, `tsc` checks authored sources directly and compose type-flow runs through the child's real parameter types |
| Broken editor support today; LT-014 (Volar plugin) becomes moot | Same cause |
| `emit-server.ts`'s IR→string walk (potentially) | Replaceable by a small string-rendering JSX runtime (post-spike option, not in spike scope) |

What survives unchanged under either outcome: `analysis/*`, `evaluability.ts`, `tier.ts`,
`emit-server.ts`, `emit-client.ts`, `runtime.ts`, `sim/*`, `globals.d.ts`, the
`runtime.ts` value harness, the tier classifier and census, i18n design (ADR 0030), and
every shipped library contract (M1–M16; `src/` untouched).

What is honestly given up: grammar-native control flow with statement-context arms
(`@if { … }` bodies become ternaries/`&&`/IIFEs), and the upstream TSRX bet (shared
grammar, future editor tooling, influence over a young spec). `TSRX-HOST-PROFILE.md`
itself documents that this bet is not currently paying: Zed's TSRX language service
cannot resolve imports, the pin lags upstream docs, and Le Truc is the only
server-oriented host profile, so "grammar sharing" currently shares with nobody.

## 2. Decisions already made (2026-09-06)

1. **Stand-alone transform core.** The transform is source-to-source: `.tsx` in, emitted
   TypeScript modules out (server render module, client factory, CSS) — never `jsx()`
   runtime calls into a client bundle. JSX semantics never execute anywhere. Pipeline
   shape is unchanged from today: two-pass corpus compile ahead of bundling, generated
   modules type-checked in CI, bundled as plain inputs. `Bun.Transpiler` exposes no AST
   and Rollup's `this.parse()` yields ESTree, so the AST layer is bundler-independent
   regardless of any future plugin choice.
2. **Parser: the `typescript` package** (already a devDependency, ^6.0.3).
   `ts.createSourceFile(..., ts.ScriptKind.TSX)` gives a full-fidelity JSX + TS AST with
   exact spans. NOT oxc-parser — it is a 0.x fast-moving parser with an evolving API;
   picking it would recreate the pinned-parser situation ADR 0024's boundary work just
   paid to contain. Compile time is dominated by analysis and simulation, not parsing, at
   this corpus scale. oxc stays a future swap behind the same single-module boundary.
3. **No Babel.** The user-visible concern "buying into a Babel transform step that does
   not fit our model of server-rendered HTML" is structurally avoided: the transform
   emits the same artifact classes as today, and JSX is purely the authored surface.
4. **The repo's own build needs no adapter.** `server/effects/tsrx.ts` keeps calling the
   core API directly under Bun. Adapters are thin and last: **Vite first** when v3
   packaging happens (largest consumer segment; REQUIREMENTS §5 "Bun primary, Vite
   compatible"; agency personas bundle with Vite or Bun), a Bun adapter only on real
   consumer demand — Bun plugins only load under the `bun` runtime, so a Bun-plugin
   basis would exclude Node tooling.
5. **Two-phase codegen-to-directory.** Generated modules land in a directory so
   `check:tsrx` (tsc over generated files) and the CEM analyzer keep working
   bundler-agnostic. The spike emits to its own directory, never
   `server/generated/tsrx/` (the ported components share tags with the real corpus).
6. **`sim/` stays out of the core's import graph.** The transform core stays jsdom-free
   so a shipped package is portable to any runtime; the simulation realm imports the
   *generated* modules, not the compiler. Also preserves ADR 0025's browser-purity
   invariant for the (still Proposed) playground.
7. **Authored `.tsx` never executes its JSX.** Spike tsconfig sets `jsx: preserve`;
   authored files are type-checked but never bundled (generated clients are bundled,
   exactly like today's generated clients replace `.ts` twins).

## 3. The thesis being tested

**`ComponentIR` is the seam.** The current front end (`compiler.ts`,
`lower-template.ts`, `classify-attributes.ts`, `imports.ts`, `first-refs.ts`,
`core.ts`) turns TsrxNode ASTs into `ComponentIR`; everything downstream —
`analysis/*`, both emitters, `runtime.ts`, `sim/`, the tier classifier — consumes only
the IR. If a new front end over the TypeScript parser can produce the same IR for an
equivalently-authored component, the entire machinery is reused unmodified and the
surface switch is a front-end swap, not a compiler rewrite.

The spike's deliverable is the *measurement*: how much of the front end ports verbatim,
how much adapts, how much is genuinely new — and whether any control-flow shape is
unworkable in JSX.

## 4. Scope

### 4.1 Build: a minimal `.tsx` front end (spike-local, e.g. `server/tsrx-tsx/`)

- **Parse** with `ts.createSourceFile` (`ScriptKind.TSX`).
- **Extract the module shape:** one exported component function per file; its single
  destructured parameter is the server args (types flow to compose sites for free);
  reserved parameters `children` and `i18n` recognized as compiler-supplied (ADR 0024
  s10, ADR 0030 s2); statements before the single `return` are the setup (the `@{ }`
  block's replacement); the returned JSX (bare root or fragment) is the template; a
  `<style>` element sibling inside the returned fragment is the CSS (the fragment shape
  is already the `.tsrx` convention, ADR 0024 s11 — `css.ts`'s dedent carries over).
- **Lower** JSX → `TemplateNode`/`AttributeIR`, adapting the logic in
  `lower-template.ts`/`classify-attributes.ts`. Adapt at the lowering layer so the
  emitters and analysis see one IR — do not fork IR variants.
- **Reuse unchanged or near-unchanged:** `reactivity.ts` (the reactive-lift rule),
  `first-refs.ts`, `selector-syntax.ts`, `evaluability.ts`, `tier.ts`, `analysis/*`,
  `emit-server.ts`, `emit-client.ts`, `spans.ts`, `runtime.ts`, `ir.ts`,
  `registry.ts`, `css.ts`, `indent.ts`, `globals.d.ts`, `sim/*`.
- **Delete by omission (never ported):** `@tsrx/core` + `core.ts` + `core-shim.d.ts`,
  lazy-pattern retirement checks (TSRX018/020), the React near-miss family
  (TSRX021–024, `REACT_ATTR_RENAMES`), `newerGrammarHint`. `class`/`for` are the
  attribute surface (light DOM, tag-scoped CSS) — `className`/`htmlFor` are simply not
  declared in the ambient types, so the React prior yields a tsc error on the authored
  file instead of needing a diagnostic family.

### 4.2 Port: four components (not three — compose pulls the child in)

Spike fixtures in `spike/tsx/` mirroring the source structure, authored to be
semantically identical to the `.tsrx` originals:

| Component | Why it is in the set |
| --- | --- |
| `examples/basic/counter/basic-counter.tsrx` | Smallest Folded-tier component; exercises `expose`, `first`, `on`, `watch`+`bind` lowering |
| `examples/basic/pluralize/basic-pluralize.tsrx` | **Folded-tier since LT-173/190/191** (the i18n record makes its locale server-known; its six standing TSRX034/routing warnings dissolved). Now the corpus's i18n fixture: reserved `i18n` parameter, per-category dotted keys (`t['task.one']`), `truc:case`/`truc:case-type` attributes, `lang` as a config attribute folding via the platform-config route, and the `materializeLocale` connect-time setup shape — the newest authored surface, proven under `.tsx` |
| `examples/form/combobox/form-combobox.tsrx` | Compose site (`import { FormListbox } from '../listbox/form-listbox.tsrx'`) + `truc:pass` filter wiring; **Simulated tier via compose-read — with listbox, the corpus's only two Simulated-tier components, so the sim/ machinery seam is exercised end to end by this pair** |
| `examples/form/listbox/form-listbox.tsrx` | Pulled in as the compose child of form-combobox; also the corpus's async-boundary consumer |

### 4.3 Compare against the existing goldens

`server/tests/tsrx/server.golden.test.ts` and `client.golden.test.ts` pin per-component
server renders and client snapshots. The comparison harness:

- **Server renders: byte-identical** to the `.tsrx` golden for each ported component.
  This is the bar — ADR 0029's invariant (markup byte-identical across tiers) extends to
  across *surfaces* for identically-authored components.
- **Client modules: structurally equivalent**, not byte-identical (naming and import
  placement may differ); reviewed snapshots.
- Simulated-tier components render through the **unmodified** `sim/` realm and match
  their golden.

### 4.4 Assess the two hardest control-flow shapes

Paper assessment plus one synthetic fixture each, ported through the unmodified
analysis:

- **Async boundary (`@try`/`@pending`/`@catch`):** prototype one JSX spelling (e.g.
  recognized three-arm markup). The "which arm ships is a compiler decision +
  harvestability check" logic is compiler-side either way; only the authored shape is
  in question.
- **Statement-context arms and loops (`module-ticker` shapes, `@for`×11):** IIFE arms
  over conditional JSX, and `.map()` in template position with the dual lowering
  decision (server data → static; reactive `List` → `each()`/`reconcile()`) made by the
  existing analysis, not by syntax. Also decide the fate of bare `client-stmt` inside a
  branch — likely forbidden in the `.tsx` surface (statements belong in setup), which
  would retire an already-restricted construct (ADR 0024 s11 rejects it in `@else`
  branches).

## 5. Surface mapping

| `.tsrx` | `.tsx` spelling | Status |
| --- | --- | --- |
| `@{ }` setup block | Statements before the component function's single `return` | Direct map |
| `<style>` beside the root | Same fragment shape; `css.ts` dedent reused | Direct map |
| `@if (c) { A } @else { B }` | `{c ? A : B}`; single-branch `{c && A}`; statement arms via IIFE | `tsc`-verified (§7); ergonomics to assess |
| `@switch` | IIFE containing a `switch` returning JSX per arm | To prototype |
| `@for` over server data | `{items.map(item => …)}` | Analysis distinguishes; dual lowering carries |
| `@for` over reactive `List` | Same `.map()` over a `createList` result, recognized by analyzed type | To prototype (reconcile plan path) |
| `@try`/`@pending`/`@catch` | Recognized three-arm spelling | Design needed (§4.4) |
| Bare `client-stmt` in a branch | Likely forbidden; statements live in setup | Decide during spike |
| `truc:pass={{ … }}` | Verbatim — see §7: TS 6.0.3 parses and type-checks namespaced JSX attribute names | Verified |
| `on*` event attributes | Verbatim JSX props (`onClick`); stripped server-side as today | Direct map |
| Function-valued attributes (`class={() => …}`) | Verbatim; ambient types declare `(() => T)` overloads | Verified |
| Lazy `&{}`/`&[]` destructuring | Gone with the grammar (TSRX018/020 retire) | Deleted |
| FactoryContext vocabulary (`expose`, `first`, `host`, `internals`, …) | Still ambient via `globals.d.ts` — same mechanism, already parity-tested | Carries over |

## 6. Out of scope

- No migration of corpus components beyond the four fixtures; no changes to `examples/`
  or `server/generated/tsrx/`.
- No changes to `src/` — the library contract is identical under both outcomes.
- No diagnostic copy work, no TSRX code changes, no ADR writing during the spike
  (§8's decision gate produces the ADR *after* the spike).
- No packaging, no Vite/Bun adapter, no editor tooling.
- No weakening of existing compiler behavior; the spike is additive and parallel.
- No decision on the string-rendering-JSX-runtime replacement for `emit-server.ts`
  (Appendix A) — recorded as a post-spike option only.

## 7. Verified facts (probes already run, 2026-09-06)

Run with the repo's TypeScript (6.0.3), `bunx tsc --noEmit --strict --jsx preserve` over
scratch `.tsx` files using `declare global { namespace JSX { … } }`:

1. **Namespaced JSX attributes parse AND type-check.** `<my-el truc:pass={{ v: 1 }} />`
   against an `IntrinsicElements` entry that does not declare it errors `TS2322` naming
   `"truc:pass"` as a property key — so `truc:pass` survives verbatim in `.tsx` and is
   type-checkable per element (declare `'truc:pass'` in the ambient entry, or on a
   composed component's props type). This corrects an older assumption that TypeScript
   rejects namespace prefixes in JSX attribute names; that no longer holds.
2. **Function-valued attributes, dashed attributes, and IIFE statement blocks in
   children position all type-check** under `--strict` (probe declared
   `class?: string | (() => string)` and passed an IIFE arm rendering conditional JSX).
3. `--jsx preserve` avoids jsx-runtime module resolution; authored files are never
   emitted by `tsc`, so `preserve` costs nothing (decision §2.7).

Re-run these in-repo as the spike's first step (a `spike/tsx/jsx-probe.tsx` under the
spike tsconfig) before building anything.

## 8. Decision gate

**GO** when all of the following hold:

- Acceptance criteria from §4.3/§4.4: server renders byte-identical to the goldens for
  all four ported components (Simulated-tier ones through the unmodified realm); compose
  site compiles with the child's real parameter types — prove this negatively by
  introducing a deliberate type error at the compose site and confirming `tsc` reports
  it on the **authored parent**; both §4.4 shapes have a workable spelling through the
  unmodified analysis.
- The front-end re-target is materially smaller than the surface it replaces (the
  format-specific layer measures ~5.4k lines including the deleted families; record
  verbatim/adapted/new line counts in the findings).

On GO: write an ADR (via `adr-keeper`) superseding ADR 0024's **surface** sub-designs —
1 (format), 4 (attribute semantics spelled on TSRX grammar), 6 (type flow via
emit-then-check for authored code), 14 (import placement on TSRX imports), 16 (authored
imports/ambient split stays, re-homed to `.tsx`) — plus the dialect diagnostic families.
Sub-designs 3, 5, 7–13, 15 carry over essentially unchanged. ADR 0024 s2's packaging
gate ("no separate package before TSRX reaches 1.0") dissolves — the standalone core can
ship without an upstream dependency; Vite adapter at packaging time per §2.4.
TSRX-HOST-PROFILE.md is rewritten as the `.tsx` host profile; LT-014 (Volar plugin)
retires as moot; REQUIREMENTS M17/M25 wording follows the ADR.

**NO-GO** when a control-flow shape proves unworkable beyond corpus tolerance, or the
IR seam requires rewriting analysis/emitters (i.e., the machinery does **not** survive).
Document why in the findings; TSRX stands with evidence instead of assumption; existing
TODO continues; the spike branch dies.

Either way, the machinery investment is not wasted — that is the point of testing the
IR seam first.

## 9. Sequencing

- **Gates wave 4 (P5, LT-095–LT-111):** do not migrate further components to `.tsrx`
  before the go/no-go — a surface switch after migrating 17 more components would double
  the churn. The LT-178/LT-179 gate window is the natural place to run the spike.
- **P1 (LT-165) and P2 (LT-173–175/190–192) have landed** — the parallel-safety note is
  history: the spike is now the sole decision gate before wave 4. ADR 0031 (pre-connect
  property writes, merged from `next`) is machinery-side and survives both outcomes
  untouched; LT-193 removed the sim render cache, so the realm renders every occurrence
  fresh — nothing in the spike touches or depends on that either way.

## Appendix A: Complexity ledger

| Complexity | Cause | Shed by `.tsx` surface? |
| --- | --- | --- |
| jsdom realm, fixed-point gate, quiescence boundary | SSR-without-hydration | No — inherent |
| Tiering, census, equivalence audit | Cost of the realm at corpus scale | No (and tiering already paid it down: the simulated stage is ~60 ms for 8 occurrences, LT-175/LT-193; the Static tier is empty today) |
| Harvest / one-site-three-roles / arg-and-prop rules | The enhancement data account | No — format-independent |
| `@tsrx/core` pin, shim, `newerGrammarHint` | Bespoke parser at 0.x | **Yes** |
| TSRX021–024 family, `REACT_ATTR_RENAMES`, codemod, agent-grounding caveat | JSX-adjacent-but-not-JSX | **Yes** — prior becomes correct |
| Span tables + emit-then-check remap for authored code; compose typing via registry + remap | Editors cannot check `.tsrx` | **Shrinks to near zero** — authored sources checked directly; compose args flow through real parameter types |
| Broken editor support today; LT-014 | Same cause | **Yes** |
| `emit-server.ts` IR→string walk | Bespoke template lowering | **Replaceable** by a small string-rendering JSX runtime + value-box signals (Folded tier); post-spike option |

## Appendix B: References

- ADRs: 0024 (format; the decision under revision), 0027 (Server Simulation),
  0028 (tiered error surfacing), 0029 (tiered server evaluation), 0030 (i18n as
  build-time server data)
- `server/tsrx/LE_TRUC_COMPILER.md` (pipeline, IR, module map — §2's pipeline diagram
  is the seam diagram with the front end swapped)
- `TSRX-HOST-PROFILE.md` (host decisions; becomes the `.tsx` profile on GO)
- Goldens: `server/tests/tsrx/server.golden.test.ts`, `client.golden.test.ts`
- Discoverability: TODO.md LT-183
