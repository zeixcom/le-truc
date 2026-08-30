# The Le Truc TSRX Compiler — Architecture Reference

> Deep-dive companion to `server/SERVER.md` § "TSRX Compiler" and ADR 0024. SERVER.md
> describes how the compiler plugs into the docs build; this document describes the
> compiler itself: its modules, data types, control flow, and cross-cutting invariants.
> Symbol names are stable anchors; avoid citing line numbers from this file.
>
> This document reflects the compiler **after** the LT-022/LT-039–044 regrouping
> (§7 of the previous revision, now executed — see § 7 "Regrouping history" for
> what moved and what's still open).

## 1. What this compiler is

An **inlined split compiler** (ADR 0024) that turns one isomorphic single-file
`.tsrx` source — server args, signals, `expose()`, markup with `@if`/`@switch`/
`@try`/`@for` directives, event handlers, and scoped styles — into three artifacts
plus two diagnostic remapping tables:

| Artifact | File | Produced by |
| --- | --- | --- |
| Server render module (`render<Name>(args): string`) | `<tag>.server.ts` | `emit-server.ts` |
| Client factory module (`export default defineComponent(...)`) | `<tag>.client.ts` | `emit-client.ts` |
| Verbatim tag-scoped CSS | `<tag>.css` | `css.ts` (`dedentCss`) |
| Client span table (generated↔source, LT-011) | in-memory | `spans.ts` machinery |
| Server span table (LT-019) | in-memory | `spans.ts` machinery |

The server module re-declares the source's `@{ }` setup **verbatim** against the
runtime harness in `runtime.ts`, where a signal is its initial value in a box
(`.get()` reads once, `.set()` is a no-op) — "signals as plain values". The client
module is today's idiomatic hand-written Le Truc factory, importing solely from
`@zeix/le-truc`; the `.tsrx` source imports the real package exports its setup
uses and its library/plain helpers, while the FactoryContext vocabulary stays
ambient (`globals.d.ts`, ADR 0024 sub-design 16).

The parser dependency `@tsrx/core` is **pinned at 0.1.60** (ADR 0024 sub-design 2).
`core.ts` is the **only** module importing its *values*; siblings import only the
`TsrxNode` *type* (erased at compile time) from `ir.ts` or directly from
`@tsrx/core`. `core-shim.d.ts` is the type side of that boundary — a pin upgrade
touches `core.ts` and the shim only.

Entry point: `index.ts` exports `compileComponent(source, filename, registry,
childImports?, composeRegistry?)` → `{ component: CompiledComponent | null,
diagnostics }`. Severity policy: **errors fail the file**; **warnings skip it**
(the TSRX001 milestone gate nulls the component inside `compileSource`; the build
effect logs and moves on).

**Grounding an agent to author or migrate `.tsrx` source** (CHECKLIST §11): point it
at <https://tsrx.dev/llms.txt> for the upstream grammar, not general JSX/React
training — TSRX is close enough to JSX that the React prior fires at full strength
otherwise (`{cond && <x/>}`, `return (<>…</>)`, `className`/`htmlFor` are the
observed failure modes; TSRX021/022/024 and the `classify-attributes.ts`
`REACT_ATTR_RENAMES` table hard-error them rather than silently emitting broken
output). Two caveats specific to this host profile, not covered by the upstream
docs: the pinned `@tsrx/core` 0.1.60 lags the docs — a construct the docs describe
may not parse yet (`compiler.ts`'s `newerGrammarHint` names the gap when it bites);
and `&{}`/`&[]` lazy destructuring, real in core TSRX, is retired outright here
(LT-052, TSRX018/020) — Le Truc's server composition needs eager snapshot
evaluation, so an agent trained on upstream examples using it will hit a hard
error, by design.

## 2. Pipeline at a glance

```
                .tsrx source
                     │
     ┌───────────────┴───────────────┐
     │  FRONT END  (compiler.ts)     │  compileSource
     │  parse (core.ts → @tsrx/core) │  ├─ parseComposeImports      (imports.ts)
     │  setup extraction             │  ├─ parsePlainImports        (imports.ts)
     │  template lowering            │  ├─ lowerChildren           (lower-template.ts)
     │  attribute classification     │  │   └─ classifyAttribute(s) (classify-attributes.ts)
     │  signal type inference        │  ├─ inferType                (infer-type.ts)
     │  config extraction            │  ├─ readConfig               (config.ts)
     │  CSS dedent                   │  ├─ dedentCss                (css.ts)
     │  import placement             │  └─ placePlainImports        (imports.ts)
     └───────────────┬───────────────┘
                     │  ComponentIR  (shared vocabulary, defined in ir.ts)
     ┌───────────────┴───────────────┐
     │  CLIENT ANALYSIS (analysis/*) │  analyzeClient(component, registry, diags, composeRegistry)
     │  pass 1  @for → each() plans  │  → ClientPlan       (analysis/plan.ts, orchestration)
     │  pass 1b List @for → reconcile│                     (analysis/loops.ts)
     │  pass 2  signal render sites  │                     (analysis/harvest.ts)
     │  pass 3  harvest plans        │                     (analysis/harvest.ts)
     │  pass 4  top-level effects    │                     (analysis/effects.ts)
     └──────┬────────────────┬───────┘
            │ ClientPlan     │ (errors gate here)
            ▼                ▼
     ┌─────────────┐   ┌─────────────┐
     │ emit-server │   │ emit-client │
     │ .server.ts  │   │ .client.ts  │
     └─────────────┘   └─────────────┘
```

`compileComponent` (in `index.ts`) wires the stages in exactly this order and also
validates composed elements against the corpus-wide `composeRegistry` **before**
analysis. The two-pass corpus orchestration (registry discovery, then real
compilation) lives in the consumer, `server/effects/tsrx.ts`.

## 3. Module inventory

| Module | Size | Role | Intra-package imports |
| --- | ---: | --- | --- |
| `index.ts` | 133 | Public API; `compileComponent` pipeline assembly; flat re-exports | analysis/plan, compiler, diagnostics, emit-client, emit-server, registry, spans |
| `compiler.ts` | 1335 | Front end: `compileSource` (parsing, setup extraction), `collectComposeElements`; whole-module scans `reportLazyPatterns` (TSRX020) and `reportReactJsxNearMisses` (TSRX021–023, LT-054); post-lowering `first(selector, required)` resolution (LT-055, via `first-refs.ts`); post-config `formAssociated()` checks `reportNamedFormControls` (TSRX029) and managed-member shadowing (TSRX028, LT-058/LT-059) | ast-utils, config, core, css, diagnostics, first-refs, imports, infer-type, ir (types), lower-template, walk |
| `ir.ts` | 530 | Pure type leaf: the whole IR vocabulary (`TemplateNode`, `AttributeIR`, `ComponentIR`, `SignalIR`, `ForIR`, `ConfigIR`, `ExtractContext`, …) | diagnostics (type), `@tsrx/core` (type) |
| `core.ts` | 21 | The **only** `@tsrx/core` value-import leaf (`parseModule`, `isStyleElement`, `getStyleElementStylesheet`, `isTemplateForOfNode`, `isVoidElement`) | `@tsrx/core` (values) |
| `walk.ts` | 102 | One structural `TemplateNode` visitor (`walkTemplate`, `childNodes`) + `collectAttrs` | ir (types) |
| `evaluability.ts` | 372 | `dependenciesOf` + `isServerEvaluable` — the single home of the server-known dependency-closure rule — plus the host-derived FOLD rule that widens it (`foldableHostProps`/`foldableRefGuards`/`hostDerivedFold`/`spliceHostDerivedFold`, § 5.4) | ast-utils, first-refs, ir (types) |
| `reactivity.ts` | 209 | `classifyChild` — the single home of the reactive-lift rule (LT-051): is a template child reactive, static, or untraceable? | ast-utils |
| `lower-template.ts` | 1129 | JSX/`@if`/`@switch`/`@try`/`@for` → `TemplateNode` IR; list-body validation | ast-utils, classify-attributes, core (`isTemplateForOfNode` value), diagnostics, ir (types), reactivity |
| `classify-attributes.ts` | 377 | `JSXAttribute` → `AttributeIR`/`ComposeAttrIR`; shared `truc:pass={{ }}` parser | ast-utils, diagnostics, ir (types) |
| `infer-type.ts` | 145 | Signal value-type inference (`string\|number\|boolean\|unknown`) | ast-utils |
| `config.ts` | 111 | `export const config` extraction **only** | ast-utils, diagnostics, ir (types) |
| `imports.ts` | 546 | Compose-import resolution + plain (non-`.tsrx`) import collection and placement | ast-utils, diagnostics, evaluability, ir (types), walk |
| `analysis/plan.ts` | 577 | `ClientPlan`/`QueryPlan`/… types, `AnalysisContext` assembly, `analyzeClient` orchestration | ast-utils, diagnostics (type), evaluability, ir (types), registry (type), walk, analysis/{effects,harvest,loops,naming} |
| `analysis/selectors.ts` | 536 | Pure selector engine: synthesis, structural uniqueness (branch-exclusivity counting), union/compose addressing, `enclosingIfOf`, `loopFor` | ir (types) |
| `analysis/naming.ts` | 78 | `uniqueName`, `addQuery` (query table + name allocation) | ir (type), analysis/plan (type) |
| `analysis/harvest.ts` | 773 | Passes 2+3: render sites, harvest-plan selection, `paramDomRead`/`substituteArgExpr`; shared signal-read AST predicates | ast-utils, diagnostics, evaluability, ir (types), analysis/plan (types), analysis/selectors |
| `analysis/loops.ts` | 474 | Passes 1+1b: `each()` and `reconcile()` planning | ast-utils, diagnostics, evaluability, ir (types), analysis/harvest (`returnsNumber`), analysis/plan (types), analysis/selectors |
| `analysis/effects.ts` | 1433 | Pass 4: document-ordered per-construct effect planning | ast-utils, diagnostics, ir (types), analysis/harvest (`lazyWatchSource`, `returnsNumber`), analysis/plan (types), analysis/selectors |
| `emit-server.ts` | 925 | `ComponentIR` → server render module | ast-utils, core (`isVoidElement` value), evaluability, ir (types), registry (type), spans |
| `emit-client.ts` | 694 | `ComponentIR` + `ClientPlan` → client factory module | analysis/plan (types), ast-utils, imports (`computeClientNeededNames`), ir (types), spans |
| `spans.ts` | 239 | Generated↔source span recording + lookup (LT-011); also owns plain `reindent` (moved from `emit-server.ts` in the M7 dedup) | indent |
| `indent.ts` | 134 | Template-literal-safe line classification for reindentation (LT-010) | — (leaf) |
| `css.ts` | 38 | `<style>` dedent | — (leaf) |
| `diagnostics.ts` | 884 | Diagnostic codes TSRX001–029, message factories | — (leaf) |
| `first-refs.ts` | 395 | `collectMatchingElements`/`shareExclusiveIf` — structural matcher `first(selector, required)` resolution uses to find which template element(s) an author's selector refers to (LT-055), replacing `ref={}`; also `refBranchGuard`/`inOptionalBranch`, the ref-presence half of the fold rule (LT-118, § 5.4) | ir (types) |
| `registry.ts` | 36 | `RegistryEntry` type + `registryJson` | — (leaf) |
| `runtime.ts` | 366 | Server-evaluation harness — imported **by generated code only**, never by the compiler | — (leaf) |
| `smoke.ts` | 83 | Dev script: compile corpus, execute renders, print | analysis/plan, compiler, emit-client, emit-server |
| `globals.d.ts` | 60 | Ambient vocabulary for editor surfaces; parity-tested against `ast-utils` | — |
| `core-shim.d.ts` | 41 | Type shim for the pinned `@tsrx/core` | — |

External consumers: `server/effects/tsrx.ts` and `server/build.ts` (via `../tsrx`,
i.e. the `index.ts` facade, plus direct `registry`/`spans` imports); tests import
overwhelmingly through the facade.

**Dependency shape**: every module now points strictly at `ir.ts` (types), `core.ts`
(the one `@tsrx/core` value import), `walk.ts`, `evaluability.ts`, and
`reactivity.ts` as shared leaves — no runtime value cycles remain. Within `analysis/`, `plan.ts` orchestrates
`{selectors, naming, harvest, loops, effects}`, and `harvest.ts` is itself imported
back by `loops.ts` and `effects.ts` for a handful of shared signal-read predicates
(`returnsNumber`, `lazyWatchSource`) — the one edge inside `analysis/` that isn't a
strict fan-out from `plan.ts`.

## 4. Data types

### 4.1 Front-end IR (defined in `ir.ts`)

**`ComponentIR`** — one extracted component; the shared input of both emitters:

| Field | Type | Meaning |
| --- | --- | --- |
| `name` / `tag` / `source` | `string` | Function name, custom-element tag (root tag), original source text |
| `paramsText` / `paramNames` | `string` / `string[]` | Verbatim destructured-args parameter; bound names (server args) |
| `setup` | `SetupStmt[]` | All setup statements verbatim (`{ text, range, node, name }`), source order |
| `clientSetup` | `SetupStmt[]` | Connect-time side effects (LT-008); client module only |
| `plainSetup` | `SetupStmt[]` | Plain (non-signal, non-`expose()`) setup consts — a subset of `setup` the client factory also needs to re-emit (LT-034 follow-up); `setup` as a whole remains the server-only verbatim re-declaration |
| `signals` | `SignalIR[]` | Declared signal constructors, incl. `requestContext` (LT-035) |
| `exposeText` / `exposeRange` / `exposeArgNode` | — | Verbatim `expose({...})`, its span, its argument node |
| `exposeProps` | `Map<string,string>` | prop → signal name (`expose({ prop: sig.get })`) |
| `parserExposeProps` | `Map` | prop → `{ parser, fallbackText }` (`expose({ prop: asString('') })`) |
| `exposeAmbients` | `string[]` | Ambient names `expose()` uses (`as*` factories, `defineMethod`) |
| `contextRefs` | `string[]` | Context members referenced from setup/expose (`host`, `internals`, `requestContext`, `provideContexts` — LT-035) |
| `config` | `ConfigIR \| null` | Extension activation (`export const config`) |
| `root` | element `TemplateNode` | Template root (style block removed) |
| `fors` | `Map<TsrxNode, ForIR>` | `@for` loops keyed by their AST node |
| `css` | `string` | Dedented verbatim stylesheet |
| `typeDecls` / `globalDecl` / `propsTypeName` | — | Exported `type`/`interface`s, `declare global`, `<Name>Props` |
| `componentDoc` | `string \| null` | Leading JSDoc, carried above the generated default export (LT-006) |
| `serverKnown` | `ReadonlySet<string>` | Names server-known at template evaluation (args + setup) |
| `imports` | `{ server: string[]; client: string[]; serverLocalNames: ReadonlySet<string> }` | Placed plain imports, ready to splice (LT-034); `serverLocalNames` lets `emit-server.ts` skip the `exposeArgNode` `any`-stub for a name that already has a real server import |

**`SignalIR`** — `{ name, text, textStart, constructor, init, inferredType,
fallbackText }` where `constructor ∈ {createCell, createState, createList,
createStore, deriveCell, deriveList, deriveStore, requestContext}`. `textStart`
supports the client's seed-substitution surgery (replacing an arg-dependent
initializer with a DOM harvest read). `fallbackText` is `requestContext`-only —
see § 4.4.

**`TemplateNode`** — the template IR union:

| Kind | Payload | Notes |
| --- | --- | --- |
| `element` | `tag, attrs: AttributeIR[], children` | Lowered JSX element; `<style>` becomes a placeholder element |
| `text` | `value` | JSX text after whitespace collapse |
| `expr` | `expr, exprText, lazy` | A child expression. `lazy` marks it reactive, decided by `reactivity.ts`'s lift rule (LT-051): a lexically visible signal or `host.<prop>` read lifts, an expression over server args stays static, and a signal escaping into an opaque call is TSRX017. Two names are reactive *by position* rather than declaration — a `@catch` arm's error param and a reactive `@for`'s item binding — and are marked in `lowerTry`/`lowerFor` via `markPositionallyReactive`. The `&{expr}` sigil is retired (LT-052): it is TSRX018, and a string literal naming a prop is TSRX019 (`{host.<prop>}` instead) |
| `if` | `test(Text), then, alternate` | Server-known condition; server renders taken branch, client union-addresses both roots |
| `switch` | `discriminant(Text), cases[]` | Mutually exclusive arms |
| `try` | `children, catchParam, catchChildren, pendingChildren?` | `pendingChildren ≠ null` ⇒ **async boundary** (sub-design 13): all three arms render, `hidden`-toggled |
| `compose` | `component, source, attrs: ComposeAttrIR[], children` | PascalCase tag bound to a `.tsrx` import; server splices `render<Name>()` |
| `client-stmt` | `text, node` | Bare client-only side effect inside a branch (`internals?.states.add(...)`) |

**`AttributeIR`** — the attribute IR union: `static` (name + literal value),
`server` (expression rendered at render time), `reactive` (thunk → `watch()`),
`pass` (`truc:pass` entries → `pass()`; the bare `pass` spelling is TSRX006, LT-053), `class-map` / `style-map` (object-literal-bodied
thunks, LT-028/031), `html` (dynamic rendering, sanitized), `event` (`on*`,
stripped server-side), `ref`.

**`ComposeAttrIR`** — composed-element attributes: `ref` | `arg` (server arg,
passed verbatim regardless of shape) | `pass`. `PassEntryIR` is
`{ prop, thunk, thunkText, setThunk?, setThunkText? }` — a `{ get, set }`
descriptor carries the write-back accessor (LT-017).

**`ForIR`** — `{ itemName, indexName, keyText, keyName, listSignal, iterableText,
iterableName, hoisted[], output, node }`. `listSignal ≠ null` marks the reactive
`createList` variant (reconcile lowering); `hoisted` are the loop body's `const`
declarations that the client rebinds to element-derived reads.

**`ConfigIR`** — `{ form: 'value' | 'checked' | null, observedAttributes: string[] }`
from `export const config`; the form variant and `observedAttributes` lower to
`defineComponent`'s third argument (form variant leading, ADR 0019 ordering,
enforced structurally).

**`ExtractContext`** — threaded through the front end: `{ source, diagnostics,
serverKnown, argNames, exposedProps, parserProps, composeImports, setupInits }`.
`argNames`/`parserProps` are the two name sets LT-122's arg-and-prop rule
consults; see § 5.3.

### 4.2 Analysis plan (defined in `analysis/plan.ts`)

**`ClientPlan`** = `{ queries, harvests, effects, ambientContext, childTags }`.

**`QueryPlan`** — `{ name, selector, cardinality: 'one' | 'many' | 'maybe',
message }`. `'maybe'` is the non-throwing `first()` for a single-branch `@if`
root; `'one'` throws with the message; `'many'` is `all()`.

**`HarvestPlan`** — how each signal seeds from the DOM (ADR 0003):

| Kind | Fields | When |
| --- | --- | --- |
| `text` | query, parser | Signal rendered as a lazy text child; read `.textContent` |
| `attr` | query, attr, parser | Signal rendered by a direct attribute thunk; read attribute |
| `membership` | collection, markAttr, valueAttr, default | `String(sig.get() === c)` marks one `@for` item; find the marked element |
| `substitute` | expr | Arg-dependent initializer; each param identifier replaced by a DOM read (LT-008) |
| `list` | seed: `'verbatim' \| { container, valueSelector }` | Reconciled List: pure-literal seed reused, or container adoption |

A `requestContext` signal never gets a `HarvestPlan` entry — it has no DOM seed at
all; see § 4.4.

**`TopEffectPlan`** — the document-ordered effect list: `watch-text`, `watch-attr`
(with `dispatch: 'attribute' | 'property'` and `coerceToString`), `pass`,
`on`, `watch-style` / `watch-class` (map-form keys, LT-028/031), `each`, `reconcile`,
`raw` (verbatim client-stmt), `guarded` (effects under `if (query) { … }` for an
optional `@if`), `async` (`watch(signal, { ok, err, nil })` over three roots).
Loop-scoped variants: `LoopEffectPlan` (`watch-attr` / `watch-class` / `on` inside
`each()`; `watch-attr` carries the same `dispatch` decision as the top-level
path), `ForClientPlan` (collection + itemParam + rebindings + effects),
`ReconcilePlan` (container/template/signal/itemParam/keyParam/holeSelector/
itemEvents). Every plan node carries `sourceStart`/`sourceEnd` for the span table.

The `watch-attr` dispatch rule (LT-116), applied identically by the top-level
and loop paths: a bare `() => host.<prop>` mirror OR a dirty-flag IDL attr
(`value`/`checked`/`selected`, `DIRTY_FLAG_ATTRS`) on a native form control
(`input`/`select`/`textarea`/`option`, `DIRTY_FLAG_CONTROL_TAGS` in
`ast-utils.ts`) lowers to `bindProperty`; everything else to `bindAttribute`.
The write-side counterpart of the CHECKLIST §6 harvest rule: once a control
is dirty (user interaction, autofill, or any prior property write), rewriting
the content attribute no longer moves the live property, so an
attribute-dispatched mirror silently stops tracking — the form-radiogroup
mutual-exclusion break that stopped its cutover (NOTES LT-092). The thunk's
own type is irrelevant to the hazard (the divergence is a property of the
target), so the rule keys on attr×tag alone; loop-body descendant targets
emit `querySelector<Interface>(…)` (the map's interface name) so the keyed
`bindProperty` setter typechecks.

**`AnalysisContext`** — the explicit context threaded through all four passes
(replacing the pre-regrouping closure-shared state):

```ts
AnalysisContext = {
  component: ComponentIR
  source: string
  diagnostics: CompileDiagnostic[]
  registry: ReadonlySet<string>
  composeRegistry?: ReadonlyMap<string, RegistryEntry>
  queries: QueryPlan[]
  harvests: HarvestPlan[]
  effects: TopEffectPlan[]
  childTags: Set<string>
  ambient: Set<string>
  usedNames: Set<string>
  refNames: Set<string>
  forPlans: Map<ForIR, ForClientPlan>
  reconcilePlans: Map<ForIR, ReconcilePlan>
  addQuery: (base, selector, cardinality) => string
  collectAmbient: (node) => void
  badFreeNames: (node) => string[]
}
```

`plan.ts` builds this object once, runs the four passes over it in their
original order, and reads `queries`/`harvests`/`effects`/`ambient`/`childTags`
back out into the returned `ClientPlan`. `selectors.ts`'s `loopFor` (and its
sibling selector helpers) are pure functions imported directly by whichever pass
needs them — not context fields — so each pass re-imports what it needs from
`selectors.ts` rather than reaching through the context for it.

### 4.3 Emission & support types

- `EmittedServerModule` = `{ code, runtimeImports: Set<string>, spans }`; same
  shape for `EmittedClientModule` (`imports` names `@zeix/le-truc` symbols).
- `SourceSpan` = `{ generatedStart, sourceStart, length }` — byte-identical in
  both files; `SourceSlice` / `SpanCursor` support recording during assembly.
- `CompileDiagnostic` = `{ code: TSRX001–016, severity, message, line? }`.
- `RegistryEntry` = `{ tag, name, source, serverModule, clientModule, css, propsType }`.
- `PlainImportIR` = `{ text, localNames, sideEffectOnly, start }`.
- Runtime types: `ServerCell<T>` (read-once box), `ServerList<T>` (iterable box
  with cause-effect-parity key generation via `entries()`).

### 4.4 Context protocol — `requestContext`/`provideContexts` (LT-035, ADR 0024 sub-design 15)

A signal-shaped consumer primitive and a plain client-only provider primitive,
layered onto the existing signal/setup machinery rather than adding a new
`TemplateNode` kind:

- **`requestContext(Context, fallback)`** — recognized in `compileSource`'s setup
  loop, separately from the ordinary `SIGNAL_CONSTRUCTORS` dispatch. Requires
  exactly two arguments (TSRX015); the fallback must be server-known — its free
  identifiers ⊆ `paramNames ∪ setupInits` at that point in source order (else
  TSRX016). Produces a `SignalIR` with `constructor: 'requestContext'`,
  `init` = the fallback node, `fallbackText` = the fallback's verbatim text.
  Adds `'requestContext'` to `contextRefs`.
  - **Analysis**: explicitly skipped by the harvest pass — it never needs a DOM
    harvest site (TSRX004 does not apply).
  - **Server emission**: excluded from the constructor-import set; the compiler
    substitutes `const ${name} = createCell(${fallbackText})` for the verbatim
    `requestContext(...)` call (the span still points at the original source
    range — a deliberately coarse remap, since there's no server-side
    `requestContext` to point at).
  - **Client emission**: emitted verbatim, in its own loop (not through
    `harvestInitializer`); `requestContext` itself is destructured from the
    factory's context parameter, never imported from `@zeix/le-truc`.
  - Otherwise signal-shaped: usable in reactive attrs/lazy text exactly like
    `createCell` (its name is in `serverKnown`, so a reactive attribute reading
    it server-renders using the fallback value).
- **`provideContexts([...])`** — a bare expression statement, recognized because
  `provideContexts` is in `CONTEXT_NAMES` (`ast-utils.ts`); lowers to a
  `clientSetup` entry (same path as `internals?.states.add(...)`), never runs
  server-side. Assigning its result to a `const` instead routes through the
  plain-setup-const path, where `CLIENT_ONLY_PRIMITIVES` now includes it,
  producing TSRX013 (a client-only primitive can't back a signal declaration).

`CONTEXT_NAMES` (`ast-utils.ts`) grew from `{host, internals}` to `{host,
internals, requestContext, provideContexts}`; `CLIENT_ONLY_PRIMITIVES` grew to
include both context-protocol primitives alongside `first`/`all`/`watch`/`on`/
`pass`.

## 5. Control flow

### 5.1 Front end — `compileSource` (compiler.ts)

1. **Parse** via `core.ts`'s `parseModule` (the pinned `@tsrx/core`). A parse
   failure gets a newer-grammar hint (statement-form `switch`, `{html}`/
   `{text}`/`{ref}` keywords, setup `await`, `component`) naming what the
   pinned 0.1.60 cannot parse.
2. **Compose imports** (`parseComposeImports`, `imports.ts`): named imports of
   sibling `.tsrx` modules → local name → repo-relative path map.
3. **Plain imports** (`parsePlainImports`, `imports.ts`): every other top-level
   import, with relative specifiers rewritten for the flat generated directory.
4. **Locate the exported component function** whose body is an `@{ }`
   (`JSXCodeBlock`) container. Exactly one; single destructured args object;
   otherwise TSRX008.
5. **Setup loop** over the body statements, classifying each:
   - single `const` → `SetupStmt`; if the initializer calls a recognized signal
     constructor → `SignalIR` (+ `inferType`); `requestContext(...)` is
     recognized separately (§ 4.4); a ternary between two signal constructors →
     TSRX013; a plain const calling a client-only primitive (`first`/`all`/
     `watch`/`on`/`pass`/`requestContext`/`provideContexts`) → TSRX013.
   - `expose(...)` → verbatim text + span; scan its object for `.get` members
     (`exposeProps`), parser-factory calls (`parserExposeProps`, `exposeAmbients`),
     `defineMethod`; collect context refs.
   - bare expression statement whose free names are all client-known →
     `clientSetup` (LT-008; `provideContexts([...])` included).
   - anything else → TSRX005.
6. **Template lowering** (`lowerChildren` on the fragment) with `serverKnown` =
   args + signals + setup inits (see 5.2). Root element must carry a dashed tag;
   a `<style>` sibling yields the CSS artifact; missing style → TSRX008.
7. **Module-level declarations**: `readConfig` (`config.ts`, TSRX009 on invalid
   shapes), type declarations (verbatim, `<Name>Props` detected), `declare
   global`. `observedAttributes` entries must be parser-exposed (else TSRX009,
   inert).
8. **Import placement** (`placePlainImports`, `imports.ts`): classify each plain
   import by where its bindings' free-identifier usages occur — setup (both
   modules), server-evaluated template positions (via `evaluability.ts`),
   client-always positions, and server-rendered reactive thunks — into
   `imports.server` / `imports.client`; unused → TSRX014 warning.
9. **Gate**: any TSRX001 (reactive `@for` over a non-`createList`) nulls the
   component (file skipped by the build effect).

**`collectComposeElements`** walks root + all loop outputs (via `walk.ts`'s
`walkTemplate`, `{intoCompose: false, intoPending: false}`) collecting `compose`
nodes for corpus-wide validation in `index.ts`.

### 5.2 Template lowering (lower-template.ts)

Mutually recursive: `lowerChildren` (child list incl. the `&`-sigil adjacency
scan) dispatches to `lowerElement` / `lowerComposeElement` / `lowerIf` /
`lowerSwitch` / `lowerTry` / `lowerFor` / `lowerListFor`; branch bodies go through
`lowerBodyStatements` (same contract, plus `client-stmt` extraction).

- Control-flow conditions (`@if` test, `@switch` discriminant) must be
  server-known and never read a signal (TSRX005) — the DOM keeps the initially
  rendered branch.
- `@try`: `@finally` gated; with `@pending` (async boundary) each of the three
  arms must have exactly one root element; plain mode is a render-time error
  boundary. Arms are mutually exclusive except async boundaries.
- Composed elements: tag resolved against `composeImports` (TSRX011 if missing);
  attributes via `classifyComposeAttribute`; children validated to
  statics/server expressions only (the `{children}` substitution channel, LT-018).
- `@for` over server data: hoisted consts + single output element → `ForIR`
  (`listSignal: null`). Over a declared `createList`: `lowerListFor` — no index
  binding, `key k` bare-identifier key, body = statics + events + exactly one
  `&{item}` hole (`validateListBody`); reserved names checked. Other reactive
  iterables → TSRX001.

### 5.3 Client analysis — `analyzeClient` (analysis/plan.ts, orchestrating analysis/{selectors,naming,harvest,loops,effects}.ts)

Builds one `AnalysisContext` (§ 4.2) and runs the four passes over it in order:

- **Pass 1 — `@for` → `each()` plans** (`analysis/loops.ts`). Output element
  selector uniqueness (TSRX007, via `analysis/selectors.ts`); collection naming
  (iterable name if free, else role-plural, else `tag+s`); hoisted-const
  rebinding map (const → bare attribute it rendered into, TSRX003 if
  unrenderable); loop-variable-in-thunk check (TSRX002); free-name validation;
  lazy children in loop bodies gated.
- **Pass 1b — reactive-list `@for` → `reconcile()` plans** (`analysis/loops.ts`).
  One reactive list per component; container must be a non-root parent element;
  authored `<template>` collision check; hole-parent selector; bindItem-scoped
  event targets with taken-name allocation; item-handler free-name rules (item
  is a Signal inside `bindItem`).
- **Pass 2 — signal render sites** (`analysis/harvest.ts`), in document order:
  direct attr thunks (`() => sig.get()`), membership marks (`String(sig.get()
  === c)`, loop outputs only), lazy text children (identifier, exposed-prop
  string literal, or arrow returning `sig.get()`). A `requestContext` signal is
  skipped entirely (§ 4.4).
- **Pass 3 — harvest plans** (`analysis/harvest.ts`). Precedence: reconciled
  List (`list`) → direct site (first by document order; `deriveCell`/
  `deriveStore` never take this route) → arg substitution (`substituteArgExpr`:
  rewrite each param identifier with `paramDomRead` — exposed-prop Slot
  (`host.<prop>`, only for LAZY constructors whose callback first runs after
  `expose()` installs the property; a tracked source, LT-115) → host-prop
  mirror → bare non-root attribute site → root `host.getAttribute` —
  right-to-left by source range) → membership fallback. Root sites NEVER
  become queries: `first()` searches descendants only, so a query for the
  root's own tag would throw `MissingElementError` for the component's own
  root at activation — root arg sites read the ambient `host`, and a direct
  text site on the root (a signal-identifier lazy root child, LT-114/LT-115)
  harvests `host.textContent` through the literal `'host'` query name (never
  a query-table entry; `usedNames` reserves it, and `emit-client.ts`'s query
  loop skips it defensively). No route at all → TSRX004.
- **Pass 4 — top-level effects** (`analysis/effects.ts`, `emitTopEffects` walk,
  document order):
  - **The arg-and-prop coincidence** (LT-122): an expression naming BOTH
    a server arg and an `expose()`d prop of that name — a text child
    (`{label}`) or a bare-identifier attribute (`disabled={disabled}`)
    — plans the effect the `host.<name>` spelling plans, while the
    SERVER emission still splices the arg. One site, three roles: the
    server's render target, the client's harvest source (ADR 0003),
    and the client's binding target. That is what lets a component
    harvest its props from its own rendered children without
    duplicating the value onto a host attribute (TSRX-HOST-PROFILE
    § data account bullet 4; `basic-button` is the reference).
    Declared signals are excluded (they own a render site and a
    harvest plan already), and so are PARSER-exposed props: their
    seeding channel IS the host attribute, so a site rendering the
    same value is a second copy — TSRX039 warns and no binding is
    added (binding one would fight a native control's dirty-value
    flag, e.g. `<textarea …>{value}</textarea>`). **The warning is
    currently over-broad (LT-129, open):** it fires on the data
    account's sanctioned OVERRIDE too — a Parser whose FALLBACK
    expression reads the very site being rendered
    (`asNumber(asNumber(1)(input.step))`) is the contract's declared
    precedence, not a second copy. Only genuinely independent copies
    should warn.
  - Root element: `style-map`/`class-map` lower to `watch-style`/`watch-class`
    targeting the ambient `host`; any other reactive construct on the root is
    rejected.
  - Loop outputs become `each`/`reconcile` effects.
  - `@if`: with `@else` and IDENTICAL construct text on every branch root →
    union addressing (one throwing query whose selector unions both roots —
    whichever branch rendered is the element found; constructs on branch
    roots only). With `@else` and DIFFERING constructs (built under LT-118,
    whose own acceptance case turned out not to need it — see § 6) → per-branch
    addressing: each branch root is addressed independently with a
    non-throwing `first()` and a `'guarded'` effect, the plain-`@try` arms
    precedent (LT-025) — an effect planned inside a branch only activates
    when that branch rendered, so mutually-exclusive branches never
    double-bind. Sound only while each addressed root's selector cannot
    match the other branch's markup (`resolveExclusiveSelectorIn`, which
    skips candidates `countForSelector`'s exclusivity-aware counting would
    accept); indistinguishable roots stay a TSRX007 error naming the fix.
    An effect over an author-declared OPTIONAL ref gets the same
    `guarded` wrapping after the walk (`analysis/plan.ts`), whatever
    its site looks like — the query is non-throwing, so binding it
    bare would neither typecheck nor run.
    Without `@else` → `'maybe'` query + `guarded` effect wrapping the root's
    constructs and any `client-stmt` siblings.
  - `@switch` / plain `@try`: arms must be construct-free (elements are not
    guaranteed to exist).
  - Async `@try`: `handleAsyncBoundary` — the guarded `deriveCell(async …)`
    signal is discovered as the ok-root's direct lazy child; static/server-only
    arms; three `'one'` queries; catch param lazy child becomes `error` /
    `error.member` → one `async` effect.
  - `compose`: `ref` (required for addressing) + `pass`, unique by source path;
    child tag from `composeRegistry` for the query selector.
  - Plain elements with client constructs: selector resolution, ref-name or
    camelCased tag as query name, `emitConstructEffects` (reactive attr with
    custom-element gate TSRX012 / property dispatch for host-prop mirrors and
    dirty-flag control attrs (§4.2, LT-116), pass with
    registry gate TSRX012, class/style maps, events, lazy children with
    managed form prop gate TSRX010; since LT-115 a lazy text child must be
    its element's sole content — multiple lazy children and static/element
    sibling mixes are TSRX005, the LT-114 root gate mirrored onto the nested
    path instead of a silently wrong last-write-wins `bindText`).

`loops.ts` and `effects.ts` import a handful of signal-read predicates back from
`harvest.ts` (`returnsNumber`, `lazyWatchSource`) — the one intra-`analysis/`
dependency edge that isn't a plain fan-out from `plan.ts`.

### 5.4 Server emission — `emitServerModule` (emit-server.ts)

A single recursive `emit(node, scope, depth)` walker building `__html.push(...)`
lines, with:

- **Buffer discipline**: `@try` arms render into isolated `__armN` buffers
  (joined into the outer buffer on success) so a mid-arm throw cannot leak
  partial markup; composed children render into `__childrenN` buffers.
- **Template queue**: extracted reactive-list `<template>`s are queued per open
  element and flushed after its close tag (outside the reconciled container).
- **Per-kind dispatch**: `text` → literal push; `expr` → `{children}` unescaped
  (trusted, LT-018), else `esc(String(lazyValueExpression(...)))` where a signal
  identifier reads `.get()`, an exposed-prop string literal resolves through the
  prop→signal map / parser root-attribute mirror / managed-prop `''`, and a
  non-server-known dependency closure renders `''` (client corrects on connect);
  `if`/`switch` → real JS conditionals over server expressions; async `try` →
  `isPending` tri-state (`'pending' | 'ok' | 'err'`), three roots each rendered
  `hidden` unless its state won, guarded lazy expressions short-circuiting the
  unsafe arms; `compose` → `render<Name>({ args, children })` call + import;
  `client-stmt` → nothing.
- **Elements** (`emitElement`): `static` attrs escaped inline; `server` attrs via
  the runtime `attr()` helper (boolean → toggle semantics); reactive thunks
  render **only when their dependency closure ⊆ scope** (`isServerEvaluable`,
  `evaluability.ts`; else omitted — DOM-is-truth); `class-map` → `cls()`,
  `style-map` → `styleAttr()`; `html` → `sanitizeHtml()` when server-known;
  `event`/`ref` stripped. A thunk whose closure is NOT a subset of scope gets
  one second chance: the host-derived FOLD below. The **root element's** opening is assembled after
  children emission (same parts machinery) with the root-only `class-map`/
  `style-map` exemptions (LT-028/032).
- **Host-derived folds** (`hostDerivedExpr`, over `evaluability.ts`'s
  `hostDerivedFold`/`spliceHostDerivedFold`): a reactive thunk reading only
  values whose SERVER-SIDE truth the compiler knows is folded to an initial
  value instead of being omitted, by splicing each read's source range with
  that truth and evaluating the result. Three substitutable sources, each a
  different route to the same fact:
  1. **Parser-exposed prop with a server-rendered root attribute** (LT-085) —
     the host attribute is the prop's seed (ADR 0003), so the root attribute's
     `exprText` is the value. Widens the bare `() => host.<prop>` mirror
     (`hostPropOf`) to derived reads like `() => host.value <= host.min`.
  2. **Harvested prop rendered from a same-named server arg** (LT-118, the
     server half of LT-122's coincidence, `argRenderedProps`) — the arg
     renders the site, the site seeds the prop at connect, so the ARG is the
     value. Without it, following the data account (harvest rather than
     duplicate onto a host attribute) would be charged a pre-JS flash: every
     `hidden={() => …host.<harvested>…}` thunk would drop out of the HTML.
  3. **`first()`-bound ref read as a bare identifier** (LT-118,
     `refBranchGuard` in `first-refs.ts`) — the hand-written idiom for an
     optional affordance is `const zero = first('.zero'); if (zero) { … }`, a
     local ref and not a reactive prop, and a compiled component must be able
     to say it too. Server-side a ref's presence is the conjunction of the
     `@if` conditions on the path to its matched element (negated for `@else`);
     `'true'` unguarded, `'false'` when the template matches nothing.
     `refBranchGuard` returns `null` — do not fold, omit — for a ref in a
     `@switch`/`@try` arm or matched more than once. A ref read as a MEMBER
     (`zero.textContent`) disqualifies the fold: a presence guard is a boolean,
     not the element.

  All-or-nothing by design: one read that isn't substitutable disqualifies the
  whole expression. Folding some reads would bake a plausible-looking but wrong
  initial state into the HTML, which is worse than omitting the attribute and
  letting the client's first pass render it. `analysis/effects.ts` consults the
  same predicate when deciding whether TSRX034 (no server-renderable value) is
  warranted, so the fold set and the warning can never disagree.

- **Loops**: server-data `@for` → `for (const item of items(iterable))` or
  `entries(...)` when the index is used, hoisted consts re-declared; reactive
  list → `for (const [k, item] of list.entries())` with `data-key`, plus the
  extracted `<template>` whose `&{item}` hole becomes `<slot></slot>`.
- **Signals**: a `requestContext` signal emits as `createCell(${fallbackText})`
  instead of its verbatim source text (§ 4.4) — the one setup statement whose
  server text diverges from its client text.
- **Module assembly**: runtime import (sorted `used` set), composed server
  module imports, plain server imports, `typeDecls`, `render<Name>(params)`
  with the verbatim parameter slice, `any`-stubs for client-only free names
  inside `expose()` method-producer closures (LT-019, skipped when
  `serverLocalNames` already resolves the name), verbatim setup statements
  (span-recorded via `appendWithSpans`), buffer prologue, root open + children
  lines + root close, `return __html.join('')`.

### 5.5 Client emission — `emitClientModule` (emit-client.ts)

Renders the plan into the factory, mirroring hand-written component layout:

1. **Queries** (`first`/`all`/non-throwing `first`) in plan order.
2. **Signals** in declaration order: list harvests either verbatim or with the
   seed argument surgically replaced by the container-adoption read; other
   harvests via `harvestInitializer` (text/attr/membership reads, parser-wrapped);
   `requestContext` signals emitted verbatim in their own loop, destructured
   from the factory context rather than imported (§ 4.4).
3. **`expose()` verbatim** (span-recorded), then `plainSetup` and `clientSetup`
   statements (`computeClientNeededNames`, `imports.ts`, decides which
   `plainSetup` consts the client actually needs).
4. **Effects** in document order via `emitTopEffect` — each kind maps to one
   idiomatic call (`watch(thunk, bindAttribute(el, attr))`, map-form
   `bindStyle(el, [keys])`, `pass(target, { get, set })`, `on(...)`, `each(...)`
   blocks with rebinding consts, `reconcile(...)` blocks with bindItem-scoped
   `first` queries, `async` `watch(signal, { ok, err, nil })`, `guarded`
   `if (query) { ... }`).
5. **Module assembly**: `@zeix/le-truc` imports (module-level only — factory
   context helpers are excluded and destructured instead), child-module
   side-effect imports (type flow by projection), plain client imports,
   `typeDecls`, `globalDecl`, the authored component JSDoc (LT-006), and
   `export default defineComponent<Props>('tag', ({ ...context }) => { ... }, [extensions])`
   with config-lowered extensions (form variant leading). Spans offset by the
   header length at the end.

### 5.6 Corpus orchestration (server/effects/tsrx.ts)

Two passes: **pass 1** compiles every `.tsrx` against a registry seeded with the
hand-written example tags — collecting compilable tags and building the
corpus-wide `composeRegistry` (keyed by repo-relative source path); **pass 2**
re-compiles with the full registry, `childImports` (migrated tags → generated
clients) and `composeRegistry`. Artifacts land in `server/generated/tsrx/`
(gitignored) plus `registry.json`. Diagnostics: `❌` errors fail the run, `⚠️`
warnings skip the file with a notice.

### 5.7 Type checking loop (`check:tsrx`)

Generated client modules (and, since LT-019, server modules) are type-checked by
`tsc` emit-then-check; diagnostics at generated positions are remapped onto the
`.tsrx` source through the span tables (`findSpanForGeneratedOffset`). This is
why every verbatim slice is span-recorded rather than rewritten.

## 6. Cross-cutting invariants

- **DOM-is-truth** (ADR 0003/0024 s3): the server renders each reactive
  expression's initial value when its dependency closure is server-known;
  otherwise it is omitted and the client's first binding pass corrects it. No
  serialized state payload ever ships.
- **Dependency-provable evaluation**: one `isServerEvaluable(node, scope)`
  predicate (`evaluability.ts`) gates server rendering of reactive thunks,
  style/class maps, `html`, and lazy children — consumed identically by
  `imports.ts`, `emit-server.ts`, and `analysis/harvest.ts`.
- **Verbatim slices**: setup statements, thunks, handlers, and `expose()` are
  copied byte-identically (only reindented, LT-010 template-literal-safe via
  `lineStartsInTemplate`), never rewritten — which is what makes the sparse
  span table sound (LT-011). `requestContext` is the one deliberate exception
  on the server side (§ 4.4).
- **Vocabulary parity**: `ast-utils.ts`'s recognized-name sets (incl.
  `FACTORY_CONTEXT_MEMBERS`) are mirrored in `globals.d.ts`, pinned by
  `server/tests/tsrx/globals.test.ts`.
- **Selector uniqueness is proven structurally** against the template the
  compiler itself renders (role → bare tag → discriminator; exclusivity-aware
  counting for `@if`/`@switch`, coexistence-summing for async arms) —
  `analysis/selectors.ts`. Discriminators use canonical CSS spellings
  (LT-124): a `class` is a TOKEN clause (`span.label`), matching by membership
  so page-authored extra classes still address, and an `id` is the hash form
  (`input#name-input`); `type`/`data-*` stay exact `[attr="value"]`. Only the
  class change is a widening — `#name-input` and `[id="name-input"]` select
  the same element. A token or id outside the plain-identifier shape (a
  Tailwind-style `w-1/2`, a leading digit) falls back to the exact form, since
  a malformed clause is a `querySelector` THROW at activation, not a miss.
  `matchesSelector` parses
  exactly the grammar the synthesizer emits — it must be changed in the same
  commit, since an unparsed selector returns `false`, which reads as "no
  collision" and would quietly disarm per-branch addressing's soundness check.
- **Pin isolation**: `@tsrx/core` values enter through `core.ts` only;
  `core-shim.d.ts` is the type-side boundary. An upgrade touches `core.ts` and
  the shim only.
- **One reactive list per component** (extracted-template addressing limit);
  **one addressable construct root per `@if` branch** — union-addressed when
  every branch root carries the identical construct signature, per-branch
  addressed otherwise (roots must then be statically distinguishable from
  each other); **composed children are statics/server expressions only**.
  Per-branch addressing was built under LT-118 on the premise that the
  form-spinbutton zero state needed union addressing over structurally
  differing branch roots. It did not — the hand-written twin toggled `hidden`
  over always-present elements and never swapped structures — so the machinery
  stands on its own tests (`if-branches.test.ts`, `diagnostics.test.ts`), not
  on a corpus component. Do not read the corpus as its proof.
- **A control-flow arm is STATEMENT context.** `@if`/`@else` bodies parse as
  JS statements, not JSX children, so `@else { + }` is a parse error and
  `@else { <>+</> }` is not — a fragment is an expression. This is a grammar
  fact of the pinned parser, not a compiler restriction; both spellings are
  pinned in `if-branches.test.ts` so the distinction is not re-litigated.
- **Server stubs never reach the markup.** `emit-server.ts` declares `any`
  stubs for client-only free names inside `expose()` method-producer closures,
  widened (LT-118) to `host`/`internals` free in an emitted setup HELPER — a
  shared helper is dead code server-side for the reason a `defineMethod` body
  is, but its free context members must resolve for the module to type-check.
  Deliberately never REFS: a ref stub whose value reaches the markup renders an
  empty string where the author asked for a DOM read, trading a loud build
  error for a silently wrong page (LT-125, open).

## 7. Regrouping history and remaining gaps

The LT-022/LT-039–044 tasks executed the coupling-reduction plan this document
previously proposed in full (moves M1–M7): `ir.ts` (M1), `core.ts` (M2),
`walk.ts` (M3), `evaluability.ts` (M4), the `analysis/*` split (M5),
`imports.ts` (M6), and small-helper dedup (M7) all landed, behavior-preserving
throughout (goldens, diagnostics, and `check:tsrx` byte-identical). What's
still open:

- **M8 (physical folder regrouping)** was deliberately skipped — `analysis/` is
  the only subfolder; `front/` and `emit/` groupings from the original proposal
  were judged not worth the churn once the module-level decoupling (M1–M7) had
  already resolved the actual coupling. Revisit only if the flat `server/tsrx/`
  root becomes hard to navigate.
- **`walk.ts` covers less than its own stated ambition — reviewed (LT-046),
  decision: keep the split.** Its doc comment lists what it does NOT cover:
  `countForSelector`/`countComposeBySource`'s branch-exclusivity counting,
  `parentOf`, `findHoleParent`, `findMirror`/`findAttrSite`,
  `hasDeepConstruct`, `recordSites`, and the list-body/composed-children
  validators. Read fresh against `walkTemplate`'s shape, each falls into a
  category the generic pre-order visitor doesn't fit without either losing
  behavior or growing a grab-bag interface:
  - **Aggregation logic IS the recursion** — `countForSelector` returns `max`
    across `@if`/`@switch` branches (mutually exclusive) but `sum` across
    async `@try` arms (coexisting); the branch-exclusivity rule has to be
    inline in the recursive call graph, not bolted onto a visitor callback.
  - **Target/predicate search with early exit** — `parentOf`, `findHoleParent`,
    `findMirror` stop at the first match and return one node.
    `walkTemplate` always fully traverses (no short-circuit signal), so using
    it here would mean visiting the whole tree just to keep the first hit —
    both slower and further from the "find the parent of X" intent than the
    5-line bespoke walk it replaces.
  - **Depth-conditional predicate** — `hasDeepConstruct`'s depth guard changes
    what counts as a construct at `depth === 0` vs. `depth > 0`; that's a
    parameter the generic visitor has no slot for.
  - **Pass-interleaved, stateful** — `recordSites` threads a monotonic
    `documentOrder` counter and loop-output context through its own
    recursion while mutating two collections; it's less "a walk" than "one
    pass's traversal-shaped implementation."
  No new `walkTemplate`/`collectAttrs` case would remove real duplication
  here — the six holdouts solve six different problems. Closed as won't-do;
  `walk.ts`'s own doc comment remains the record of the decision, this
  paragraph is the "why" behind it.
- **`evaluability.ts`, `analysis/loops.ts` (`runLoops`), and
  `analysis/naming.ts` now have direct unit tests** (LT-047/LT-048:
  `server/tests/tsrx/evaluability.test.ts`, `loops-naming.test.ts`) at the
  same "hand-build the input, call the function" granularity
  `analysis.test.ts` already gave `runHarvest`/`runEffects`/the selector
  engine.
- **Browser purity is now CI-pinned (LT-045, ADR 0025 sub-design 6).**
  `scripts/build-tsrx-browser.ts` bundles `server/tsrx/index.ts` for
  `target: 'browser'` and asserts no `node:` import survived into the
  bundled text — Bun's bundler silently ships a JS shim for some `node:`
  built-ins (e.g. `node:path`) even under `target: 'browser'`, so a build
  *succeeding* is not proof of purity; `external: ['node:*']` disables that
  shimming so a reintroduced import shows up as a literal, unresolvable
  `from "node:…"` specifier in the output instead.
  `server/tests/tsrx/browser-bundle.test.ts` runs the bundle build and
  additionally proves artifact parity: the same fixture compiled through the
  browser bundle (dynamically imported from a temp file) and through the
  direct Node import of `server/tsrx/index.ts` produce byte-identical
  `serverCode`/`clientCode`/`css`/span tables. `bun run build:tsrx:browser`
  also writes the bundle to `server/generated/tsrx-browser/index.js`
  (gitignored) — the seed of the playground's compile worker; wiring it into
  the docs site is future playground work, not part of this gate.
- **React JSX near-misses are hard errors, not warnings (LT-054).** TSRX is
  close enough to JSX that React habits produce five idioms that *parse* as
  ordinary JS/JSX but compile silently into broken output, since @tsrx/core
  has no implicit conditional-render or loop-render rule: `{cond && <jsx/>}`
  and `{cond ? <a/> : <b/>}` (TSRX021/TSRX022, a JSX node stringified into
  the HTML), `.map()` producing JSX in child position (TSRX023, an array of
  JSX nodes stringified), `return (<>…</>)` in setup (TSRX024, replacing the
  generic TSRX005 for this specific shape with a fix-it naming the actual
  idiom), and `className`/`htmlFor` (TSRX006, real HTML attribute names
  `class`/`for` — the browser ignores the React DOM-property spelling
  entirely). Verified empirically before scoping: all five compiled with
  zero diagnostics prior to this task. The first three are caught by
  `reportReactJsxNearMisses`, a whole-module AST scan in `compiler.ts`
  (same shape as `reportLazyPatterns`/TSRX020), so they're caught wherever
  they appear, not just in direct template-child position. To keep the
  hard errors from being a migration tax, `scripts/codemod-react-jsx.ts`
  mechanically rewrites the common, unambiguous shape of each into native
  TSRX — single-pass and non-recursive into a rewritten span (a near-miss
  nested inside another is fixed one level per run; the script reports
  when it finds nothing left to rewrite).
- **`ref={}` is retired for raw elements in favor of `first(selector,
  required)` (LT-055).** `const name = first(selector, required)` in setup
  is now the sanctioned way to name an element reference — resolved
  structurally at COMPILE time (`first-refs.ts`'s `collectMatchingElements`
  matches the author's selector — bare tag, `.class`, `#id`, `[attr]`/
  `[attr="value"]`, comma-lists — against the template IR once
  `lowerChildren` has run) rather than by JSX attribute placement. On a
  unique match, the matched element gets the SAME `{kind: 'ref', name}` IR
  `ref={}` used to populate directly — every downstream consumer
  (`addQuery`'s naming in `analysis/effects.ts`/`analysis/harvest.ts`,
  `refNames` collection in `analysis/plan.ts`) is unchanged; only the
  authoring surface and how that IR gets populated moved. Two matches are
  allowed when they are direct branch roots of the SAME `@if`, one per
  branch (`shareExclusiveIf`) — the shape `first('input, textarea',
  'required')` needs when the referenced element's tag differs across
  `@if`/`@else`. The RUNTIME selector stays whatever `resolveSelectorIn`/
  `selectorFor` synthesize (exactly as for `ref={}` before it) — the
  author's selector text is compile-time-only, used to identify which
  element(s) the name refers to, never emitted verbatim; the author's
  REQUIRED-REASON text, by contrast, DOES flow into the generated
  `MissingElementError` message verbatim (`addQuery` checks
  `component.refReasons` before falling back to its usual auto-generated
  message) — the one part of the source `first()` call that isn't
  resynthesized. **Cardinality is the WEAKER of what the author
  declared and what the site proves (LT-123).** One selector literal
  (`first('span.label')`) declares the reference OPTIONAL: it yields
  `undefined` instead of throwing, the structural check is not
  enforced against it (an optional ref may address markup the PAGE
  authored, which this component's template says nothing about — an
  unmatched one is queried from the AUTHORED selector, the one place
  besides the reason string where `first()` text survives verbatim),
  and every effect over it is wrapped in the same existence guard a
  single-branch `@if` root gets. Two literals declare it REQUIRED —
  but a required ref whose only match sits inside a branch that may
  not render is optional anyway (the analysis addresses it
  non-throwing under a presence guard either way), so the reason
  string is dead and TSRX040 says so. For a template-OWNING component
  the compiler controls the markup, so a required-reason only earns
  its keep on a selector that may match markup the component did not
  itself render. `first-refs.ts` is a front-end-owned pure leaf (sibling of
  `reactivity.ts`/`evaluability.ts`, depending only on `ir.ts` types)
  rather than living in `analysis/selectors.ts` — `compiler.ts` (front end)
  needs it before the analysis stage runs, and adding it to
  `analysis/selectors.ts` would have made the front end import from the
  analysis layer, backwards from the pipeline's documented direction.
  **Scoped out, not silently dropped:** composed (PascalCase) elements keep
  the original `ref={}` JSX-attribute mechanism unchanged — a composed
  child's eventual DOM tag lives in another file's registry entry, resolved
  in a later, cross-file corpus pass (`server/effects/tsrx.ts`), not visible
  inside single-file `compileSource`; `first()`'s selector-matching only
  walks `kind: 'element'` template nodes, never `kind: 'compose'`. Retiring
  composed-element `ref={}` needs registry-aware selector resolution across
  the two-pass compile — a follow-up task, not part of LT-055. Corpus
  codemodded by hand (9 raw-element occurrences across 7 files; 4 more
  `ref={}` sites on composed elements were left alone as in-scope survivors).
- **Two form-associated compile-time guards, both preemptive of an existing
  runtime failure (LT-058, LT-059, CHECKLIST §7).** `formAssociated()`/
  `formAssociatedCheckbox()` (`src/extensions/form.ts`) install a fixed set
  of members on the prototype — `form`, `name`, `labels`, `validity`,
  `validationMessage`, `willValidate`, `checkValidity`, `reportValidity`,
  `setCustomValidity`, `disabled`, plus the variant's own reset-baseline
  prop (`defaultValue`/`defaultChecked`, see the next entry) — and
  `expose()` already throws `InvalidPropertyNameError` at RUNTIME for any
  of them (`component.ts`'s `reservedMembers` check predates this task).
  TSRX028 moves that failure to compile time: after `config`/`expose()` are
  both parsed, `exposeArgNode`'s own property keys are checked against a
  compiler-side duplicate of the managed-member set
  (`ast-utils.ts`'s `MANAGED_FORM_MEMBERS` — the TSRX compiler doesn't
  import the runtime library, so this list is kept in sync by hand, same
  precedent as `MANAGED_TEXT_PROPS`). TSRX029 catches a different, NOT
  already-guarded failure: a form-associated component's inner native
  `input`/`select`/`textarea`/`button` carrying a `name` submits the field
  TWICE (once via the host's `setFormValue`, once natively) — invisible in
  the browser, only visible server-side as a duplicate form field.
  `reportNamedFormControls` walks the already-lowered template IR (the same
  `kind: 'element'` traversal shape as `first-refs.ts`'s
  `collectMatchingElements`, composed children excluded as a boundary),
  checking only `static`/`server`/`reactive` attribute kinds named `name`
  (never `ref`/`event`/etc., which carry an unrelated `.name` field). Both
  checks are gated on `config?.form`, so a non-form-associated component is
  entirely unaffected.
- **`defaultValue`/`defaultChecked` as the reset-baseline's public channel
  (LT-057, CHECKLIST §7) — a `src/extensions/form.ts` change, but one
  TSRX028 (above) directly depends on.** `formResetCallback` used to
  recompute the restore value by re-running the retained Parser against
  the current attribute inline; it's now `this[prop] = this[defaultProp]`,
  mirroring `<input>.value = <input>.defaultValue` — `defaultValue`/
  `defaultChecked` are new managed properties that read the SAME retained-
  Parser computation (or the retained static initializer, unchanged, when
  not Parser-backed) and, when written, set or remove the content
  attribute. Consequently `value`/`checked` must never appear in
  `observedAttributes` on a form-associated component (dropped from
  `form-textbox.tsrx`'s `config`) — re-parsing the attribute into the LIVE
  prop on every mutation is exactly the "reflecting overwrites the reset
  baseline" bug this closes, approached from the attribute-write direction
  instead of the property-read one. `formResetCallback`'s restoring write
  is also now deferred one microtask (LT-056): form reset runs in tree
  order, so the host's `formResetCallback` fires BEFORE its own descendant
  native control resets itself, and a synchronous write there raced that
  native reset and lost. See `adr/0016-element-internals-for-form-
  association-and-states.md`, whose `formResetCallback` row and "must not
  reflect the current value back into the attribute" line predate and
  motivate both fixes — worth an ADR amendment on the next architecture
  pass, not made here.

---

*Companion documents: `server/SERVER.md` (build-pipeline integration),
`adr/0024-adopt-tsrx-as-isomorphic-component-format.md` (decisions),
`server/TESTS.md` (test strategy).*
