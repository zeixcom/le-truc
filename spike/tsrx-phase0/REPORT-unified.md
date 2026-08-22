# Phase 0 Spike Report — Branch B: Unified Client+Server Components

**Date:** 2026-08-22 (refined same-day: `live()` dropped in favor of
grammar-native thunk attributes; zero-import sources with CE v2 names
auto-imported from `@zeix/le-truc`; hoisted-const rebinding replaces
loop-variable rewriting; owner decisions recorded — unified is the only
target format)
**Status:** complete — every position in the final convention is
grammar-native `@tsrx/core` 0.1.60 (no marker identifiers, no upstream
changes required); lowering semantics specified by hand-compilation; the
compiler's rewrite obligations are identified and ranked; the type-flow risk
is explored (mechanism exists, wiring remains); all pre-ADR open questions
are decided. Together with `REPORT.md` (the Option C feasibility proof),
this is the complete ADR 0023 input.
**Sketch explored (user, 2026-08-22):** function inputs are server args;
`expose()` declares the client interface in the server function; signals are
declared in the server function; event handlers attach to JSX elements;
`&{expr}` children lower to `watch()` bindings; `class=&{…}` to `bindClass()`;
reactive attributes on custom elements to `pass()`; `@for` over reactive data
to `reconcile()` with template + slot holes. The client component is
**generated**, not authored.

## The mental model: one function, two evaluations

A unified component is a single `@{ }` container that compiles to two programs:

- **Server evaluation** — the setup statements run once with server args;
  signals are plain values (read once, never reactive); the template renders
  to an HTML string; event attributes are stripped; `<style>` is extracted.
- **Client generation** — the setup statements become the body of a generated
  `defineComponent()` factory; signals are re-declared and **seeded from the
  DOM the server rendered** (not from server args, which the client never
  sees); template markers (`&{ }`, thunk attributes, event attributes, refs) lower to
  factory-context effects targeting generated element queries.

The bridge between the two evaluations is the invariant that makes this Le
Truc rather than Yet Another Hydration Framework: **the server renders each
reactive expression's initial value into the DOM, and the client harvests its
initial state back out of it.** ADR 0003's "HTML is the truth at load time"
holds end to end — there is no serialized state payload, no reconciliation of
server state with client state, and the page is correct before any JS loads.

The resulting classification is **author-declared, not compiler-inferred**:
`&{ }` (children) and thunk values (attributes) mark reactive positions; everything else is
server-definitive. This is the decisive simplification versus the deferred
plan's original "taint walk from declared roots" — and it aligns with TSRX's
own semantics, where `&` marks lazy/reactive access for Ripple/Solid targets.

## Syntax feasibility (probed against `@tsrx/core` 0.1.60)

Refined 2026-08-22 after the marker redesign (below): **every position in the
final convention is grammar-native — no marker identifiers, no upstream
changes required.**

| Position | Form | Parses? |
|---|---|---|
| Reactive text child | `<span>&{count}</span>` | ✅ |
| Reactive child thunk | `<span>&{() => n * 2}</span>` | ✅ |
| Reactive child, exposed-prop key | `<span>&{'count'}</span>` | ✅ |
| Reactive attribute (thunk) | `aria-selected={() => String(sel === pid)}` | ✅ |
| Reactive boolean attribute | `hidden={() => selected.get() !== pid}` | ✅ |
| Reactive class map | `class={() => ({ selected: expr })}` | ✅ |
| Reactive attribute on custom element | `disabled={() => !textbox.length}` | ✅ |
| Mediated two-way attribute | `value={{ get: () => …, set: v => … }}` | ✅ |
| Event attribute | `onClick={…}` / `on:click` / `onclick` | ✅ |
| Element ref | `ref={textbox}` | ✅ (`#name` does not parse) |
| Statements in `@for` body (hoisted per-item consts) | `const pid = panelId(tab.id);` | ✅ |
| Statements in `@if` body | `const v = calc(); <p>{v}</p>` | ✅ |
| Shorthand attribute | `<p {hidden}>` | ✅ |
| `@for` clauses | `; index i` / `; key x.id` / `; key k` | ✅ |
| Void elements | `<input … />` (must self-close) | ✅ |
| Output shape | element + `<style>` wrapped in `<>…</>` | ✅ |
| Setup statements + `expose()` / signal declarations | `createCell(…)`, no imports | ✅ |

All three unified spike sources parse cleanly:
`unified/basic-counter.tsrx`, `unified/module-tabgroup.tsrx`,
`unified/module-list.tsrx` (probe: `probe3.ts`).

### The marker system: function-valued positions are reactive

`live()` was considered and dropped — it is unnecessary. The convention:

- **Attributes**: a function-valued attribute is a reactive binding; a plain
  value is a server-definitive interpolation. `on*`-prefixed function
  attributes are events (stripped server-side). An object literal
  `{ get, set }` is a mediated two-way binding (`pass()` write-back, ADR 0012).
- **Children**: `&{ expr }` is the grammar-native lazy read — reactive sugar
  where a thunk child would read heavier.

The function *is* the marker: reactivity is author-declared by writing a
thunk, the same way it is in Le Truc's own `watch()` API (which accepts
signals, thunks, and prop keys — exactly the three child forms above). No
reserved identifier, no grammar extension, host-agnostic. An upstream
proposal for `attr=&{…}` remains a nice-to-have for uniformity with `&{}`
children, but nothing in the target depends on it.

### Zero-import sources

The unified source imports **nothing**. Verified: Le Truc 2.5.1's entry
re-exports the full Cause & Effect v2 bridge from `@zeix/cause-effect` 1.5.2
(`createCell`/`deriveCell`, `createList`/`deriveList`,
`createStore`/`deriveStore`, plus the deprecated v1 names). The compiler
auto-imports into the generated client module from `@zeix/le-truc` — one
consumer dependency, CE never imported directly:

- signal constructors used in the setup (`createCell`, `createList`, …)
- everything the generated factory needs (`defineComponent`, `watch`, `on`,
  `pass`, `each`, `reconcile`, `bind*`, parsers)
- `expose`/`host` are compiler-recognized ambient identifiers in `@{ }`
  containers; the target ships a `globals.d.ts` declaring them (plus the
  ambient signal constructors) so editors type-check the source without
  imports — this declaration file is part of the target package, not user
  configuration.

## The lowering table

| Source construct | Server output | Generated client output |
|---|---|---|
| `{expr}` over server args | escaped interpolation | — |
| `&{signal}` child | renders initial value | `watch(signal, bindText(el))`; signal seeded from that element's text |
| `&{() => thunk}` child | renders thunk with initial values | `watch(thunk, bindText(el))` |
| `&{'prop'}` child | renders exposed prop's initial value | `watch('prop', bindText(el))` |
| `{() => expr}` attribute (plain element) | evaluates once, renders computed attribute | `watch(expr, bindAttribute(el, name))` — string/boolean/number dispatch per `bindAttribute` |
| `{() => ({ cls: expr })}` class map | renders initial classes | `watch(expr, bindClass(el, 'cls'))` per key |
| `{{ get, set }}` attribute (custom element) | — | `pass(el, { prop: { get, set } })` mediated two-way |
| `{() => expr}` attribute (custom element in compile registry) | see open question 4 | `pass(el, { prop: { get: expr } })` |
| `{() => expr}` attribute (foreign element) | as above | `watch(expr, bindProperty(el, prop))` |
| `onEvent={fn}` | stripped (never rendered; also blocked by M16 if it were) | `on(el, 'event', fn)` |
| `ref={name}` | — (identity only) | generated `first(<derived selector>)` bound to `name` |
| `@for` over server data | renders items once | items enhanced via `each(all(selector), el => …)` per-element scopes |
| `@for` over a reactive `List` | renders initial items in place (values, `data-key`, no slot markers) + extracts `<template>` with `&{ }` holes as `<slot></slot>` | `reconcile(container, template, list, bindItem)` — generated `bindItem` fills slots and mounts per-item handlers |
| hoisted const in `@for` body (`const pid = f(tab.id)`) | computed per item at render time | rebinds to an element-derived value (e.g. `el.getAttribute('aria-controls')`) — the attribute the server rendered for that const |
| `expose({ prop: sig.get })` | — (interface metadata) | `expose({ prop: sig.get })` in the factory |
| signal declaration `createCell(…)` / `createList(…)` | plain value for render | re-declared, seeded by DOM harvest; parser inferred from TS type |
| `<style>` block | extracted verbatim, tag-scoped | — |

Full worked lowerings for all three components: `expected/unified-lowerings.md`.

## The compiler's rewrite obligations, ranked

The unified format's cost is a set of source-to-source rewrites between what
the author writes (template-relative, loop-variable-scoped) and what the
generated client needs (element-relative, DOM-derived). Ranked by difficulty:

1. **Hoisted-const rebinding inside `@for`** (was: loop-variable
   re-derivation — substantially simplified by the `@for`-body statements
   feature). The author hoists server-data consts per item (`const pid =
   panelId(tab.id)`), and reactive thunks reference the *name*, never the
   loop variable. Client rule: each hoisted const referenced by a reactive
   thunk rebinds to an element-derived value — the attribute the server
   rendered for that const (`pid` → `el.getAttribute('aria-controls')`).
   The compiler controls both sides of that mapping. Not re-derivable →
   compile error with a suggested `data-` render. Direct loop-variable
   references *inside* reactive thunks are a compile error with a
   "hoist it first" diagnostic — the rule is enforced, not inferred.
2. **Harvest rules (signal → initial DOM site).** Each signal needs a
   deterministic client seed: text-rendered signals harvest their element's
   text (parser from TS type); attribute-rendered signals harvest their
   attribute; `module-tabgroup`'s `selected` harvests "the tab marked
   `aria-selected="true"`". Canonical-site selection when a signal renders in
   several places needs a specified rule (all sites must agree at render
   time; pick the first by document order; DEV_MODE warns on disagreement).
   A signal rendered nowhere is a compile error unless explicitly serialized.
3. **Dual `@for` lowering and template extraction.** Deciding static vs
   reactive is trivial (is the iterable a declared signal?); extracting the
   item shape into a `<template>`, rewriting holes to `<slot>`s, and
   generating a `bindItem` that fills them is mechanical — ADR 0017's
   contracts (single-root template, `data-key`, idempotent `bindItem`) were
   designed for exactly this shape.
4. **Element addressing.** Generated selectors derived from template
   structure, uniqueness-provable because the compiler also renders the HTML;
   `ref={name}` for explicitly named elements; fall back to synthesized
   `data-` markers only when structure is ambiguous (e.g. inside `{html}`
   raw blocks).
5. **Registry-aware attribute dispatch.** Reactive attributes on dashed-tag
   elements lower to `pass()` when the tag is a known Le Truc component in
   the compile unit, else `bindProperty()` — encoding AGENTS.md's own rule
   into the compiler, which has registry knowledge hand-written code lacks.

## Convergence evidence (the strongest finding)

Hand-compiling the unified sources produces client code that is
**statement-for-statement today's hand-written components**:

- `basic-counter`: same seed (`asInteger()(span.textContent)`), same
  `on(button, 'click', …)`, same `watch(count, bindText(span))`.
- `module-tabgroup`: same DOM-seeded selection, same per-tab attribute
  effects (via `each()`), same keyboard handler.
- `module-list`: same `createList`, same `reconcile(container, template,
  items, …)`, same `<slot>` fill convention, same `pass(submit, { disabled })`.

The unified format does not ask the runtime for anything new — it generates
the patterns the runtime's ADRs were designed around. Conversely, the
existing examples double as a corpus of expected compiler output for golden
tests.

## Costs and risks — owner resolutions (2026-08-22)

- **The rewrite rules are the product.** Acknowledged — they get exhaustive
  specification and golden tests before trust.
- **Type flow into generated code.** The biggest unresolved risk — explored
  same-day, see §"Type flow" below. Verdict: the mechanism exists
  (`createVolarMappingsResult` projection architecture in `@tsrx/core`), and
  Le Truc's existing type machinery does the heavy lifting; the open part is
  wiring, not invention.
- **Debuggability.** Mitigated: Le Truc ships visual + console debugging in
  DEV_MODE since v2.4 (`debug()` extension, ADR 0022) — it instruments
  generated factories the same as hand-written ones.
- **Semantic expectation hazard.** Accepted: the high-level behavior of
  reactive reads matches Solid/Ripple — Solid also renders only in the first
  client pass, then applies pinpoint updates, exactly like Le Truc does from
  the start. The difference (no unmount/remount, branch state persists)
  remains a documentation duty.
- **Cross-component reactive reads have no server value.** Resolved — rule
  recorded under decisions (#4) below.

## Type flow (explored 2026-08-22)

The owner's biggest unresolved risk. Explored against `@tsrx/core` 0.1.60;
verdict up front: **the mechanism exists, and Le Truc's existing type
machinery does the heavy lifting — the remaining work is wiring, not
invention.**

### The mechanism: projection-based checking

`@tsrx/core` documents the architecture on `JsxTransformResult.map`:
*"Esrap-shaped source map over the generated TSX. Consumed by
`create_volar_mappings_result` to build Volar code mappings."* Targets lower
`.tsrx` → generated TypeScript **with a source map**, and
`createVolarMappingsResult({ ast, ast_from_source, source, generated_code,
source_map, … })` turns that into Volar code mappings. The editor therefore
**type-checks the generated projection while displaying the `.tsrx` source** —
errors, hovers, and completions map back onto the authoring format. (`tsPlugin`
in core is merely a re-export of `@sveltejs/acorn-typescript` — parser-level
TS support; the editor wiring follows the Svelte-style per-target language
tools model.)

### Why the target's type story is mostly free

The generated client module is **ordinary TypeScript with real imports** —
checking it is checking plain Le Truc code. The desired property — "the
augmented type-checker knows `<form-textbox>` is `FormAssociatedElement & {
value: string, length: readonly number, clear: () => void }`" — falls out of
machinery that already exists, chained:

1. The **child component's `.tsrx` authors its element interface inline**:
   `declare global { interface HTMLElementTagNameMap { 'form-textbox':
   FormAssociatedElement & { value: string; readonly length: number; clear:
   () => void } } }` — exactly the inline declaration requested, living in
   the single source of truth.
2. The **generated client module imports the child's module** (the compiler's
   registry knows the compile unit), bringing the `declare global`
   augmentation into scope.
3. The generated `ref={textbox}` lowers to `first('form-textbox')`, and
   **Le Truc's selector→element type inference** (requirement M4) resolves
   the tag map entry.
4. From there, `textbox.length` and `textbox.clear()` in thunks and handlers
   type-check natively — no new type system, no augmented checker of our own.

Likewise `expose({ count: count.get })` is typed by the factory context
against the `Props` type authored inline in the same file, and the ambient
`expose`/`host`/`createCell` identifiers type-check in the projection, where
the generated imports exist.

### Wiring points Phase 1 must settle (effort, not research)

- **Volar host**: reuse Ripple's language tools or ship our own on core's
  mapping API — needs a look at the Ripple monorepo when wiring.
- **Two generated programs per file** (client module + server render
  function): Volar maps one projection — proposal: the **client module is the
  primary projection** (it carries the behavior-relevant types); the server
  function is checked at build time.
- **CLI/CI type-checking**: emit-then-check — generate the TS, run `tsc`,
  map diagnostics back through the same source maps.
- **Raw-source caveat**: without the toolchain, `.tsrx` files look untyped
  (ambient identifiers unresolved) — the same trade-off Svelte files make;
  documented, not solved.

## Decisions (resolved by owner, 2026-08-22 — pre-ADR)

1. ~~Marker spelling~~ — resolved: no marker identifier. Function-valued
   binding positions are reactive; `&{ }` remains the child sugar. An
   `attr=&{…}` upstream proposal is optional polish only.
2. **Harvest canonical-site rule** — decided: **first by document order**,
   with a DEV_MODE warning when multiple render sites disagree at render time.
3. **List seeding** — decided: **the list seeds from server args on the
   server** (initial items render into HTML); **the client picks it up from
   the server-rendered HTML** (adopted `data-key` children). One seeding
   story: DOM is truth client-side, server args are truth render-time, and
   the server render makes them agree.
4. **Thunk attributes reading child-component props** — decided
   (dependency-provable evaluation): the server evaluates a thunk attribute
   **when its dependency closure is server-known** — server args and
   server-arg-seeded list state (e.g. a seeded item's `disabled`). When a
   dependency is runtime-only (a child component's live prop, e.g.
   `textbox.length`), the attribute is **omitted** from the server render —
   in extracted `<template>`s, unknown attributes are simply absent and are
   **auto-augmented when the item is inserted client-side**; on live
   elements the first client binding pass sets it. Authored static markup
   (the inner `disabled` button) still renders as-is, giving the author
   control of the no-JS initial state.
5. **Escape hatches** — decided: **none.** No Option C fallback format; event
   delegation is a **compiler optimization** applied when the event bubbles,
   not an author decision.
6. **Coexistence and migration** — decided: **no coexistence.** The unified
   format is the only supported authoring format; Option C remains a
   validated feasibility proof (`REPORT.md`), not a shipping format.
7. **`each()` vs per-item `on()`** — decided: generated as per-item listeners
   (correctness first); bubbling-based delegation is a compiler optimization.

## Recommendation

**The unified format is the only target format** (decision 6). Option C
remains what it turned out to be: the feasibility proof that a split compiler
on `@tsrx/core` works (`REPORT.md`), whose emitter infrastructure — parsing,
HTML emission, verbatim tag-scoped CSS, registry, Bun plugin — is reused
wholesale. No authored-client file format ships. Phasing becomes internal
milestones of the unified compiler, each proven by golden tests against the
existing hand-written trio (the convergence section shows the expected
outputs already exist as today's components):

1. **Emitter core** — parse + server render functions (dependency-provable
   thunk evaluation, decision 4) + verbatim tag-scoped CSS + component
   registry + Bun plugin wired into `server/build.ts`.
2. **Client codegen, sanctioned subset** — text/attribute/class bindings,
   event attributes, refs, server-data `@for` + `each()`, hoisted-const
   rebinding; harvest rules (decision 2) and list seeding (decision 3).
3. **Reactive lists** — `@for` over a `List` → template extraction + slot
   holes + `reconcile()` (the module-list lowering is the spec).
4. **Type-flow wiring** in parallel from step 2 — projection checking via
   `createVolarMappingsResult`, client module as primary projection,
   emit-then-check for CI.

The examples corpus migrates per milestone (list components move at step 3).
The preconditions from the deferred plan all hold (`reconcile()` landed;
grammar feasibility proven for every position; `@tsrx/core` pinned at 0.1.60
behind the in-repo emitter interface). This report plus `REPORT.md` are the
complete ADR 0023 input.
