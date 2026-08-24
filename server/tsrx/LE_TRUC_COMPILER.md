# The Le Truc TSRX Compiler — Architecture Reference

> Deep-dive companion to `server/SERVER.md` § "TSRX Compiler" and ADR 0024. SERVER.md
> describes how the compiler plugs into the docs build; this document describes the
> compiler itself: its modules, data types, control flow, cross-cutting invariants,
> and — at the end — a proposed internal regrouping to reduce module coupling.
> Symbol names are stable anchors; avoid citing line numbers from this file.

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
`@zeix/le-truc`; the `.tsrx` source itself imports nothing (ambient vocabulary).

The parser dependency `@tsrx/core` is **pinned at 0.1.60** (ADR 0024 sub-design 2).
`compiler.ts` is currently the one module importing its *values*; siblings import
only the `TsrxNode` *type* (erased at compile time). `core-shim.d.ts` is the type
side of that boundary — a pin upgrade touches `compiler.ts` and the shim only.

Entry point: `index.ts` exports `compileComponent(source, filename, registry,
childImports?, composeRegistry?)` → `{ component: CompiledComponent | null,
diagnostics }`. Severity policy: **errors fail the file**; **warnings skip it**
(the TSRX001 milestone gate nulls the component inside `compileSource`; the build
effect logs and moves on).

## 2. Pipeline at a glance

```
                .tsrx source
                     │
     ┌───────────────┴───────────────┐
     │  FRONT END  (compiler.ts)     │  compileSource
     │  parse (@tsrx/core)           │  ├─ parseComposeImports      (config.ts)
     │  setup extraction             │  ├─ parsePlainImports        (plain-imports.ts)
     │  template lowering            │  ├─ lowerChildren           (lower-template.ts)
     │  attribute classification     │  │   └─ classifyAttribute(s) (classify-attributes.ts)
     │  signal type inference        │  ├─ inferType                (infer-type.ts)
     │  config extraction            │  ├─ readConfig               (config.ts)
     │  CSS dedent                   │  ├─ dedentCss                (css.ts)
     │  import placement             │  └─ placePlainImports        (plain-imports.ts)
     └───────────────┬───────────────┘
                     │  ComponentIR  (shared vocabulary, defined in compiler.ts)
     ┌───────────────┴───────────────┐
     │  CLIENT ANALYSIS  (analyze.ts)│  analyzeClient(component, registry, diags, composeRegistry)
     │  pass 1  @for → each() plans  │  → ClientPlan
     │  pass 1b List @for → reconcile│
     │  pass 2  signal render sites  │
     │  pass 3  harvest plans        │
     │  pass 4  top-level effects    │
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
| `index.ts` | 132 | Public API; `compileComponent` pipeline assembly; flat re-exports | analyze, compiler, css, diagnostics, emit-client, emit-server, registry, spans |
| `compiler.ts` | 933 | Front end: parsing, setup extraction, IR vocabulary, `collectComposeElements` | ast-utils, config, css, diagnostics, infer-type, lower-template, plain-imports, **@tsrx/core (values)** |
| `lower-template.ts` | 991 | JSX/`@if`/`@switch`/`@try`/`@for` → `TemplateNode` IR; list-body validation | ast-utils, classify-attributes, compiler (`isForOfNode` value + types), diagnostics |
| `classify-attributes.ts` | 282 | `JSXAttribute` → `AttributeIR` / `ComposeAttrIR`; shared `pass={{ }}` parser | ast-utils, compiler (types) |
| `analyze.ts` | 2513 | Client analysis → `ClientPlan` (addressing, harvest, loops, effects) | ast-utils, compiler (types), diagnostics, registry |
| `emit-server.ts` | 827 | `ComponentIR` → server render module | ast-utils, compiler (types + `isVoidTag`), indent, registry, spans |
| `emit-client.ts` | 537 | `ComponentIR` + `ClientPlan` → client factory module | analyze (types), compiler (types), spans |
| `config.ts` | 141 | `export const config` extraction **and** compose-import resolution | ast-utils, compiler (types), diagnostics |
| `plain-imports.ts` | 277 | Plain (non-`.tsrx`) import collection + server/client placement | ast-utils, compiler (types), diagnostics |
| `infer-type.ts` | 118 | Signal value-type inference (`string|number|boolean|unknown`) | ast-utils |
| `ast-utils.ts` | 311 | AST predicates, free-identifier analysis, recognized-name vocabulary | — (leaf) |
| `diagnostics.ts` | 317 | Diagnostic codes TSRX001–014, message factories | — (leaf) |
| `spans.ts` | 201 | Generated↔source span recording + lookup (LT-011) | indent |
| `indent.ts` | 134 | Template-literal-safe line classification for reindentation (LT-010) | — (leaf) |
| `css.ts` | 38 | `<style>` dedent | — (leaf) |
| `registry.ts` | 36 | `RegistryEntry` type + `registryJson` | — (leaf) |
| `runtime.ts` | 294 | Server-evaluation harness — imported **by generated code only**, never by the compiler | — (leaf) |
| `smoke.ts` | 83 | Dev script: compile corpus, execute renders, print | analyze, compiler, emit-client, emit-server |
| `globals.d.ts` | 58 | Ambient vocabulary for editor surfaces; parity-tested against `ast-utils` | — |
| `core-shim.d.ts` | 41 | Type shim for the pinned `@tsrx/core` | — |

External consumers: `server/effects/tsrx.ts` and `server/build.ts` (via `../tsrx`,
i.e. the `index.ts` facade, plus direct `registry`/`spans` imports); tests import
overwhelmingly through the facade.

## 4. Data types

### 4.1 Front-end IR (defined in `compiler.ts`)

**`ComponentIR`** — one extracted component; the shared input of both emitters:

| Field | Type | Meaning |
| --- | --- | --- |
| `name` / `tag` / `source` | `string` | Function name, custom-element tag (root tag), original source text |
| `paramsText` / `paramNames` | `string` / `string[]` | Verbatim destructured-args parameter; bound names (server args) |
| `setup` | `SetupStmt[]` | All setup statements verbatim (`{ text, range, node }`), source order |
| `clientSetup` | `SetupStmt[]` | Connect-time side effects (LT-008); client module only |
| `signals` | `SignalIR[]` | Declared signal constructors |
| `exposeText` / `exposeRange` / `exposeArgNode` | — | Verbatim `expose({...})`, its span, its argument node |
| `exposeProps` | `Map<string,string>` | prop → signal name (`expose({ prop: sig.get })`) |
| `parserExposeProps` | `Map` | prop → `{ parser, fallbackText }` (`expose({ prop: asString('') })`) |
| `exposeAmbients` | `string[]` | Ambient names `expose()` uses (`as*` factories, `defineMethod`) |
| `contextRefs` | `string[]` | Context members referenced from setup/expose (`host`, `internals`) |
| `config` | `ConfigIR \| null` | Extension activation (`export const config`) |
| `root` | element `TemplateNode` | Template root (style block removed) |
| `fors` | `Map<TsrxNode, ForIR>` | `@for` loops keyed by their AST node |
| `css` | `string` | Dedented verbatim stylesheet |
| `typeDecls` / `globalDecl` / `propsTypeName` | — | Exported `type`/`interface`s, `declare global`, `<Name>Props` |
| `componentDoc` | `string \| null` | Leading JSDoc, carried above the generated default export (LT-006) |
| `serverKnown` | `ReadonlySet<string>` | Names server-known at template evaluation (args + setup) |
| `imports` | `{ server: string[]; client: string[] }` | Placed plain imports, ready to splice (LT-034) |

**`SignalIR`** — `{ name, text, textStart, constructor, init, inferredType }` where
`constructor ∈ {createCell, createState, createList, createStore, deriveCell,
deriveList, deriveStore}`. `textStart` supports the client's seed-substitution
surgery (replacing an arg-dependent initializer with a DOM harvest read).

**`TemplateNode`** — the template IR union:

| Kind | Payload | Notes |
| --- | --- | --- |
| `element` | `tag, attrs: AttributeIR[], children` | Lowered JSX element; `<style>` becomes a placeholder element |
| `text` | `value` | JSX text after whitespace collapse |
| `expr` | `expr, exprText, lazy` | `{expr}` (server) or `&{expr}` (lazy/reactive) child; the `&` sigil is detected as a `JSXText` ending in `&` immediately before the container |
| `if` | `test(Text), then, alternate` | Server-known condition; server renders taken branch, client union-addresses both roots |
| `switch` | `discriminant(Text), cases[]` | Mutually exclusive arms |
| `try` | `children, catchParam, catchChildren, pendingChildren?` | `pendingChildren ≠ null` ⇒ **async boundary** (sub-design 13): all three arms render, `hidden`-toggled |
| `compose` | `component, source, attrs: ComposeAttrIR[], children` | PascalCase tag bound to a `.tsrx` import; server splices `render<Name>()` |
| `client-stmt` | `text, node` | Bare client-only side effect inside a branch (`internals?.states.add(...)`) |

**`AttributeIR`** — the attribute IR union: `static` (name + literal value),
`server` (expression rendered at render time), `reactive` (thunk → `watch()`),
`pass` (entries → `pass()`), `class-map` / `style-map` (object-literal-bodied
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
from `export const config`; lowers to `defineComponent`'s third argument with the
form variant leading (ADR 0019 ordering, enforced structurally).

**`ExtractContext`** — threaded through the front end: `{ source, diagnostics,
serverKnown, composeImports, setupInits }`.

### 4.2 Analysis plan (defined in `analyze.ts`)

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

**`TopEffectPlan`** — the document-ordered effect list: `watch-text`, `watch-attr`
(with `dispatch: 'attribute' | 'property'` and `coerceToString`), `pass`,
`on`, `watch-style` / `watch-class` (map-form keys, LT-028/031), `each`, `reconcile`,
`raw` (verbatim client-stmt), `guarded` (effects under `if (query) { … }` for an
optional `@if`), `async` (`watch(signal, { ok, err, nil })` over three roots).
Loop-scoped variants: `LoopEffectPlan` (`watch-attr` / `watch-class` / `on` inside
`each()`), `ForClientPlan` (collection + itemParam + rebindings + effects),
`ReconcilePlan` (container/template/signal/itemParam/keyParam/holeSelector/
itemEvents). Every plan node carries `sourceStart`/`sourceEnd` for the span table.

### 4.3 Emission & support types

- `EmittedServerModule` = `{ code, runtimeImports: Set<string>, spans }`; same
  shape for `EmittedClientModule` (`imports` names `@zeix/le-truc` symbols).
- `SourceSpan` = `{ generatedStart, sourceStart, length }` — byte-identical in
  both files; `SourceSlice` / `SpanCursor` support recording during assembly.
- `CompileDiagnostic` = `{ code: TSRX001–014, severity, message, line? }`.
- `RegistryEntry` = `{ tag, name, source, serverModule, clientModule, css, propsType }`.
- `PlainImportIR` = `{ text, localNames, sideEffectOnly, start }`.
- Runtime types: `ServerCell<T>` (read-once box), `ServerList<T>` (iterable box
  with cause-effect-parity key generation via `entries()`).

## 5. Control flow

### 5.1 Front end — `compileSource` (compiler.ts)

1. **Parse** via `@tsrx/core`'s `parseModule`. A parse failure gets a
   newer-grammar hint (statement-form `switch`, `{html}`/`{text}`/`{ref}`
   keywords, setup `await`, `component`) naming what the pinned 0.1.60 cannot parse.
2. **Compose imports** (`parseComposeImports`): named imports of sibling `.tsrx`
   modules → local name → repo-relative path map.
3. **Plain imports** (`parsePlainImports`): every other top-level import, with
   relative specifiers rewritten for the flat generated directory.
4. **Locate the exported component function** whose body is an `@{ }`
   (`JSXCodeBlock`) container. Exactly one; single destructured args object;
   otherwise TSRX008.
5. **Setup loop** over the body statements, classifying each:
   - single `const` → `SetupStmt`; if the initializer calls a recognized signal
     constructor → `SignalIR` (+ `inferType`); a ternary between two signal
     constructors → TSRX013; a plain const calling a client-only primitive
     (`first`/`all`/`watch`/`on`/`pass`) → TSRX013.
   - `expose(...)` → verbatim text + span; scan its object for `.get` members
     (`exposeProps`), parser-factory calls (`parserExposeProps`, `exposeAmbients`),
     `defineMethod`; collect context refs.
   - bare expression statement whose free names are all client-known →
     `clientSetup` (LT-008).
   - anything else → TSRX005.
6. **Template lowering** (`lowerChildren` on the fragment) with `serverKnown` =
   args + signals + setup inits (see 5.2). Root element must carry a dashed tag;
   a `<style>` sibling yields the CSS artifact; missing style → TSRX008.
7. **Module-level declarations**: `readConfig` (TSRX009 on invalid shapes), type
   declarations (verbatim, `<Name>Props` detected), `declare global`.
   `observedAttributes` entries must be parser-exposed (else TSRX009, inert).
8. **Import placement** (`placePlainImports`): classify each plain import by
   where its bindings' free-identifier usages occur — setup (both modules),
   server-evaluated template positions, client-always positions, and
   server-rendered reactive thunks — into `imports.server` / `imports.client`;
   unused → TSRX014 warning.
9. **Gate**: any TSRX001 (reactive `@for` over a non-`createList`) nulls the
   component (file skipped by the build effect).

**`collectComposeElements`** walks root + all loop outputs collecting `compose`
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

### 5.3 Client analysis — `analyzeClient` (analyze.ts)

Runs with a closure-shared context: `queries`, `harvests`, `effects`,
`childTags`, `ambient` (context members), `usedNames` (name allocator),
`refNames` (pre-collected from the whole template), plus helpers `addQuery`
(dedup by selector+cardinality; registers registry-child tags for type-flow
imports), `collectAmbient`, `badFreeNames`, `loopFor`.

- **Pass 1 — `@for` → `each()` plans.** Output element selector uniqueness
  (TSRX007); collection naming (iterable name if free, else role-plural, else
  `tag+s`); hoisted-const rebinding map (const → bare attribute it rendered
  into, TSRX003 if unrenderable); loop-variable-in-thunk check (TSRX002);
  free-name validation; lazy children in loop bodies gated.
- **Pass 1b — reactive-list `@for` → `reconcile()` plans.** One reactive list
  per component; container must be a non-root parent element; authored
  `<template>` collision check; hole-parent selector; bindItem-scoped event
  targets with taken-name allocation; item-handler free-name rules (item is a
  Signal inside `bindItem`).
- **Pass 2 — signal render sites** in document order: direct attr thunks
  (`() => sig.get()`), membership marks (`String(sig.get() === c)`, loop
  outputs only), lazy text children (identifier, exposed-prop string literal,
  or arrow returning `sig.get()`).
- **Pass 3 — harvest plans.** Precedence: reconciled List (`list`) → direct
  site (first by document order; `deriveCell`/`deriveStore` never take this
  route) → arg substitution (`substituteArgExpr`: rewrite each param
  identifier with `paramDomRead` — host-prop mirror → bare attribute site →
  root `host.getAttribute` — right-to-left by source range) → membership
  fallback. No route at all → TSRX004.
- **Pass 4 — top-level effects** (`emitTopEffects` walk, document order):
  - Root element: `style-map`/`class-map` lower to `watch-style`/`watch-class`
    targeting the ambient `host`; any other reactive construct on the root is
    rejected.
  - Loop outputs become `each`/`reconcile` effects.
  - `@if`: with `@else` → union addressing (constructs on branch roots only,
    identical construct text across branches — TSRX005 otherwise); without
    `@else` → `'maybe'` query + `guarded` effect wrapping the root's constructs
    and any `client-stmt` siblings.
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
    custom-element gate TSRX012 / host-mirror property dispatch, pass with
    registry gate TSRX012, class/style maps, events, lazy children with managed
    form prop gate TSRX010).

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
  render **only when their dependency closure ⊆ scope** (else omitted — DOM-is-
  truth); `class-map` → `cls()`, `style-map` → `styleAttr()`; `html` →
  `sanitizeHtml()` when server-known; `event`/`ref` stripped. The **root
  element's** opening is assembled after children emission (same parts
  machinery) with the root-only `class-map`/`style-map` exemptions (LT-028/032).
- **Loops**: server-data `@for` → `for (const item of items(iterable))` or
  `entries(...)` when the index is used, hoisted consts re-declared; reactive
  list → `for (const [k, item] of list.entries())` with `data-key`, plus the
  extracted `<template>` whose `&{item}` hole becomes `<slot></slot>`.
- **Module assembly**: runtime import (sorted `used` set), composed server
  module imports, plain server imports, `typeDecls`, `render<Name>(params)`
  with the verbatim parameter slice, `any`-stubs for client-only free names
  inside `expose()` method-producer closures (LT-019), verbatim setup statements
  (span-recorded via `appendWithSpans`), buffer prologue, root open + children
  lines + root close, `return __html.join('')`.

### 5.5 Client emission — `emitClientModule` (emit-client.ts)

Renders the plan into the factory, mirroring hand-written component layout:

1. **Queries** (`first`/`all`/non-throwing `first`) in plan order.
2. **Signals** in declaration order: list harvests either verbatim or with the
   seed argument surgically replaced by the container-adoption read; other
   harvests via `harvestInitializer` (text/attr/membership reads, parser-wrapped).
3. **`expose()` verbatim** (span-recorded), then `clientSetup` statements.
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
- **Dependency-provable evaluation**: the same `freeIdentifiers(node)` −
  `JS_GLOBALS` ⊆ scope predicate gates server rendering of reactive thunks,
  style/class maps, `html`, and lazy children — currently restated in several
  modules (see § 7.1).
- **Verbatim slices**: setup statements, thunks, handlers, and `expose()` are
  copied byte-identically (only reindented, LT-010 template-literal-safe via
  `lineStartsInTemplate`), never rewritten — which is what makes the sparse
  span table sound (LT-011).
- **Vocabulary parity**: `ast-utils.ts`'s recognized-name sets are mirrored in
  `globals.d.ts`, pinned by `server/tests/tsrx/globals.test.ts`.
- **Selector uniqueness is proven structurally** against the template the
  compiler itself renders (role → bare tag → discriminator; exclusivity-aware
  counting for `@if`/`@switch`, coexistence-summing for async arms).
- **Pin isolation**: `@tsrx/core` values enter through `compiler.ts` only;
  `core-shim.d.ts` is the type-side boundary.
- **One reactive list per component** (extracted-template addressing limit);
  **one addressable construct root per `@if` branch**; **composed children are
  statics/server expressions only**.

## 7. Simplification proposal — regrouping to reduce coupling

The compiler grew feature-by-feature (LT-001…LT-035) with locality as its only
organizing principle: each new concern got a file or a block in an existing
pass. The result is functionally clean but structurally coupled in specific,
fixable ways. Everything below is **behavior-preserving** — the golden tests
(`server.golden`, `client.golden`, `cem.golden`, snapshots, diagnostics,
features) pin every artifact byte-for-byte.

### 7.1 Coupling inventory (what couples today, with evidence)

1. **`compiler.ts` is a type hub with a value cycle.** It owns the entire IR
   vocabulary, so *every* sibling imports types from the module that also does
   front-end work — type-level hub-and-spoke. Worse, `compiler.ts` →
   `lower-template.ts` (`lowerChildren`) and `lower-template.ts` →
   `compiler.ts` (`isForOfNode`) is a genuine **runtime value cycle**, created
   only so `compiler.ts` can remain the sole `@tsrx/core` value importer while
   re-exporting two predicates (`isForOfNode`, `isVoidTag`; `emit-server.ts`
   also imports `isVoidTag` from it).
2. **`analyze.ts` (2,513 lines) conflates five jobs** — selector engine, query
   table/naming, harvest planning (incl. initializer rewriting), loop planning,
   per-construct effect planning — interleaved through closures over shared
   mutable state (`queries`, `effects`, `ambient`, `usedNames`, `refNames`,
   `addQuery`, `collectAmbient`). Nothing inside it is independently testable
   or reusable; every new construct kind edits this one file in four places.
3. **The same rules live in several homes.**
   - `dependenciesOf` (free names minus globals) is defined identically in
     `analyze.ts`, `emit-server.ts`, `plain-imports.ts`.
   - The server-known evaluability gate is restated in `emit-server.ts`
     (reactive attrs, class/style maps, `html`, lazy children),
     `plain-imports.ts` (`walkServerRenderedThunks` — whose comment admits it
     "mirrors emit-server.ts's own gate exactly"), and `analyze.ts`
     (`substituteArgExpr` preconditions). If one changes, the others silently
     diverge — this is the highest-risk duplication because a divergence is a
     wrong *component*, not a wrong error message.
   - Node predicates: `isNode` (ast-utils), `isTsrxNode` (emit-server),
     `nodeType` (analyze) — three spellings of one predicate.
   - Host-prop mirror matching: `hostPropMirrorExpr` (emit-server) vs
     `hostPropMirrorOf` (analyze) — same pattern match, two homes.
   - `classMapKeys`/`styleMapKeys` (analyze) — near-duplicates.
   - `sanitizeVarName` (analyze) vs an inline identical regex (compiler).
   - Reindentation: `reindent` (emit-server) reimplements the same algorithm
     `appendWithSpans` (spans.ts) already contains (minus span recording).
   - Factory-context membership: `CONTEXT_HELPERS` (emit-client) is a third
     list of the context-vs-module-exports split, alongside `CONTEXT_NAMES` /
     `CLIENT_ONLY_PRIMITIVES` (ast-utils) and `globals.d.ts` — but it is the
     one list **not** covered by the `globals.test.ts` parity test.
4. **~12 bespoke recursive `TemplateNode` walks** (`collectComposeElements`,
   `walkAttrs`/`walkServerExprs`/`walkClientExprs`/`walkServerRenderedThunks`,
   `collectRefs`, `countForSelector`, `countComposeBySource`, `parentOf`,
   `enclosingIfOf`, `findHoleParent`, `findMirror`/`findAttrSite`,
   `recordSites`, `validateComposedChildren`'s walk, `validateListBody`'s walk,
   `collectItemEvents`, `gatedLazyChild`, `hasDeepConstruct`/`hasClientConstructs`).
   Each new `TemplateNode` variant (the next one is already queued: composed
   elements with control-flow children) must be added to all of them — the
   widest-maintenance coupling in the package.
5. **`config.ts` holds two unrelated concerns** (its own header says so):
   extension-config extraction and compose-import resolution.
6. **Layering leaks**: `plain-imports.ts` knows `emit-server.ts`'s rendering
   rule; `emit-client.ts` knows the analyzer's context split; `emit-server.ts`
   re-derives proofs `analyze.ts` already established (async arm shapes).

### 7.2 Target grouping

Group by pipeline role, with the IR and the pin boundary as shared leaves —
every arrow then points strictly downward:

```
server/tsrx/
  index.ts            public facade + compileComponent pipeline (API unchanged)
  core.ts             NEW  @tsrx/core adapter — ALL value imports in one leaf
                          (parseModule, isStyleElement, getStyleElementStylesheet,
                           isTemplateForOfNode, isVoidElement)
  ir.ts               NEW  the whole IR vocabulary: TemplateNode, AttributeIR,
                          ComposeAttrIR, PassEntryIR, ForIR, SignalIR, ConfigIR,
                          ComponentIR, ExtractContext, SetupStmt, SourceRange
  walk.ts             NEW  one structural TemplateNode visitor + derived
                          collectors (attrs, exprs, elements, parents)
  evaluability.ts     NEW  dependenciesOf + isServerEvaluable(node, scope) —
                          the single home of the server-known rule
  front/
    extract.ts        WAS compiler.ts — compileSource only (no type hub role)
    lower-template.ts      unchanged role
    classify-attributes.ts unchanged role
    infer-type.ts          unchanged role
    config.ts              readConfig only (extension activation)
    imports.ts        WAS config.ts's compose half + plain-imports.ts — all
                          source-import collection and placement
  analysis/
    plan.ts          ClientPlan/QueryPlan/... types + AnalysisContext assembly
    selectors.ts     selector engine (build/count/resolve, union, compose count)
    naming.ts        query table + name allocation (addQuery, uniqueName, …)
    harvest.ts       sites, HarvestPlan selection, paramDomRead, substitution
    loops.ts         pass 1 (each) + pass 1b (reconcile)
    effects.ts       pass 4 (per-construct effect planning)
  emit/
    emit-server.ts        unchanged role
    emit-client.ts        unchanged role
    spans.ts, indent.ts   unchanged (emit support)
  runtime.ts              unchanged — generated-code side, never compiler-side
  globals.d.ts, core-shim.d.ts, css.ts, diagnostics.ts, registry.ts  (leaves)
```

(A flat variant — same splits, no folders, e.g. `analyze-selectors.ts` — is a
fine lighter-weight alternative if the directory nesting is unwelcome; the
splits matter more than the folders.)

### 7.3 The moves, and what each one decouples

**M1 — Extract `ir.ts`.** Move all IR type definitions out of `compiler.ts`.
Siblings import from `ir.ts`; `compiler.ts` (→ `front/extract.ts`) becomes a
leaf-ish front-end module. *Decouples:* the type hub (every module no longer
depends on the front end for vocabulary); the `classify`/`config`/
`plain-imports` back-edges disappear.

**M2 — Extract `core.ts` (pin adapter).** Move the five `@tsrx/core` value
imports out of `compiler.ts`. `lower-template.ts` imports `isTemplateForOfNode`
from `core.ts` directly; `emit-server.ts` imports `isVoidElement`; the
`isForOfNode`/`isVoidTag` re-exports in `compiler.ts` are deleted.
*Decouples:* kills the only runtime value cycle in the package; the ADR's pin
goal ("an upgrade touches one file + the shim") is preserved but achieved by a
leaf adapter instead of a re-export hub.

**M3 — Extract `walk.ts`.** One `walkTemplate(node, visitor)` (with the
if/switch/try/compose/fors traversal rules encoded once) plus derived
collectors. Migrate the walks module by module — `plain-imports.ts` first
(smallest, four generators), then `collectComposeElements`, then the analyzer's
structural queries. *Decouples:* adding a `TemplateNode` variant becomes one
edit in `walk.ts` (+ the modules that care), not twelve divergent edits; makes
the walks unit-testable in isolation.

**M4 — Extract `evaluability.ts`.** One `dependenciesOf` + one
`isServerEvaluable(node, scope)`; import it in `analyze.ts`, `emit-server.ts`,
`plain-imports.ts`. `walkServerRenderedThunks`'s "mirrors emit-server exactly"
comment becomes an actual shared implementation. *Decouples:* the
highest-risk duplication — the rule that decides what the server renders.

**M5 — Split `analyze.ts` into `analysis/*`.** The four passes already have
names; give them files and make the shared closure state an explicit
`AnalysisContext` passed between them (queries/effects/ambient/usedNames/
refNames/addQuery/collectAmbient as fields). `plan.ts` assembles and returns
the `ClientPlan`. *Decouples:* selector logic, harvest rewriting, loop
planning, and effect planning become independently testable and independently
evolvable; `emit-client.ts` imports plan types from `analysis/plan.ts` rather
than the monolith.

**M6 — Merge import handling into `front/imports.ts`.** `parseComposeImports`
(from `config.ts`) + `parsePlainImports`/`placePlainImports`. One module owns
"what does this source import, and where does each import land". `config.ts`
keeps only `readConfig`. *Decouples:* two half-related files become one
coherent concern and one pure single-purpose file.

**M7 — De-duplicate the small helpers.** Node predicate → ast-utils (delete
`isTsrxNode`, `nodeType`); `hostPropOf(thunk)` shared by analyze + emit-server;
one `objectKeys(object, { allowStrings })` for class/style maps;
`sanitizeVarName` → ast-utils (replacing compiler's inline copy); `spans.ts`
gains the plain `reindent` (emit-server delegates); `CONTEXT_HELPERS` →
ast-utils as `FACTORY_CONTEXT_MEMBERS`, added to the `globals.test.ts` parity
surface. *Decouples:* cross-module "same knowledge" drift, and brings the last
uncovered vocabulary list under the parity test.

**M8 — (Optional) physical folder regrouping** per § 7.2, updating
`SERVER.md` § "TSRX Compiler" (the module map at its line ~244) and the six
direct test imports (`compiler`, `ast-utils`, `spans`, `runtime`, `registry`,
`indent` — most can route through the `index.ts` facade, which already
re-exports them or should).

### 7.4 Suggested order (each step ends green)

1. **Baseline**: confirm `bun test server/tests/tsrx` passes; snapshots
   regenerate to nothing (`UPDATE_SNAPSHOTS=1` idempotent).
2. **M1 + M2** (pure moves; no behavior): the cycle dies, imports re-point.
   Blast radius: intra-package imports + one test path.
3. **M7** (mechanical dedup): deletions backed by identical implementations.
4. **M3** (walk.ts): migrate walks one consuming module at a time; goldens
   byte-compare after each.
5. **M4** (evaluability.ts): the semantic consolidation — goldens prove the
   server render set is unchanged.
6. **M5** (analyze split): biggest diff, zero algorithm change; move code,
   introduce `AnalysisContext`, keep pass order identical.
7. **M6 + M8**: file merges and the optional folder move; update SERVER.md.

### 7.5 What deliberately stays as-is

- **The two emitters remain separate** — they are independent products with
  independent consumers; merging them would couple server and client codegen.
- **`diagnostics.ts` stays centralized** — the diagnostic catalog is product
  surface (ADR 0024: "diagnostics are the compiler's product"); per-module
  fragments would make the TSRX code table harder to keep coherent.
- **`runtime.ts` stays isolated** in the package root (imported by generated
  code under `server/generated/tsrx/` via the `'../../tsrx/runtime'`
  specifier) — moving it changes generated-module text and breaks byte-equality
  with the golden corpus for no structural gain.
- **`registry.ts`, `spans.ts`, `indent.ts`, `css.ts`** stay small leaves.
- **No behavior gates change**: milestone gates, severity policy, span tables,
  and golden bytes are invariant across every step.

---

*Companion documents: `server/SERVER.md` (build-pipeline integration),
`adr/0024-adopt-tsrx-as-isomorphic-component-format.md` (decisions),
`server/TESTS.md` (test strategy).*
