# The Le Truc Component Compiler

> High-level overview of the inlined component compiler for Le Truc
> (`server/compiler/`): how the pipeline works, how the two front ends relate
> to their parsers, how the server half is evaluated (tiered — value harness,
> Server Simulation, or neither), how type checking and diagnostics flow back
> to the author, and how it is embedded in the server build infrastructure.
> Companion documents: `server/SERVER.md` (build-pipeline integration), ADR
> 0024 (format decisions), ADR 0032 (the dual front end), ADR 0027 (Server
> Simulation), ADR 0029 (tiered server evaluation), `server/TESTS.md` (test
> strategy). Symbol names are stable anchors; avoid citing line numbers.

## 1. What this compiler is

An **inlined split compiler** (ADRs 0024, 0032) that turns one isomorphic
single-file source — server args, signals, `expose()`, markup, event
handlers, and scoped styles — into three artifacts plus two diagnostic
remapping tables:

| Artifact | File | Produced by |
| --- | --- | --- |
| Server render module (`render<Name>(args): string`) | `<tag>.server.ts` | `emit-server.ts` |
| Client factory module (`export default defineComponent(...)`) | `<tag>.client.ts` | `emit-client.ts` |
| Verbatim tag-scoped CSS | `<tag>.css` | `css.ts` (`dedentCss`) |
| Client + server span tables | in-memory | `spans.ts` machinery |

Two authored surfaces feed one shared machinery layer and compile to the
same artifacts (ADR 0032):

- **`.tsx` — the default.** Parsed by the repo's `typescript` dependency
  (`ts.createSourceFile`, `ScriptKind.TSX`). One exported component function
  per file: its first destructured parameter is the server args (its type
  is what compose sites check against), an optional second destructured
  parameter is the author-annotated factory context (`, { host, expose }:
  FactoryContext<Props>`; vocabulary-checked TSRX049, surface-checked
  TSRX050 — LT-209), the statements before the single
  `return` are the setup, the returned JSX is the template, and a `<style>`
  sibling carries the CSS as a `css`-tagged template literal. Control flow
  is expression-shaped — ternaries and `&&`, `.map()`, IIFEs for switch and
  try/catch, and the recognized ambient `boundary({ ok, nil, err })`
  for the async boundary (three arms; the in-flight state is the reactive
  `isPending(signal)` read beside it, folded server-side — LT-211). There
  is no `{count}` shorthand; spell
  `count={count}`.
- **`.tsrx` — retained.** The pinned `@tsrx/core` grammar: the `@{ }` setup
  block, `@if`/`@switch`/`@try`/`@for` directives with statement-context
  arms, and the `{count}` attribute shorthand. Author it where
  statement-context control flow reads better; it is the surface the
  upstream TSRX bet lives on.

The default is a rule, not a residue: new authoring is `.tsx` unless
statement-context control flow argues otherwise. Both surfaces are
first-class inputs — the corpus scan globs both extensions into one
registry, and a tag two sources declare fails the compile naming both files
(TSRX048). The parity suite
(`server/tests/compiler/tsx/parity.test.ts`) is the standing equivalence
contract: the same component authored in both surfaces must render
byte-identically, which is what keeps the surfaces from drifting apart
(ADR 0032 sub-design 6).

The server module re-declares the source's setup **verbatim** against the
runtime harness in `runtime.ts`, where a signal is its initial value in a
box (`.get()` reads once, `.set()` is a no-op) — "signals as plain values".
The client module is today's idiomatic hand-written Le Truc factory,
importing solely from `@zeix/le-truc`; authored sources import the real
package exports their setup uses, while the FactoryContext vocabulary stays
ambient via each surface's profile (`globals.d.ts` for the raw `.tsrx`
view, `host-profile.d.ts` for authored `.tsx` — ADR 0024 sub-design 16).

Entry points: `frontend/tsrx/index.ts` exports
`compileComponent(source, filename, registry, childImports?, composeRegistry?)`
and `frontend/tsx/index.ts` exports `compileComponentTsx` with the same
signature. Both are thin shells over the shared `compileFromIR`
(`pipeline.ts`), differing only in which front end parses the source, so a
pipeline change cannot drift between surfaces. Severity policy: **errors
fail the file**; **warnings skip it** (the build effect logs and moves on).

### The parser boundaries

Each surface owns one parser dependency, and the two isolate each other's
churn:

- **`.tsrx` pins `@tsrx/core`** (currently 0.1.63; ADR 0024 sub-design 2).
  `core.ts` is the **only** module importing its *values*; siblings import
  only the `TsrxNode` *type* (erased at compile time). `core-shim.d.ts` is
  the type side of that boundary — a pin upgrade touches `core.ts` and the
  shim only. The pin lags the upstream docs; when a construct the docs
  describe fails to parse, `frontend/tsrx/compiler.ts`'s `newerGrammarHint`
  names the gap.
- **`.tsx` parses with the repo's `typescript` package** through
  `frontend/tsx/to-estree.ts`, the one `typescript`-API leaf: a
  `typescript` major's AST drift touches that converter only and cannot
  reach the `.tsrx` front end, whose pinned parser's churn cannot reach
  `.tsx`.

### Grounding an agent

To author or migrate `.tsrx` source, point an agent at
<https://tsrx.dev/llms.txt> for the upstream grammar, not general JSX/React
training — TSRX is close enough to JSX that the React prior fires at full
strength (`{cond && <x/>}`, `return (<>…</>)`, `className`/`htmlFor` are the
observed failure modes; TSRX021–024 and the `classify-attributes.ts`
`REACT_ATTR_RENAMES` table hard-error them rather than silently emitting
broken output — on the `.tsrx` surface only; on `.tsx` those idioms are the
correct spellings, and `className`/`htmlFor` simply fail the strict ambient
table). One caveat is host-specific: `&{}`/`&[]` lazy destructuring, real
in core TSRX 0.1, is retired outright here — Le Truc's server composition
needs eager snapshot evaluation (TSRX018/020 at the 0.1 pin; since the 0.2
pin the grammar itself drops the construct and a binding-position `&{ … }`
fails as a parse error, TSRX008, with TSRX018 surviving for the child
sigil). The default surface needs no
grammar grounding: `.tsx` is standard TypeScript, and its contract is the
strict ambient profile (`frontend/tsx/host-profile.d.ts`,
`HOST_PROFILE.md`).

## 2. Pipeline at a glance

```
        .tsx source                    .tsrx source
               │                                 │
┌──────────────┴────────────────┐  ┌─────────────┴───────────────┐
│ TSX FRONT END                 │  │ TSRX FRONT END              │
│ compiler-tsx.ts               │  │ compiler.ts                 │
│ parse: typescript package     │  │ parse: @tsrx/core (pinned,  │
│   (to-estree.ts converts)     │  │   via core.ts)              │
│ control-flow dispatch         │  │ control-flow dispatch       │
│   (lower-tsx.ts)              │  │   (lower-template.ts)       │
│ ternary/&& → if               │  │ @if @switch @try @for       │
│ .map() → for                  │  │ statement-context arms      │
│ IIFE → switch / try-catch     │  │                             │
│ boundary({ ok, nil, err })    │  │                             │
└──────────────┬────────────────┘  └─────────────┬───────────────┘
               │                                 │
┌──────────────┴─────────────────────────────────┴───────────────┐
│ SHARED FRONT-END STAGES                                        │
│ setup extraction, params contract, context seeding,            │
│ template-output resolution, validation tail, verbatim          │
│ module scans, IR assembly — front-end.ts                       │
│ condition validation, element/compose lowering,                │
│ expression-child lift rule, positional reactivity —            │
│ lower-shared.ts (each surface passes its dispatch hooks)       │
│ attribute classification — classify-attributes.ts              │
│ signal type inference — infer-type.ts · config — config.ts     │
│ CSS dedent — css.ts · import placement — imports.ts            │
└───────────────────────────────┬────────────────────────────────┘
                                │  ComponentIR (ir.ts)
┌───────────────────────────────┴────────────────────────────────┐
│ SHARED PIPELINE — pipeline.ts (compileFromIR)                  │
│ compose validation against the composeRegistry                 │
│ CLIENT ANALYSIS (analysis/*) → ClientPlan                      │
│   pass 1  for-IR → each() plans                                │
│   pass 1b  list-IR → reconcile plans                           │
│   pass 2  signal render sites                                  │
│   pass 3  harvest plans                                        │
│   pass 4  top-level effects                                    │
│ tier classification — tier.ts                                  │
└───────┬───────────────────────┬────────────────────────────────┘
        │ ClientPlan            │ (errors gate here)
        ▼                       ▼
    ┌─────────────┐       ┌─────────────┐
    │ emit-server │       │ emit-client │
    │ .server.ts  │       │ .client.ts  │
    └─────────────┘       └─────────────┘
```

`compileFromIR` (`pipeline.ts`) wires the post-front-end stages in exactly
this order and validates composed elements against the corpus-wide
`composeRegistry` before analysis; both front ends run it, so the two
surfaces cannot drift after lowering. The two-pass corpus orchestration
(registry discovery, then real compilation) lives in the consumer,
`server/effects/tsrx.ts` (§ 7).

## 3. Module map

Machinery first, then the shared front-end modules, then the two front ends:

| Module | Role |
| --- | --- |
| `pipeline.ts` | Shared post-front-end pipeline (`compileFromIR`): compose validation, `analyzeClient`, tier classification, both emitters, the registry entry — `CompiledComponent`/`CompileFileResult` live here |
| `frontend/tsrx/index.ts` | `.tsrx` public API: `compileComponent` = `compileSource` + the shared pipeline |
| `frontend/tsx/index.ts` | `.tsx` public API: `compileComponentTsx` = `compileSourceTsx` + the shared pipeline |
| `ir.ts` | Pure type leaf: the whole IR vocabulary (`ComponentIR`, `TemplateNode`, `AttributeIR`, `SignalIR`, `ForIR`, `ConfigIR`, …) |
| `front-end.ts` | Front-end-neutral shared stages: setup extraction (`extractSetup`), the params contract (`extractParams`), context seeding, template-output resolution, the post-lowering validation tail, the verbatim module scans (malformed selectors, import mismatches, deferred collector calls), and IR assembly |
| `lower-shared.ts` | Surface-independent lowering core: condition validation, element/compose lowering, the expression-child lift rule, positional reactivity, and `lowerChildrenSkeleton` — the `Lowering` hooks carry each surface's child-node dispatch |
| `ast-utils.ts` | Shared AST predicates and the recognized-name vocabulary constants both front ends' walks run on |
| `walk.ts` | Generic structural `TemplateNode` visitor (`walkTemplate`, `collectAttrs`, `collectComposeElements`) |
| `frontend/tsrx/compiler.ts` | `.tsrx` front end: `compileSource` (locate the `@{ }` component, slice setup + output verbatim) plus the grammar's own scans (React JSX near-misses, `newerGrammarHint`; the lazy-pattern scan retired at the 0.2 pin — the grammar now rejects the construct itself) |
| `frontend/tsrx/lower-template.ts` | `.tsrx` directives (`@if`/`@switch`/`@try`/`@for`) → `TemplateNode` IR; list-body validation |
| `frontend/tsrx/globals.d.ts` | Ambient FactoryContext vocabulary for the raw `.tsrx` view; parity-tested against `ast-utils` |
| `frontend/tsx/compiler-tsx.ts` | `.tsx` front end: `compileSourceTsx` (locate the exported component function, statements + single `return` shape, `boundary()`/`css` recognition) |
| `frontend/tsx/lower-tsx.ts` | `.tsx` expression shapes → `TemplateNode` IR; shape-based IIFE recognition (`asIife`, `lowerSwitchIife`) |
| `frontend/tsx/to-estree.ts` | `typescript`-AST → estree-shaped `TsrxNode` converter — the only `typescript`-API leaf |
| `frontend/tsx/host-profile.d.ts` | The strict authored-`.tsx` ambient profile: FactoryContext vocabulary plus the strict per-element `JSX.IntrinsicElements` light-DOM contract (migrations extend it in the same commit). Never in one `tsc` program with `globals.d.ts` |
| `core.ts` | The only `@tsrx/core` value-import leaf (`.tsrx` front end only) |
| `core-shim.d.ts` | Type shim for the pinned `@tsrx/core` |
| `classify-attributes.ts` | `JSXAttribute` → `AttributeIR`/`ComposeAttrIR`; shared `truc:pass={{ }}` parser |
| `reactivity.ts` | `classifyChild` — the reactive-lift rule: is a template child reactive, static, or untraceable? |
| `evaluability.ts` | `dependenciesOf` + `isServerEvaluable` — the server-known dependency-closure rule; host-derived fold helpers. Under ADR 0029 this is also the first conjunct of the **tier classifier** (§ 5) |
| `i18n.ts` | The reserved `i18n` parameter's compiler vocabulary: `export const i18n` extraction (quoted keys included; dotted keys must end in a CLDR category), the `lang` binding/default lookup, `PLURAL_CATEGORIES` |
| `infer-type.ts` | Signal value-type inference |
| `config.ts` | `export const config` extraction |
| `imports.ts` | Compose-import resolution (accepts `.tsrx` AND `.tsx` specifiers — cross-surface composition falls out of the path-keyed registry) + plain import collection and placement |
| `first-refs.ts` | Structural matcher for `first(selector, reason?)`: which template element(s) an author's selector refers to; compose-deferral test; ref-presence guards |
| `selector-syntax.ts` | Conservative CSS selector *parse* validation for `first()`/`all()` — reports only what no CSS parser accepts |
| `registry.ts` | `RegistryEntry` type (incl. per-prop `ExposeKind`) + `registryJson` |
| `analysis/plan.ts` | `ClientPlan` types, `AnalysisContext` assembly, `analyzeClient` orchestration |
| `analysis/selectors.ts` | Pure selector engine: synthesis, structural uniqueness, union/compose addressing |
| `analysis/compose-refs.ts` | Registry-aware resolution of `first()` references addressing composed children |
| `analysis/naming.ts` | `uniqueName`, `addQuery` (query table + name allocation) |
| `analysis/harvest.ts` | Passes 2+3: render sites, harvest-plan selection, arg→DOM-site substitution |
| `analysis/loops.ts` | Passes 1+1b: `each()` and `reconcile()` planning |
| `analysis/effects.ts` | Pass 4: document-ordered per-construct effect planning |
| `emit-server.ts` | `ComponentIR` → server render module |
| `emit-client.ts` | `ComponentIR` + `ClientPlan` → client factory module |
| `spans.ts` | Generated↔source span recording + lookup |
| `tier.ts` | The tier classifier (§ 5): routing signals in, the component's tier + recorded reasons out |
| `indent.ts` / `css.ts` | Template-literal-safe reindentation / `<style>` dedent |
| `diagnostics.ts` | Diagnostic codes TSRX001–048, message factories |
| `runtime.ts` | Server-evaluation harness — imported **by generated code only**, never by the compiler (also re-exports `compose-attrs.ts`, the compose-site `class`/`id` post-processing used by generated markup) |
| `smoke.ts` | Dev script: compile corpus, execute renders, print |
| `sim/` | Server Simulation driver (§ 5): `patch-table.ts`, `realm.ts`, `boundary.ts`, `report.ts` |

**Dependency shape**: every module points strictly at `ir.ts` (types) and
the shared leaves — `ast-utils.ts`, `walk.ts`, `evaluability.ts`,
`reactivity.ts`, `first-refs.ts`, and the front-end-neutral `front-end.ts`/
`lower-shared.ts` (which import no parser values by design, only the loose
`TsrxNode` type) — with no runtime value cycles; the machinery does not
depend on either front end. Within `analysis/`, `plan.ts` orchestrates
`{selectors, naming, harvest, loops, effects}`, with `harvest.ts` imported
back by `loops.ts` and `effects.ts` for a few shared signal-read predicates
— the one edge that isn't a strict fan-out from `plan.ts`.

## 4. Core data model

**`ComponentIR`** (`ir.ts`) — one extracted component, the shared input of both
emitters: name/tag/source, the verbatim destructured server args, all setup
statements (split into signal declarations, plain consts, connect-time
client-only statements), the verbatim `expose()` call with per-key
classifications (Slot-backed, computed, method, Parser-backed), the lowered
template root, `@for` IR, dedented CSS, extension `config`, type declarations,
leading JSDoc, and the placed plain imports (`server` / `client`).

**`SignalIR`** — one declared signal: name, verbatim text/span, recognized
constructor (`createCell`/`createState`/`createList`/`createStore`/
`deriveCell`/`deriveList`/`deriveStore`/`requestContext`), initializer,
inferred type. `requestContext` additionally carries its verbatim fallback
text.

**`TemplateNode`** — the template IR union:

| Kind | Payload | Notes |
| --- | --- | --- |
| `element` | `tag, attrs, children` | Lowered JSX element; `<style>` becomes a placeholder |
| `text` | `value` | JSX text after whitespace collapse |
| `expr` | `expr, lazy` | A child expression; `lazy` marks it reactive (decided by `reactivity.ts`: a lexically visible signal or `host.<prop>` read lifts; an expression over server args stays static; a signal escaping into an opaque call is TSRX017) |
| `if` | `test, then, alternate` | Server-known condition; server renders the taken branch, client addresses both roots |
| `switch` | `discriminant, cases[]` | Mutually exclusive arms |
| `try` | `children, catchParam, catchChildren, pendingChildren?` | `pendingChildren ≠ null` ⇒ async boundary: all arms render, `hidden`-toggled. Three arms on both surfaces — the four-arm `stale` spelling the `.tsx` front end briefly carried was withdrawn by the owner (LT-211); the in-flight state is the reactive `isPending` idiom beside the boundary, folded server-side |
| `compose` | `component, source, attrs, children` | PascalCase tag bound to an authored-source import (either surface); server splices the child's render |
| `client-stmt` | `text` | Bare client-only side effect inside a branch (`.tsrx` only — a `.tsx` branch must return JSX) |

**`AttributeIR`** — per-attribute: `static`, `server` (render-time expression),
`reactive` (thunk → `watch()`), `pass` (`truc:pass={{ }}`), `class-map` /
`style-map`, `html` (sanitized dynamic rendering), `event` (stripped
server-side), `ref`.

**`ClientPlan`** (`analysis/plan.ts`) — what the client half needs:
`queries` (`first`/`all`/non-throwing, with cardinality `'one' | 'many' |
'maybe'`), `harvests` (how each signal seeds from the DOM at connect — text,
attribute, list membership, initializer substitution, or List container
adoption; a `requestContext` signal never appears: it has no DOM seed), and
`effects` (the document-ordered effect list: `watch`-bindings, `pass`, `on`,
`each`/`reconcile` blocks, guarded optional-branch effects, async tri-state
toggles). Every plan node carries source spans for the remapping tables.

Two rules worth naming because they shape both halves:

- **Watch-attribute dispatch**: a `host.<prop>` mirror, or a dirty-flag IDL
  attribute (`value`/`checked`/`selected`) on a native form control, lowers to
  `bindProperty` — once a control is dirty, rewriting the content attribute no
  longer moves the live property, so an attribute dispatch would silently stop
  tracking. Everything else lowers to `bindAttribute`.
- **The arg-and-prop coincidence**: a site rendering a name that is both a
  server arg and an `expose()`d prop is the "one site, three roles" shape of
  ADR 0024 sub-design 3 — render target, harvest source, and binding target in
  one authored site. Parser-exposed props are excluded (their seeding channel
  IS the host attribute, so a second copy warns, TSRX039).

**`RegistryEntry`** (`registry.ts`) — the per-tag record the corpus-wide
registry holds: source paths, emitted module texts, CSS, props type, and
`exposedProps` mapping every `expose()` key to an `ExposeKind` (`'slot'`,
`'computed'`, `'method'`). This is what makes `truc:pass={{ }}` legality
decidable at compile time (ADR 0028); a target with no entry stays on the
**Contained** runtime backstop (ADR 0028).

**Reserved parameters** — server args the compiler supplies rather than the
caller: `children` (ADR 0024 s10, composed children) and `i18n` (ADR 0030,
the locale record: `lang`, the component's resolved messages `t`,
`timeZone`/`currency`, and `dir`). A component receives one only by declaring
it; declaring it costs the caller nothing, so composition never threads
locale by hand. Both are ordinary destructurable args, so the value is
server-known and folds in phase 1 — which is why an i18n component is Folded-tier
eligible rather than the Simulated tier (§ 5). The record's locale resolves by
precedence (ADR 0030 s3 as amended by LT-191): an explicit `lang` arg at the
compose site, else the PARENT'S effective locale — compose-graph inheritance,
the SSR analog of the DOM ancestor walk, since the composition tree is the
rendered ancestor chain — else the component's authored default, else the
build's page locale. The EFFECTIVE locale renders onto the root `lang`
attribute, exempt from TSRX039 by ADR 0024 s3's root-attribute exclusion.
Client-side, `lang` is a CONFIG attribute, not a reactive property: it is a
built-in IDL property, so `expose()` cannot install an accessor over it
(`prop in this` skips silently), and a compiled component MATERIALIZES the
walked locale onto the attribute at connect — the same thing the server
render did, so the DOM carries one answer both paths agree on.

**Message resolution** (ADR 0030): a component declares each message key
*with its source-locale string inline in the authored source, either
surface* — `export const i18n =
{ key: 'Source string', … }` (extracted by `i18n.ts`, same posture as
`readConfig`; quoted keys are keys too — a dotted key is a string Literal,
which no bare identifier can spell) — so there is deliberately no
per-component catalog file, which would reintroduce the sibling-file drift
ADR 0024 cures. Values must be string literals: they are the fallback every
locale resolves against and the bytes the staleness manifest hashes, so the
source locale declares EVERY key its template references — the fallback
bytes always exist. **Plural word forms are per-category keys**
(`<key>.<category>` — `'task.one'`, `'task.other'`; LT-190): a dotted key
must end in a CLDR plural category (a shape error otherwise — a typo'd
suffix would silently never resolve AND corrupt the census's reachability
input), and the span carrying each `truc:case` category references its own
key. Translations are additive per-locale
override files, component-namespaced (`i18n/de.json`, keys `<tag>.<key>`),
with **no tiering and no override stack**: a key resolves in exactly one
place. The compiler resolves `t` at render time — the generated `i18n`
module (`server/effects/i18n.ts` folds the corpus catalogs into it) exposes
`i18nRecord(tag, lang?)`, which every render call boundary uses to supply
the reserved record — and the catalog never reaches the client. A missing
key renders the source-locale string and is recorded in the build report's
**translation census** (`translationCensus`, `sim/report.ts`; machine-
readable artifact at `server/generated/tsrx/i18n-report.json`) — not a
compile warning, since it is not author-fixable. The census is
REACHABILITY-AWARE (LT-190): a `<key>.<category>` message whose category is
outside the locale's platform set — read per locale for the component's
statically proven `truc:case-type` (`RegistryEntry.caseType`:
`'cardinal'`/`'ordinal'` when provable, `'union'` otherwise — the runtime's
own fallback) — sits in a pruned span that cannot render there, so its
absence is the translator's nothing-to-do, not a gap; a locale's catalog
carries exactly its own reachable set. Staleness rides a committed
manifest (`i18n/manifest.json`, per locale per key the source hash the
translation was recorded against): a source-string edit is a `.tsrx` edit
that silently invalidates that key's translations, so an override without a
matching manifest hash reports `stale`. Literal prose inside a
catalog-using component IS author-fixable and warns (TSRX047 — template
text with two or more adjacent letters; single-letter fragments are page
data). The build stays read-only: an explicit `i18n:sync` script — never
the build — writes missing keys into the committed catalogs and refreshes
the manifest.

**Per-locale pruning of rendered alternatives** (ADR 0030 s6): with the locale
a build constant, a component rendering one alternative per plural category
prunes to the set the locale actually uses (`{one, other}` for English rather
than all six). The set comes from `runtime.ts`'s `pluralCategories` —
`Intl.PluralRules(lang, opts).resolvedOptions().pluralCategories`, a platform
fact rather than a hand-maintained table — the same posture as the ARIA
mapping in ADR 0024 s4. The author marks each alternative `truc:case="one"`
(a CLDR category literal; consumed by the compiler, renders no attribute) and
declares the configured `type` once per group with
`truc:case-type={ordinal ? 'ordinal' : undefined}` — evaluated per render
call, so a dynamic configuration prunes tightly in both states; an
explicit `undefined` is the `Intl` default (cardinal), and a group with no
declared type prunes to the cardinal∪ordinal union, the ADR's sanctioned
fallback. The client keeps the element's `hidden` toggle over the pruned set,
addressed with `'maybe'` cardinality (the element may not render at all);
deeper constructs inside a case element have no addressing and are rejected.
**The client-side toggles do NOT retire**: the
locale is fixed but the category-selecting input (`host.count`) is reactive,
and the client can only select among strings the server rendered.

**Context protocol** (ADR 0024 sub-design 15): `requestContext(Context,
fallback)` is a recognized signal-constructor form — its fallback must be
server-known, the server renders the fallback value via `createCell`, and the
client emits the call verbatim, destructured from the factory context; it
never gets a harvest plan. `provideContexts([...])` lowers to a connect-time
client-only statement and renders nothing.

## 5. Server evaluation: tiers, the value harness, and Server Simulation

Server evaluation answers one question — *what does a reactive expression
render before JavaScript loads* — and ADR 0029 tiers the answer. Template
lowering is NOT tiered: every component in every tier gets a server render
module from `emit-server.ts`, because the simulation realm parses that
module's markup as its own input. What is tiered is the evaluation of
reactive INITIAL VALUES.

### 5.1 The three tiers

| Tier | Mechanism | Condition |
| --- | --- | --- |
| **1** *Folded* | `emit-server.ts` + the `runtime.ts` value harness. No jsdom. | Phase 1 resolves everything. |
| **2** *Simulated* | The `sim/` driver (ADR 0027). | Phase 1 does not resolve everything **and** the realm can plausibly answer. |
| **0** *Static* | The phase-1 skeleton only; unresolved expressions omitted. | Phase 1 does not resolve everything **and** the realm cannot answer either. |

The Static tier sits below the Folded tier because it resolves *less*, not more. It is what
today's compiler already does when the fold gives up — promoted from an
accident of a failed proof to a routed decision with a recorded reason.

### 5.2 The classifier

Two different facts, deliberately kept apart (ADR 0029 s1).

**Unresolvability is a property of an EXPRESSION**: no server phase can
produce its value. Two limbs —

- **(a) stubbed API** — every read routes through something
  `sim/patch-table.ts` declares the realm cannot answer: layout geometry
  (jsdom has no layout engine; reads return zeros), the absent-API stubs
  (`ResizeObserver`, `matchMedia`, `IntersectionObserver`,
  `requestAnimationFrame`), the closed network globals. `ElementInternals` is
  no longer one binary row (LT-177): the realm's skeletal internals leaves
  ARIA expressions answerable — `bindAria()` falls back to the host content
  attribute, which serializes — while `internals.states` and the form members
  stay unanswerable.
- **(b) not a server-side fact** — the value is a function of the moment the
  page is VIEWED, or of the build machine's own ambient state: the wall clock
  (`Date.now()`, `new Date()`), the RNG (`Math.random()`), a locale falling
  back to the runtime default. This is `evaluability.ts`'s existing
  `containsImpureAmbient` set.

**An unresolvable expression is omitted in EVERY tier, the Simulated tier included.** The
realm must not fold one: a build-time `Date.now()` is not an approximation
the client corrects, it is a stale value cached into the served HTML for the
life of the page (`evaluability.ts`'s own comment already says so). Since the
generated client module is the shipped artifact, the realm cannot decline to
install the binding — suppression is a serialization-time step, and it must
run AFTER the fixed-point gate's second connect pass, never between the two,
or the gate compares a suppressed tree against an unsuppressed one.

**Tier is a routing decision about a COMPONENT** — which mechanism to run:

- **Phase-1 totality** reuses `evaluability.ts` (`isServerEvaluable`,
  `hostDerivedFold`) and `analysis/harvest.ts`'s site detection unchanged in
  mechanism, inverted in polarity. Every site that used to trigger a refusal
  is now a Simulated-tier routing signal: no harvestable render site (old `TSRX004`),
  no server-renderable value for a semantically-loaded attribute (old
  `TSRX034`), a setup const reading a `first()` ref (old `TSRX043`), a
  client-only primitive or a `host`/`internals` read in a plain setup const
  or a derived compute (the server-evaluation members of old `TSRX013`).
- **The Static tier is the degenerate case**: every phase-1-unresolved expression is
  unresolvable, so no mechanism needs to run at all.

Keeping the stub table load-bearing for limb (a) is deliberate: when the
driver gains a capability, deleting the patch-table row re-routes the
affected expressions and their components automatically. Limb (b) has no such
escape hatch — no driver capability can tell the build machine what time it
will be when the page is read.

**`module-ticker` is why the two facts stay separate.** It calls
`Math.random()` and is heavily `first()`-based (template, table, tbody,
toggle button). Component-level the Static tier would discard everything the realm
could resolve; component-level the Simulated tier would bake the random walk's seed into
the page. It is the Simulated tier with one suppressed expression.

`Intl` splits along the same seam: a locale resolving to a server-known value
keeps a component Folded-tier-eligible. A locale READ from the DOM folds only
when the compiler can splice the read to server truth: `host.lang` mirrors
the root `lang` attribute when that attribute is server-rendered — `lang`
and `dir` are platform config attributes whose native accessors read the
attribute verbatim, so they need no parser (LT-191's third `foldableHostProps`
route; parser-exposed and arg-rendered props are the first two) — while an
ANCESTOR WALK through a user-land helper (`getLocale(el)`) is outside the
fold vocabulary and routes Simulated, because the realm executes that read
for real. Only a runtime-default locale is unresolvable under limb (b).
`basic-pluralize` reads `host.lang` over a root-rendered config attribute and
is Folded-tier (LT-173): its locale is server-known through the reserved
record.

**Classification is static and conservative.** There is no render-time
fallback from phase 1 to phase 2 — the fallback condition is exactly what the
analysis already decides ahead of time. A component is Folded-tier only when phase
1 is provably total; any doubt routes downward. A false Simulated classification costs ~1.1 ms;
a false Folded-tier ships wrong HTML with no diagnostic.

**Composition contaminates on reads, not containment.** A Folded-tier or Static-tier
parent that merely embeds a Simulated-tier child splices the child's already-rendered
markup and keeps its own tier — the compose graph renders children before
parents. Contamination applies only when the parent READS the child: a
`first()` addressing a compose site, or a `truc:pass={{ }}` into it. The rule
is a fixpoint over the compose graph, computed in the registry-aware second
pass alongside `analysis/compose-refs.ts`.

### 5.3 The Folded tier — generated render modules and the value harness

`emit-server.ts` walks the IR and emits a `render<Name>(args): string`
function: per-kind dispatch over the template (escaped text, server
expressions, real JS conditionals for `if`/`switch` nodes, isolated arm
buffers for async boundaries, composition calls for `compose` nodes), and
setup re-declared verbatim against the `runtime.ts` harness, where a signal
is its initial value
in a box (`.get()` reads once, `.set()` is a no-op) — "signals as plain
values". A thunk whose closure is not directly server-known gets the
**host-derived fold**: an expression whose every read has a compiler-known
server truth (a Parser prop's root attribute, a prop harvested from a
same-named server arg, a `first()` ref's branch presence) is spliced to an
initial value. The fold is all-or-nothing: one non-substitutable read
disqualifies the expression — and, under ADR 0029, routes the component out
of the Folded tier.

Measured against the corpus, the Folded tier is the **majority** path: the
classifier folds 20 of 22 components (Simulated: `form-combobox` via
compose-read, `form-listbox`; Static: none yet). `first()` in
`watch()`/`on()` positions is a client concern that reaches no served byte
and was never a refusal site — what routes a component is a site whose
*server render* phase 1 cannot complete.

### 5.4 The Simulated tier — Server Simulation (ADR 0027)

The server renders initial HTML by **executing the generated client module**
against jsdom and serializing the reactive graph's initial state. The client
stays ground truth and corrects at connect. The driver lives in `sim/`:

- **`patch-table.ts`** — declarative substrate data: real DOM constructors
  forced from the jsdom window, inert stubs for absent APIs
  (`ResizeObserver`, `matchMedia`, …), network globals replaced with
  never-settling no-ops (a build can never depend on the network; a fetching
  component stays on its pending arm). `PROTOTYPE_PATCHES` is empty since
  LT-177: `attachInternals()` is left alone so jsdom's skeletal internals
  reaches the library and `bindAria()` can bind the attribute the served HTML
  carries. Also the second conjunct of the tier classifier (§ 5.2).
- **`realm.ts`** — `createSimulationRealm`: loads the client module with a
  recording `customElements`, parses the SSR'd markup, replays the
  definitions so the upgrade runs, serializes. It seeds the simulated
  document's `<html lang>` from the page's build locale (ADR 0030 s7) —
  without it, `document.body.innerHTML = markup` leaves the ancestor chain
  truncated and `getLocale()`'s `closest('[lang]')` silently resolves the
  `'en'` fallback regardless of the page's actual locale; realm diagnostics are
  attributed to the component whose window was open. Renders are isolated
  enough to be a function of `(component, args)` — each component loads once
  against a shared registry, disposal is end-of-process. Suppression (LT-165
  step 7): the registry's `suppressedSites` (§ 5.2 limb b) records each
  unresolvable expression's target site; the driver snapshots the sites'
  skeleton state from an inert parse of the markup and reverts them after
  the quiescence drain and before serializing — never inside the drain — so
  an impure binding's connect-time write never bakes the build machine's
  reading into the served HTML.
- **`boundary.ts`** — the serialization boundary: the instantiate→serialize
  window performs no IO and advances no timers, draining microtasks to a
  bounded quiescence, so the compiler — not microtask timing — decides which
  async-boundary arm ships.
- **`report.ts`** — turns realm diagnostics into the build report (contained
  throws, network attempts, console errors become build warnings attributed
  to the component), and carries the **tier census** (§ 6).

Two gates make simulation safe to ship: **connect must be a fixed point**
(the driver runs the connect pass twice and requires byte-identical
`outerHTML`), and the resolved async arm ships only when its value is
harvestable from the markup the component itself rendered — otherwise the
pending arm ships.

For a Simulated-tier component `emit-server.ts` emits the same skeleton it emits
for everyone, minus the parts of the verbatim setup re-declaration that
skeleton does not need. Only the Folded tier evaluates setup in the value harness,
and the setup shapes that would break the harness are precisely the ones that
routed the component here.

The filter is one criterion, applied by `retainReferenced` in `emit-server.ts`:
**retain a setup statement when the emitted markup depends on its declared name,
transitively; drop the rest.** It cannot be the coarser "drop the setup, keep the
skeleton", because the skeleton and the harness are not separable layers —
`lazyValueExpression` splices `<name>.get()` into the markup, so a folded signal
is not dead code server-side and dropping its declaration emits a module that
references an undeclared name (`TS2304`).

Three cases fall out of the one criterion. A plain const is retained when the
skeleton interpolates it (`form-combobox`'s `inputId` folds into `<label for>`,
`<input id>`, `<p id>` and `aria-describedby`, which nothing downstream restores).
A folded signal is retained for the same reason. `expose()` is dropped without
being named, because it declares nothing the markup can reference — an
exposed-prop lazy child resolves through the prop→signal map at compile time to a
literal — and its `refStub` any-stubs go with it, since they exist only so its
free names resolve. Retention is transitive, which the corpus needs exactly once:
`form-textbox`'s markup reads `remainingCount`, whose thunk reads
`descriptionCell`, a name the markup never mentions — seeding from the markup
alone would drop it.

The invariant that makes the flag safe is that **the emitted markup is
byte-identical across all three tiers**, pinned corpus-wide in
`server/tests/compiler/emit-tier.test.ts`.

### 5.5 The Static tier — the static skeleton

A Static-tier component gets the phase-1 skeleton with its unresolved expressions
omitted, and the client corrects at connect. No realm is opened.

No corpus component routes here today — the census is 20 Folded / 2 Simulated /
0 Static. The components with unanswerable reads (`module-scrollarea`'s scroll
geometry — at 2,091 occurrences the corpus's largest would-be cost driver —
`card-mediaqueries`' `matchMedia`, `form-colorgraph`'s `getBoundingClientRect`,
`form-textbox`'s and `form-spinbutton`'s `internals.states`) keep those reads in
client-only positions: `watch()`/`on()` sources reach no served byte, so phase 1
completes and the Folded tier covers them. The tier exists for the shape where
an unanswerable read reaches a RENDERED site — a scroll-overflow state folded
into an attribute, a media query baked into markup — and every unresolved
expression is of that kind. Simulating such a component would spend the realm's
per-occurrence cost and produce nothing the client does not already correct.

### 5.6 The equivalence audit

Two evaluating mechanisms coexist — the value harness and the realm — which
is the hazard ADR 0027 rejected when it declined to keep the determinism gate
alongside simulation. ADR 0029 answers it with a test rather than an argument:
**CI renders every Folded-tier component through the realm as well and requires
byte-identical output.** At ~1.1 ms per occurrence the whole corpus is ~4 s,
affordable once per CI run and not paid by the build. A divergence is a build
error against that component: either the classifier admitted a false Folded-tier,
or the two mechanisms disagree on a shape that needs reconciling. The known
case is `Date.now()` — `evaluability.ts` refuses it while ADR 0027 § 6 folds
it — and it is DISSOLVED rather than resolved: neither mechanism can answer
it, so it is unresolvable in both and omitted in both (§ 5.2 limb b). Making
the two agree by electing the realm would have blessed the wrong answer.

## 6. Type checking & diagnostics

**Span tables.** Every verbatim slice (setup statements, thunks, handlers,
`expose()`) is copied byte-identically — only reindented, template-literal-safe
— and span-recorded (`spans.ts`: `SourceSpan` maps generated offset → source
offset). This is what makes the sparse mapping sound: `tsc` diagnostics only
arise at code positions, and every code position lowers into a generated
module. `requestContext`'s server-side substitution is the one deliberate
exception (a coarse remap — there is no server-side `requestContext` to point
at).

**`check:tsrx`.** Generated client *and* server modules are type-checked by
`tsc` emit-then-check (`scripts/check-tsrx.ts`); diagnostics at generated
positions are remapped onto the authored source through
`findSpanForGeneratedOffset`. Server modules are checked because composition
makes them import each other's real types — a missing or mistyped server arg
is a real `tsc` diagnostic, remapped to the compose site. Authored `.tsx`
sources skip the detour entirely: plain `tsc` checks them directly against
`frontend/tsx/host-profile.d.ts`, with no span table and no remapping (the
`typecheck` script compiles the corpus first, so the generated modules and
ambients exist).

**Harness types ride the same gate.** Generated code calls into the
`runtime.ts` value harness (`pluralCategories`, the compose post-processing,
the fold helpers), and a harness signature narrower than what the
pruning/splice emitters pass it is caught ONLY by the
tsc-against-generated-modules gate — no unit test sits between the emitter
and the gate. Widen both sides in the same change, and treat a `check:tsrx`
failure there as a contract break, not a fixture problem.

**Diagnostic codes** (`diagnostics.ts`, TSRX001–048) fall into families:

- *Grammar and shape gates*: unrecognized setup statements, reactive `@for`
  over a non-`createList` (TSRX001), async component functions, deferred
  collector calls, retired `&{}`/`&[]` sigils.
- *React near-miss hard errors* (TSRX021–024): conditional/loop rendering
  idioms that parse but stringify JSX nodes into the HTML, plus the
  `className`/`htmlFor` rename check; `scripts/codemod-react-jsx.ts`
  mechanically rewrites the common shapes.
- *Selector and addressing rules*: malformed selector literals (TSRX026),
  ambiguous compose addressing (TSRX027), two `first()` names on one element
  (TSRX041), and a constant `id` in a template (TSRX042 — a template is
  per-instance, an id is per-document; the id belongs to whoever instantiates
  the component, as a server arg).
- *Form-association guards* (TSRX028/029): `expose()` keys that collide with
  the managed form members, and a named native control inside a
  form-associated component that would submit the field twice.
- *Harvest and evaluability*: no render site or harvest route for a signal
  (TSRX004), no server-renderable value for a reactive attribute (TSRX034),
  the Parser-prop double-render warning (TSRX039), a dead required-reason
  string (TSRX040), and the rendered-client-only-const error (TSRX046 — the
  narrow residue of this family that stays an error; see the reclassification
  below).
- *i18n*: literal prose in a component that declares
  `export const i18n` (TSRX047) — author-fixable, so a genuine warning that
  converges to zero; a missing *translation* is the translator's work and
  rides the translation census instead.
- *Corpus-level*: one component tag declared by more than one corpus source
  (TSRX048) — fires before pass 2, names every declaring file whatever
  surface each is written in, and drops them all; the dual front end's
  one-tag-one-source rule.

**Reclassification under ADR 0029.** The impure-ambient refusal is not in the
table below because it does not become a routing signal at all: it becomes
the expression-level unresolvability property (§ 5.2 limb b), omitted in
whatever tier its component lands in, with no diagnostic. Most of the rest of
the harvest-and-evaluability
family stops being diagnostics at all and becomes routing input to the tier
classifier (§ 5.2), surfaced as a **tier census** in the build report —
per component, its tier and the reason — rather than as warnings:

| Code | Becomes |
| --- | --- |
| `TSRX004` | Simulated-tier routing signal; leaves the diagnostic channel |
| `TSRX034` non-severe | routing signal; leaves the diagnostic channel |
| `TSRX034` **severe** (`disabled`/`checked` on a real submittable control) | **survives, scoped per-expression** (LT-184) — it fires when the SITE's own resolution is `none`, so no tier resolves the value, even if another signal routes the component Simulated. Its own copy is right that this is a correctness bug rather than a flash |
| `TSRX013` → `clientOnlySetupConst`, `clientOnlySignalCompute` | Simulated-tier routing signals |
| `TSRX013` → `conditionalSignalConstructor` | **unchanged** as `TSRX044` — an ADR 0024 s12 format rule, not a server-evaluation guard |
| `TSRX013` → `deferredCollectorCall` | **unchanged** as `TSRX045` — a client-side `NoActiveCollectorError` bug, tier-independent |
| `TSRX043` | Simulated-tier routing signal |
| `TSRX039` | **unchanged** — a data-ownership rule; tiering does not answer it |

`TSRX013`'s four factories are split into distinct codes (LT-165): only the
two that keep the code are server-evaluation guards.

The consequence for the regression signal: **the compile-warning baseline's
target stays zero.** Once routing signals leave the channel, the remaining
warnings are all genuinely author-fixable again. The tier census is a
separate, non-zero, expected-to-grow record with its own regression story — a
component drifting from the Folded tier to the Simulated tier is a build-cost regression worth
seeing, and it is now visible without being miscast as a warning. The census
rides the build-report channel (`server/compiler/sim/report.ts`'s generic
`Census` records via `tierCensus`/`formatCensus`), and `check:tsrx` prints it
as its own section after the compile-warning baseline.

Message copy is owned by the Tech Writer per ADR 0028's lifecycle; severity
follows the tiering decision recorded with each rule.

**Vocabulary parity.** `ast-utils.ts`'s recognized-name sets are mirrored in
`globals.d.ts` and pinned by `server/tests/compiler/globals.test.ts`, so the
compiler's ambient contract and the editor surface cannot drift. The `.tsx`
profile needs no such pin: `host-profile.d.ts` derives its ambients from the
real `@zeix/le-truc` types, and authored `.tsx` gets editor feedback through
plain tsserver — the planned span-table editor plugin retired as moot once
the primary surface stopped needing a projection.

## 7. Embedding in the server infrastructure

The compiler is build-time tooling; `@zeix/le-truc` stays browser-only and
never renders (ADR 0024 sub-design 7). jsdom never ships to clients.

- **Corpus orchestration** (`server/effects/tsrx.ts`, a docs-build effect):
  the scan globs `examples/**/*.tsrx` AND `examples/**/*.tsx` into one file
  list and `compileTsrxCorpus` dispatches per extension; pass 1 compiles
  every file against a registry seeded with hand-written example tags,
  collecting compilable tags and the corpus-wide `composeRegistry`; pass 2
  re-compiles with the full registry, child imports, and compose registry.
  The duplicate-tag check (TSRX048) runs between the passes: it names every
  declaring file and drops them all before pass 2's registry could make
  their order load-bearing. Artifacts land in the gitignored
  `server/generated/tsrx/` plus `registry.json`. Errors fail the run;
  warnings skip the file with a notice.
- **Consumers**: `server/build.ts` (via the `index.ts` facade plus direct
  `registry`/`spans` imports), `check:tsrx` (§ 6), and the CEM build
  (`scripts/build-tsrx.ts` feeds `cem analyze`, which reads the generated
  clients; ADR 0024 sub-design 9).
- **Browser purity gate**: `scripts/build-tsrx-browser.ts` bundles
  `server/compiler/frontend/tsrx/index.ts` for the browser target with `node:*` externals left
  unshimmed, and `server/tests/compiler/browser-bundle.test.ts` asserts no
  `node:` import survived and that a fixture compiled through the bundle is
  byte-identical to the Node build — the seed of the in-browser playground
  compiler.
- **Golden tests** (`server/tests/compiler/*.golden.test.ts`) pin server renders,
  CSS bytes, client snapshots, and diagnostics for the corpus; regenerate
  with `bun server/tests/compiler/update-snapshots.ts`. The fixture-pinned
  corpus is load-bearing for simulation: where the simulated answer can only
  approximate (layout reads return zeros, absent APIs are `undefined`), drift
  is caught by fixtures, not assumed absent.
- **Parity suite** (`server/tests/compiler/tsx/parity.test.ts`): the
  equivalence contract — each fixture authored in both surfaces must render
  byte-identically through the same machinery, including a three-arm
  `boundary` render and the `isPending` class binding (LT-211). It is the mechanical
  form of "the door stays open": a front-end change that makes the surfaces
  diverge fails here before it can ship.

See `server/SERVER.md` for the effect wiring, `check:sim` (portability probe
across runtimes) and `eval:substrate` (substrate evaluation scripts).

## 8. Cross-cutting invariants

- **DOM-is-truth** (ADR 0003/0024 s3): the server renders each reactive
  expression's initial value by its tier's mechanism — folded in the value
  harness (the Folded tier), simulated (the Simulated tier), or omitted (the Static tier) — and the client
  corrects at connect. No serialized state payload ever ships, in any tier.
- **Tier is decided statically and conservatively** (ADR 0029, § 5.2): the Folded tier
  only when phase 1 is provably total; any doubt routes downward. There is no
  render-time fallback. A false Simulated classification costs ~1.1 ms; a false Folded-tier ships
  wrong HTML with no diagnostic, so the classifier is sound, not complete.
- **Verbatim slices, sparse spans**: source code is never rewritten, only
  reindented — which is what makes the span tables sound (§ 6).
- **Selector uniqueness is proven structurally** against the template the
  compiler itself renders (`analysis/selectors.ts`; role → bare tag →
  discriminator, exclusivity-aware counting for branches). Discriminators use
  canonical CSS spellings — classes match by token membership, ids and
  `type`/`data-*` exactly. `matchesSelector` must parse exactly the grammar
  the synthesizer emits: an unparsed selector reads as "no collision" and
  would quietly disarm per-branch addressing.
- **The template proves what a component RENDERS, never what it will FIND**
  (ADR 0024 s11): `first()` cardinality is the weaker of author claim and
  site proof — one literal is optional (non-throwing, guarded effects), two
  literals required with the reason string flowing verbatim into the
  `MissingElementError`. Author-declared optional refs may address markup the
  page authored; structural verification is enforced for required refs only.
  Compose sites are addressed the same way, resolved registry-aware in
  `analysis/compose-refs.ts`.
- **Addressing limits**: one reactive list per component; one addressable
  construct root per `@if` branch (union-addressed when every branch root
  carries an identical construct signature, per-branch guarded otherwise; a
  `first()`-addressed element is exempt — it has its own query and presence
  guard); composed children accept statics and server expressions only.
- **One machinery, two front ends**: after lowering, both surfaces consume
  identical stages through `pipeline.ts`, and the shared `front-end.ts`/
  `lower-shared.ts` modules import no parser values — a pipeline change
  cannot drift between surfaces. The parity suite is the render-level pin
  (§ 7).
- **A control-flow arm is statement context on `.tsrx` only**: `@if`/`@else`
  bodies parse as JS statements, not JSX children — a grammar fact of the
  pinned parser. The `.tsx` front end's branches are expressions that must
  return JSX; bare statements live in setup.
- **Pin isolation**: `@tsrx/core` values enter through `core.ts` only, and
  only the `.tsrx` front end imports them; `typescript`-API access is
  confined to `frontend/tsx/to-estree.ts`. Each surface's parser churn stops
  at its own leaf.
- **Server stubs never reach the markup**: the server module may stub
  client-only free names for type-checking, but never a `first()` ref — a ref
  stub whose value reached the markup would render an empty string where the
  author asked for a DOM read.
- **Browser purity is CI-pinned** (§ 7).

---

*Companion documents: `server/SERVER.md` (build-pipeline integration),
`adr/0024-adopt-tsrx-as-isomorphic-component-format.md` (format decisions),
`adr/0032-adopt-tsx-as-the-authored-component-surface.md` (the dual front end),
`adr/0027-server-simulation.md` (Server Simulation),
`adr/0029-tiered-server-evaluation.md` (tiered server evaluation),
`server/TESTS.md` (test strategy), `HOST_PROFILE.md` (host decisions for
both authored surfaces).*
