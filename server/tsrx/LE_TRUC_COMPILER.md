# The Le Truc TSRX Compiler

> High-level overview of the inlined TSRX compiler for Le Truc (`server/tsrx/`):
> how the pipeline works, how it relates to `@tsrx/core`, how the server half is
> evaluated (tiered — value harness, Server Simulation, or neither), how type
> checking and diagnostics flow back to the author, and how it is embedded in
> the server build infrastructure. Companion documents: `server/SERVER.md`
> (build-pipeline integration), ADR 0024 (format decisions), ADR 0027 (Server
> Simulation), ADR 0029 (tiered server evaluation), `server/TESTS.md` (test
> strategy). Symbol names are stable anchors; avoid citing line numbers.

## 1. What this compiler is

An **inlined split compiler** (ADR 0024) that turns one isomorphic single-file
`.tsrx` source — server args, signals, `expose()`, markup with `@if`/`@switch`/
`@try`/`@for` directives, event handlers, and scoped styles — into three
artifacts plus two diagnostic remapping tables:

| Artifact | File | Produced by |
| --- | --- | --- |
| Server render module (`render<Name>(args): string`) | `<tag>.server.ts` | `emit-server.ts` |
| Client factory module (`export default defineComponent(...)`) | `<tag>.client.ts` | `emit-client.ts` |
| Verbatim tag-scoped CSS | `<tag>.css` | `css.ts` (`dedentCss`) |
| Client + server span tables | in-memory | `spans.ts` machinery |

The server module re-declares the source's `@{ }` setup **verbatim** against
the runtime harness in `runtime.ts`, where a signal is its initial value in a
box (`.get()` reads once, `.set()` is a no-op) — "signals as plain values". The
client module is today's idiomatic hand-written Le Truc factory, importing
solely from `@zeix/le-truc`; authored sources import the real package exports
their setup uses, while the FactoryContext vocabulary stays ambient
(`globals.d.ts`, ADR 0024 sub-design 16).

Entry point: `index.ts` exports `compileComponent(source, filename, registry,
childImports?, composeRegistry?)` → `{ component: CompiledComponent | null,
diagnostics }`. Severity policy: **errors fail the file**; **warnings skip it**
(the build effect logs and moves on).

### The `@tsrx/core` boundary

The parser dependency is **pinned** (currently 0.1.63; ADR 0024 sub-design 2).
`core.ts` is the **only** module importing its *values*; siblings import only
the `TsrxNode` *type* (erased at compile time). `core-shim.d.ts` is the type
side of that boundary — a pin upgrade touches `core.ts` and the shim only.
The pin lags the upstream docs; when a construct the docs describe fails to
parse, `compiler.ts`'s `newerGrammarHint` names the gap.

### Grounding an agent

To author or migrate `.tsrx` source, point an agent at
<https://tsrx.dev/llms.txt> for the upstream grammar, not general JSX/React
training — TSRX is close enough to JSX that the React prior fires at full
strength (`{cond && <x/>}`, `return (<>…</>)`, `className`/`htmlFor` are the
observed failure modes; TSRX021–024 and the `classify-attributes.ts`
`REACT_ATTR_RENAMES` table hard-error them rather than silently emitting
broken output). One caveat is host-specific: `&{}`/`&[]` lazy destructuring,
real in core TSRX, is retired outright here (TSRX018/020) — Le Truc's server
composition needs eager snapshot evaluation.

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

`compileComponent` wires the stages in exactly this order and validates
composed elements against the corpus-wide `composeRegistry` before analysis.
The two-pass corpus orchestration (registry discovery, then real compilation)
lives in the consumer, `server/effects/tsrx.ts` (§ 6).

## 3. Module map

| Module | Role |
| --- | --- |
| `index.ts` | Public API; `compileComponent` pipeline assembly; flat re-exports |
| `compiler.ts` | Front end: `compileSource` (parsing, setup extraction, first-ref resolution); whole-module scans (lazy patterns, React JSX near-misses, malformed selectors, deferred collector calls, reserved expose keys, form-control guards) |
| `ir.ts` | Pure type leaf: the whole IR vocabulary (`ComponentIR`, `TemplateNode`, `AttributeIR`, `SignalIR`, `ForIR`, `ConfigIR`, …) |
| `core.ts` | The only `@tsrx/core` value-import leaf |
| `core-shim.d.ts` | Type shim for the pinned `@tsrx/core` |
| `globals.d.ts` | Ambient FactoryContext vocabulary for editors; parity-tested against `ast-utils` |
| `walk.ts` | Generic structural `TemplateNode` visitor (`walkTemplate`, `collectAttrs`) |
| `lower-template.ts` | JSX/`@if`/`@switch`/`@try`/`@for` → `TemplateNode` IR; list-body validation |
| `classify-attributes.ts` | `JSXAttribute` → `AttributeIR`/`ComposeAttrIR`; shared `truc:pass={{ }}` parser |
| `reactivity.ts` | `classifyChild` — the reactive-lift rule: is a template child reactive, static, or untraceable? |
| `evaluability.ts` | `dependenciesOf` + `isServerEvaluable` — the server-known dependency-closure rule; host-derived fold helpers. Under ADR 0029 this is also the first conjunct of the **tier classifier** (§ 5) |
| `infer-type.ts` | Signal value-type inference |
| `config.ts` | `export const config` extraction |
| `imports.ts` | Compose-import resolution + plain import collection and placement |
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
| `indent.ts` / `css.ts` | Template-literal-safe reindentation / `<style>` dedent |
| `diagnostics.ts` | Diagnostic codes TSRX001–043, message factories |
| `runtime.ts` | Server-evaluation harness — imported **by generated code only**, never by the compiler (also re-exports `compose-attrs.ts`, the compose-site `class`/`id` post-processing used by generated markup) |
| `smoke.ts` | Dev script: compile corpus, execute renders, print |
| `sim/` | Server Simulation driver (§ 5): `patch-table.ts`, `realm.ts`, `boundary.ts`, `report.ts` |

**Dependency shape**: every module points strictly at `ir.ts` (types),
`core.ts`, `walk.ts`, `evaluability.ts`, `reactivity.ts`, and `first-refs.ts`
as shared leaves — no runtime value cycles. Within `analysis/`, `plan.ts`
orchestrates `{selectors, naming, harvest, loops, effects}`, with `harvest.ts`
imported back by `loops.ts` and `effects.ts` for a few shared signal-read
predicates — the one edge that isn't a strict fan-out from `plan.ts`.

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
| `try` | `children, catchParam, catchChildren, pendingChildren?` | `pendingChildren ≠ null` ⇒ async boundary: all three arms render, `hidden`-toggled |
| `compose` | `component, source, attrs, children` | PascalCase tag bound to a `.tsrx` import; server splices the child's render |
| `client-stmt` | `text` | Bare client-only side effect inside a branch |

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
eligible rather than the Simulated tier (§ 5). An authored `lang` arg, or one supplied at
a compose site, overrides the record's locale; the EFFECTIVE locale renders
onto the root `lang` attribute, exempt from TSRX039 by ADR 0024 s3's
root-attribute exclusion.

**Message resolution** (ADR 0030): a component declares each message key
*with its source-locale string inline in the `.tsrx`* — there is deliberately
no per-component catalog file, which would reintroduce the sibling-file drift
ADR 0024 cures. Translations are additive per-locale override files,
component-namespaced (`i18n/de.json`, keys `<tag>.<key>`), with **no tiering
and no override stack**: a key resolves in exactly one place. The compiler
resolves `t` at render time and the catalog never reaches the client. A
missing key renders the source-locale string and is recorded in the build
report's **translation census** — not a compile warning, since it is not
author-fixable. Literal prose inside a catalog-using component IS
author-fixable and warns. The build stays read-only: it emits a gitignored
report artifact (machine-readable per locale plus a human summary), and an
explicit `i18n:sync` script — never the build — writes missing keys back into
the committed catalogs.

**Per-locale pruning of rendered alternatives** (ADR 0030 s6): with the locale
a build constant, a component rendering one alternative per plural category
prunes to the set the locale actually uses (`{one, other}` for English rather
than all six). The set comes from
`Intl.PluralRules(lang, opts).resolvedOptions().pluralCategories`, a platform
fact rather than a hand-maintained table — the same posture as the ARIA
mapping in ADR 0024 s4. Cardinal and ordinal have different sets, so pruning
uses the configured `type` and falls back to their union when the compiler
cannot prove which is in play. **The client-side toggles do NOT retire**: the
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
keeps a component Folded-tier-eligible; a locale read from the DOM (`getLocale(el)`,
`host.lang`) is a Simulated-tier routing signal, because the realm executes that read
for real; only a runtime-default locale is unresolvable under limb (b).
`basic-pluralize` is the middle case and stays Simulated-tier.

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
expressions, real JS conditionals for `@if`/`@switch`, isolated arm buffers
for `@try`, composition calls for `compose` nodes), and setup re-declared
verbatim against the `runtime.ts` harness, where a signal is its initial value
in a box (`.get()` reads once, `.set()` is a no-op) — "signals as plain
values". A thunk whose closure is not directly server-known gets the
**host-derived fold**: an expression whose every read has a compiler-known
server truth (a Parser prop's root attribute, a prop harvested from a
same-named server arg, a `first()` ref's branch presence) is spliced to an
initial value. The fold is all-or-nothing: one non-substitutable read
disqualifies the expression — and, under ADR 0029, routes the component out
of the Folded tier.

Measured against the migrated corpus, the Folded tier is the minority path:
about 6 of 22 components qualify. Fifteen use `first()`, which is irreducibly a DOM
question. **[Corrected 2026-09-04, LT-165's implementation (see ADR 0029's Context
correction): `first()` in `watch()`/`on()` positions was never a refusal site — it is a
client concern that reaches no served byte. The implemented classifier folds **19 of 22**
(Simulated: `basic-pluralize`, `form-combobox` via compose-read, `form-listbox`); the Folded
tier is the MAJORITY path.]**

### 5.4 The Simulated tier — Server Simulation (ADR 0027)

The server renders initial HTML by **executing the generated client module**
against jsdom and serializing the reactive graph's initial state. The client
stays ground truth and corrects at connect. The driver lives in `sim/`:

- **`patch-table.ts`** — declarative substrate data: real DOM constructors
  forced from the jsdom window, inert stubs for absent APIs
  (`ResizeObserver`, `matchMedia`, …), network globals replaced with
  never-settling no-ops (a build can never depend on the network; a fetching
  component stays on its `@pending` arm). `PROTOTYPE_PATCHES` is empty since
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
  against a shared registry, disposal is end-of-process.
- **`boundary.ts`** — the serialization boundary: the instantiate→serialize
  window performs no IO and advances no timers, draining microtasks to a
  bounded quiescence, so the compiler — not microtask timing — decides which
  `@try` arm ships.
- **`report.ts`** — turns realm diagnostics into the build report (contained
  throws, network attempts, console errors become build warnings attributed
  to the component), and carries the **tier census** (§ 6).

Two gates make simulation safe to ship: **connect must be a fixed point**
(the driver runs the connect pass twice and requires byte-identical
`outerHTML`), and the resolved async arm ships only when its value is
harvestable from the markup the component itself rendered — otherwise
`@pending`.

For a Simulated-tier component `emit-server.ts` emits the same skeleton it emits for
everyone, minus the verbatim `@{ }` setup re-declaration: only the Folded tier
evaluates setup in the value harness, and the setup shapes that would break
the harness are precisely the ones that routed the component here.

### 5.5 The Static tier — the static skeleton

A Static-tier component gets the phase-1 skeleton with its unresolved expressions
omitted, and the client corrects at connect. No realm is opened.

This is where the cost argument for tiering mostly pays. `module-scrollarea`
(2,091 occurrences, the corpus's largest cost driver) reads `scrollLeft`/
`scrollTop`/`scrollWidth`/`offsetWidth`/`scrollHeight`/`offsetHeight` and
emits exclusively through `bindState(internals, …)` — both unanswerable by
the realm's own stub posture. Simulating it would cost ~2.3 s of the measured
~3.9 s full-corpus figure and produce nothing. `card-mediaqueries`
(`matchMedia`), `form-colorgraph` (`getBoundingClientRect`), `form-textbox`
and `form-spinbutton` (`internals.states`) are in the same position.

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
positions are remapped onto the `.tsrx` source through
`findSpanForGeneratedOffset`. Server modules are checked because composition
makes them import each other's real types — a missing or mistyped server arg
is a real `tsc` diagnostic, remapped to the compose site.

**Diagnostic codes** (`diagnostics.ts`, TSRX001–043) fall into families:

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
  string (TSRX040).

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
| `TSRX034` **severe** (`disabled`/`checked` on a real submittable control) | **survives, scoped to the Static tier** — the only tier where nothing resolves the value, and its own copy is right that this is a correctness bug rather than a flash |
| `TSRX013` → `clientOnlySetupConst`, `clientOnlySignalCompute` | Simulated-tier routing signals |
| `TSRX013` → `conditionalSignalConstructor` | **unchanged**, and gets its own code — an ADR 0024 s12 format rule, not a server-evaluation guard |
| `TSRX013` → `deferredCollectorCall` | **unchanged**, and gets its own code — a client-side `NoActiveCollectorError` bug, tier-independent |
| `TSRX043` | Simulated-tier routing signal |
| `TSRX039` | **unchanged** — a data-ownership rule; tiering does not answer it |

`TSRX013`'s four factories must be split into distinct codes BEFORE any part
of it retires; only two of the four are server-evaluation guards.

The consequence for the regression signal: **the compile-warning baseline's
target stays zero.** Once routing signals leave the channel, the remaining
warnings are all genuinely author-fixable again. The tier census is a
separate, non-zero, expected-to-grow record with its own regression story — a
component drifting from the Folded tier to the Simulated tier is a build-cost regression worth
seeing, and it is now visible without being miscast as a warning.

Message copy is owned by the Tech Writer per ADR 0028's lifecycle; severity
follows the tiering decision recorded with each rule.

**Vocabulary parity.** `ast-utils.ts`'s recognized-name sets are mirrored in
`globals.d.ts` and pinned by `server/tests/tsrx/globals.test.ts`, so the
compiler's ambient contract and the editor surface cannot drift.

## 7. Embedding in the server infrastructure

The compiler is build-time tooling; `@zeix/le-truc` stays browser-only and
never renders (ADR 0024 sub-design 7). jsdom never ships to clients.

- **Corpus orchestration** (`server/effects/tsrx.ts`, a docs-build effect):
  pass 1 compiles every `examples/**/*.tsrx` against a registry seeded with
  hand-written example tags, collecting compilable tags and the corpus-wide
  `composeRegistry`; pass 2 re-compiles with the full registry, child imports,
  and compose registry. Artifacts land in the gitignored
  `server/generated/tsrx/` plus `registry.json`. Errors fail the run;
  warnings skip the file with a notice.
- **Consumers**: `server/build.ts` (via the `index.ts` facade plus direct
  `registry`/`spans` imports), `check:tsrx` (§ 6), and the CEM build
  (`scripts/build-tsrx.ts` feeds `cem analyze`, which reads the generated
  clients; ADR 0024 sub-design 9).
- **Browser purity gate**: `scripts/build-tsrx-browser.ts` bundles
  `server/tsrx/index.ts` for the browser target with `node:*` externals left
  unshimmed, and `server/tests/tsrx/browser-bundle.test.ts` asserts no
  `node:` import survived and that a fixture compiled through the bundle is
  byte-identical to the Node build — the seed of the in-browser playground
  compiler.
- **Golden tests** (`server/tests/tsrx/*.golden.test.ts`) pin server renders,
  CSS bytes, client snapshots, and diagnostics for the corpus; regenerate
  with `UPDATE_SNAPSHOTS=1 bun test server/tests/tsrx`. The fixture-pinned
  corpus is load-bearing for simulation: where the simulated answer can only
  approximate (layout reads return zeros, absent APIs are `undefined`), drift
  is caught by fixtures, not assumed absent.

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
- **A control-flow arm is statement context**: `@if`/`@else` bodies parse as
  JS statements, not JSX children — a grammar fact of the pinned parser.
- **Pin isolation**: `@tsrx/core` values enter through `core.ts` only (§ 1).
- **Server stubs never reach the markup**: the server module may stub
  client-only free names for type-checking, but never a `first()` ref — a ref
  stub whose value reached the markup would render an empty string where the
  author asked for a DOM read.
- **Browser purity is CI-pinned** (§ 7).

---

*Companion documents: `server/SERVER.md` (build-pipeline integration),
`adr/0024-adopt-tsrx-as-isomorphic-component-format.md` (format decisions),
`adr/0027-server-simulation.md` (Server Simulation),
`adr/0029-tiered-server-evaluation.md` (tiered server evaluation),
`server/TESTS.md` (test strategy), `TSRX-HOST-PROFILE.md` (host decisions for
authored `.tsrx` components).*
