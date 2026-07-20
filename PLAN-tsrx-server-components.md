# PLAN: TSRX as a Server-Side Component Format

Status: deferred — the adoption decision is postponed until (1) the keyed
reconciler primitive (**ADR 0017**, own plan) is built and (2) TSRX viability
is verified with a manual single-file convention split (Option C, Phase 0
spike). Both sharpen the picture of what is worth building.
Decision record: **ADR 0018 (or later)** once we commit to (or reject) this
direction (0016 is reserved for ElementInternals support, 0017 for the
reconciler primitive).

## Goal

Author a component once, in a single `.tsrx` file, and compile it to the three
artifacts we currently hand-write per component:

1. **Server-rendered HTML** — the light DOM with initial state baked into
   attributes, text, and slots (today: `examples/*/*/<tag>.html`, plus the
   tagged-template-literal fragments in `server/templates/`)
2. **Bundled CSS** — component styles scoped by tag name (today:
   `examples/*/*/<tag>.css`, stitched together by `examples/main.css`)
3. **A bundled Le Truc client component** — the `defineComponent()` module
   that upgrades the server HTML in place (today: `examples/*/*/<tag>.ts`,
   stitched together by `examples/main.ts`)

## What TSRX is and how it compiles per target

TSRX (https://tsrx.dev) is a TypeScript language extension (`.tsrx` files): a
JSX-shaped template language with first-class control flow (`@if`, `@for`,
`@switch`, `@try`), statement containers (`@{ ... }`), lazy destructuring
(`&{ ... }`), and scoped `<style>` blocks. It lives in the Ripple monorepo
(`github.com/Ripple-TS/ripple/packages/tsrx*`).

The architecture is a shared front-end plus per-target back-ends:

- **`@tsrx/core`** — framework-agnostic parser (`parseModule` → ESTree AST
  with TSRX node types like `JSXCodeBlock`), scope analysis, CSS support
  (`parseStyle`, `analyzeCss`, `renderStylesheets` with class hashing), HTML
  helpers (`isVoidElement`, `isBooleanAttribute`, `validateNesting`), source
  maps. It deliberately emits **no runtime code** — codegen lives in target
  packages, and multiple compile targets are an explicit design goal.
- **Target packages** walk that AST and emit framework code:
  - **React / Preact** (`@tsrx/react`, `@tsrx/preact`): near-trivial
    source-to-source lowering to TSX (~1–2 KB transforms). `@if` becomes an
    IIFE + conditional return, `@for` becomes `.map()`, hooks inside branches
    are isolated behind generated child components, and the final JSX
    transform is delegated to the existing toolchain (swc / Bun TSX).
  - **Solid** (`@tsrx/solid`): a real codegen (~66 KB transform). `@if` →
    `<Show>`, `@switch` → `<Switch>/<Match>`, `@for` → `<For>`, `@try` →
    Solid error/suspense primitives; lazy destructuring preserves per-access
    signal reads. `babel-preset-solid` then does fine-grained DOM codegen.
  - **Vue** (`@tsrx/vue`, ~33 KB transform): targets `vue-jsx-vapor` and
    `defineVaporComponent(...)`; `@try/pending` lowers to Suspense;
    component-level `await` unsupported.
  - **Ripple** (`@tsrx/ripple`, the largest codegen): TSRX is essentially
    Ripple's native language; compiles directly to Ripple runtime
    instructions.
- **Bundler plugins** per target for Vite, Rspack, Turbopack, and — relevant
  to us — **Bun** (`@tsrx/bun-plugin-*`). Each compiles `.tsrx` in the JS
  pipeline and surfaces the extracted `<style>` blocks as sibling virtual CSS
  modules (`?tsrx-css&lang.css`).

Two corrections to the initial framing:

- **There is no Svelte target.** The five targets are React, Preact, Solid,
  Vue (Vapor), and Ripple.
- **There is no server/HTML target and no SSR story.** Every existing target
  compiles to a client runtime that owns the DOM. "TSRX as a server-side
  component format" means building a **new compile target** on `@tsrx/core` —
  we would be the first server-oriented target in the ecosystem, with no
  prior art to copy.

## The semantic gap

TSRX's targets all share one assumption: the component function *renders and
owns* its DOM, and control flow re-renders reactively. Le Truc's contract is
the opposite (SERVER_STRATEGIES.md): **the server produces HTML; components
upgrade in place**, read initial state from attributes/slots/DOM at connect
time (ADR 0003), and drive updates through effects bound to *existing*
elements (`first()`/`all()` + `watch()`/`on()`). There is no client-side
templating: no VDOM, no template instantiation; even `each()` operates over
`Memo<Element[]>` collections that come from the DOM, not from data.

A Le Truc target is therefore a **split compiler**: one template must emit
two coordinated programs (a server HTML renderer and a client enhancement
module) plus extracted CSS. Every template construct needs a classification:

| TSRX construct | Server output | Client output |
|---|---|---|
| Static markup | HTML | — |
| `{expr}` over server data | interpolated (escaped) text/attribute | — |
| `{prop}` over a reactive component prop | initial value rendered | `first(selector)` + `watch(prop, bindText/bindAttribute/…)` |
| `onClick={fn}` etc. | — | `on(el, 'click', fn)` |
| `@if`/`@for`/`@switch` over server data | evaluated at render time | — |
| `@if`/`@switch` over reactive state | all branches rendered, inactive ones `hidden` | `first()` per branch root + `watch(cond, bindVisible(el))` |
| `@for` over reactive data | initial items rendered (`data-key`) + a `<template>` for the item shape | keyed template-clone reconciler (**new library primitive**, see below) |
| `<style>` block | — | extracted to CSS bundle, tag-scoped |

### Classifying server-definitive vs reactive expressions

`@if`/`@switch`/`@for` (and plain `{expr}` bindings) do **not** always
translate to client-mutable structures. The default is server-definitive —
zero client JS — and client code is emitted only on provable need.

The classification doesn't require usage inference, because Le Truc's
reactive root set is already declarative. Reactivity enters a component in
exactly three declared ways: exposed props (the `Props` type / `expose()`
set), context (`requestContext`), and internal signals (`createState`,
`createList`, …). Everything else in scope — imports, module consts, server
render arguments — is server-definitive by construction. The compiler runs a
dependency (taint) walk from those roots: an expression is reactive iff its
dependency chain reaches one. `@tsrx/core`'s scope analysis (binding kinds:
`import`, `prop`, `let`, `const`, …) is the machinery for this walk. Event
handlers are trivially client-only.

This yields three tiers per construct, not two:

| Structure | Content | Lowering |
|---|---|---|
| static | static | pure server HTML, no client code |
| static | reactive inside | server-rendered structure + per-element bindings via existing `all()`/`each()` (ADR 0014) — no reconciler |
| reactive | — | `bindVisible` branches / reconciler lists (below) |

Mixed expressions constant-fold: in `@if (serverFlag && count > 3)` the
server part folds at render time — a `false` fold drops the branch *and* its
client binding entirely; a `true` fold leaves the reactive residual
`count > 3`. Guardrails: a server render-arg name colliding with a `Props`
name is a compile error, and DEV_MODE reports each binding's classification.
Because the roots are declared, misclassification reduces to "author didn't
expose a prop" — the same failure mode Le Truc has today, not a new silent
one.

### Lowering reactive structural control flow

Reactive `@if`/`@for` is where TSRX's semantics (unrendered branches don't
exist; lists re-render from data) and Le Truc's philosophy (server renders,
client enhances) are furthest apart. Both have an HTML-first lowering — the
same pattern a developer would hand-write today — but each carries deliberate
semantic deviations from TSRX's other targets that must be documented as
*the* semantics, not accidents.

**`@if` / `@switch` → render all branches, toggle with `bindVisible`.** The
server evaluates the condition with initial data and marks inactive branches
`hidden`; the client re-evaluates reactively and toggles. Stays entirely
within the existing runtime and the ADR 0003 contract. Consequences of all
branches existing in the DOM:

- Form controls in a `hidden` subtree still participate in form submission —
  the compiler must pair `bindVisible` with disabling form controls in
  inactive branches (or the docs must warn loudly).
- Resources in hidden branches load eagerly (`<img>`, `<iframe>`, `<video>`);
  duplicate `id`s across branches are invalid HTML — compiler diagnostics.
- `hidden` is UA-stylesheet `display: none` at low specificity; the compiler
  emits a `[hidden] { display: none !important }` guard into the scoped CSS.
- Hidden branches ship in the HTML payload and are crawler-visible.
- Upside: branch state (e.g. form inputs) *persists* across toggles — a
  semantic re-rendering targets cannot offer.

**`@for` → server-rendered items + `<template>` + keyed reconciliation.**
The server renders the initial list (each item carrying a `data-key`) plus a
`<template>` holding the item shape. The client reconciles a reactive array
against the rendered children by key: clone the template for insertions,
remove leavers, mutate survivors via the same generated per-item binding
function used for server-rendered items. Requirements:

- **A new library primitive** (a keyed template-clone reconciler), not
  compiler-inlined code — testable, reusable by hand-authors, and composing
  with ADR 0014's keyed per-element scopes. This extends Le Truc from
  "enhance existing DOM" to "enhance + owned list islands" — a philosophy
  extension with its own ADR, sequenced *before* all TSRX work (see
  "Precondition" under the plan below).
- **A data serialization policy.** Mutable lists need full item data
  client-side; DOM read-back is lossy. Default: inline
  `<script type="application/json">` per SERVER_STRATEGIES.md; opt-in
  DOM-derived state for read-only lists.
- **Restricted nesting in v1.** Control flow nested inside `@for` bodies
  multiplies template extraction and reconciler complexity; start flat,
  lift restrictions with evidence.

The residual expectation hazard remains: authors coming from TSRX's other
targets will expect re-rendering semantics (branches unmounting, effects in
inactive branches not running). Diagnostics and docs mitigate; they don't
remove the difference.

One more deliberate deviation: **CSS scoping must stay tag-based, not
hash-based.** TSRX scopes styles by rewriting class names with a compile-time
hash. In Le Truc, consumers hand-author the light DOM — a hashed class can
never appear in hand-written HTML. Our target should emit the current
convention instead: wrap the `<style>` block in the component's tag-name
selector (`basic-counter { … }`), which `@tsrx/core`'s CSS parser can feed
but whose emission we control.

## Options considered

### Option A — Full custom target `@tsrx/le-truc` with binding inference

The complete vision: the compiler classifies bindings per the table above and
generates the `defineComponent()` module (parsers from typed props per
ADR 0003/0005, effect descriptors per ADR 0007, generated stable selectors
for `first()`).

- **Gain**: true single-source authoring; the server HTML and the client
  component can never drift (today `first('button', 'Add a native button…')`
  fails at runtime; here the contract is checked at compile time).
- **Cost/risk**: the hardest kind of target. Solid's single-program codegen
  is ~66 KB of dense transform; a split target is more design work than any
  existing one. Not a starting point.

### Option B — TSRX as server templating only

A thin HTML-string codegen on `@tsrx/core` (or even abusing the Preact target
plus `preact-render-to-string` at build time, shipping nothing to the
client), replacing the tagged template literals in `server/templates/`.
Le Truc components stay hand-authored.

- **Gain**: JSX ergonomics, real control flow, and type-checked templates for
  the docs pipeline; cheap.
- **Cost/risk**: doesn't deliver the goal — components still authored as
  three files. The existing `html`/`raw` tagged literals already work and are
  dependency-free; on its own this trades a solved problem for a 0.x
  dependency.

### Option C — Single-file convention split, no inference (recommended start)

A `.tsrx` file is the single source, but the split is **authored, not
inferred**:

```tsrx
// basic-counter.tsrx (sketch)
import { bindText, defineComponent } from '@zeix/le-truc'

export type BasicCounterProps = { count: number }

// Client part: plain TypeScript, passes through the compiler untouched
// (.tsrx is a TS superset)
export const component = defineComponent<BasicCounterProps>(
	'basic-counter',
	({ expose, first, host, on, watch }) => { /* as today */ },
)

// Server part: TSRX template compiled to an HTML-string render function
export default ({ count = 42 }: Partial<BasicCounterProps>) => <>
	<basic-counter>
		<button type="button">💐 <span>{count}</span></button>
	</basic-counter>
	<style>
		button { /* compiled to `basic-counter button { … }` */ }
	</style>
</>;
```

The compiler does three mechanical jobs: (1) compile the template to an
escaped HTML-string function usable at build time (SSG) or per request (SSR),
with `@if`/`@for`/`@switch` as plain server control flow; (2) extract and
tag-scope the `<style>` block into the CSS bundle; (3) split the client
export into the JS bundle. No binding classification, no generated
`defineComponent` — much less magic, and forward-compatible: Option A's
inference can later *generate* the client part for simple cases while
authored client parts remain valid.

## Recommended plan

### Precondition — the keyed reconciler primitive (ADR 0017, decided)

The reconciler is a precondition for reactive `@for`, and it is valuable to
Le Truc regardless of whether TSRX is adopted — so it comes **first**, with
its own ADR, justified on the library's merits alone.

Prior art exists in the codebase: `examples/module/list/module-list.ts:40-99`
hand-writes the exact pattern (server-rendered items + `<template>` +
`data-key` matching + `insertBefore` positioning) and demonstrates both that
it works and that it is too brittle to ask authors to write. The data half is
already solved — `createList()` from cause-effect provides keyed reactive
lists with stable keys — so the primitive is a *binding helper* over an
existing `List<T>`, not a new data structure. What `module-list.ts` fuses
into one `watch()` and the primitive must separate:

- key harvesting from existing (server-rendered) children,
- template cloning for entering keys,
- per-item binding as a callback (`bindItem(el, itemSignal)`) mounted in
  keyed per-element scopes (ADR 0014's `keyedScopes` already handles
  mount-enterers/dispose-leavers), replacing the one-off
  `querySelector('slot')?.replaceWith(…)` content fill,
- positional reconciliation (moves reuse nodes, never recreate).

Proof of the primitive: migrate `module-list` to it and delete the
hand-written reconciliation. Design settled 2026-07-13 — see
**PLAN-list-reconciler.md**: named `reconcile()`, separate top-level export
(not an `each()` overload), accepts `List<T> | Collection<T>` via their
shared `keys()`/`byKey()` interface, strictly one-way data → DOM (users may
parse the DOM to seed the initial `List` themselves), single-root template
passed in by the author, `moveBefore()` with `insertBefore` fallback for
state-preserving reorders.

### Phase 0 — Spike (no compiler code)

1. Hand-write the target design: pick `basic-counter` and `module-tabgroup`
   (simple + complex) and write the `.tsrx` source *and* the three outputs by
   hand. This validates the format against real components before any
   codegen exists.
2. Test `@tsrx/core`'s `parseModule` on those sources; confirm the AST,
   `JSXCodeBlock`, and CSS utilities (`parseStyle`/`analyzeCss`) give us what
   the emitter needs, and whether tag-scoped emission is achievable via
   `renderStylesheets` or needs our own printer.
3. Decide fragment-template fit: can `server/templates/fragments.ts` be
   expressed in the same format? (It should — that's Option B for free.)

Exit criteria: a written format spec (becomes the core of ADR 0018) and a
go/no-go on `@tsrx/core` stability.

### Phase 1 — Option C compiler + build integration

1. New in-repo package or `server/tsrx/` module: emitter on `@tsrx/core`
   producing (a) HTML render function with auto-escaping and `raw()`-style
   opt-out matching `server/templates/utils.ts` semantics, (b) tag-scoped
   CSS, (c) pass-through client module. Wrap it as a Bun plugin following the
   `@tsrx/bun-plugin-*` shape (virtual sibling CSS module).
2. Wire into the reactive build pipeline in `server/build.ts` as a new
   effect alongside `cssEffect`/`jsEffect`/`examplesEffect`, with file
   signals so watch mode rebuilds incrementally.
3. Generate the entry lists: `examples/main.ts` and `examples/main.css` are
   hand-maintained import lists today — derive them from discovered
   component sources.
4. Migrate 2–3 example components; golden-file tests assert the generated
   HTML/CSS/JS matches the previous hand-written trio; existing Playwright
   specs keep running against the generated output unchanged.
5. Update the docs fragments pipeline: the tabbed HTML/CSS/TS panels for a
   `.tsrx` component should show either the single source or the generated
   artifacts (decide in Phase 0).

### Phase 2 — Binding inference (Option A lite)

Only after Phase 1 is stable: infer the client component for the sanctioned
binding set — text/attribute/class/style/property/visibility bindings, event
handlers, and reactive `@if`/`@switch` via the `bindVisible` lowering above
(existing primitives, no new runtime). Reactive `@for` is a compile error
*at this phase* with a diagnostic pointing at Phase 3. Generated code must
satisfy the existing ADR constraints (0003, 0005, 0007) and remain analyzable
by `@zeix/cem-plugin-le-truc` (or the CEM plugin gains a TSRX mode — see
ADR 0013).

### Phase 3 — Reactive lists

With the reconciler primitive already landed (see Precondition), this phase
is compiler work only: lower reactive `@for` to the primitive per the design
above (server items + `<template>` + `data-key` matching + JSON
serialization policy). Prove it on `module-list` (already migrated to the
primitive) and `module-todo`.

### Phase 4 — Optional, ecosystem

Upstream as a proper `@tsrx/le-truc` target package, per-request SSR helper
for the Bun server (the string render functions generalize to streaming
generators — the `renderToReadableStream` analogue), dev-server HMR for
`.tsrx`, docs authoring migration, `@zeix/le-truc-server` alignment.

## Trade-offs

### What we gain

- **One source of truth per component.** Today every component is 3–4 files
  (`.ts`/`.html`/`.css`/`.md`) that drift; the runtime error messages in
  `first()` calls exist precisely because the HTML contract isn't checked.
- **Compile-time contract checking.** Typed props flow into both the server
  HTML and the client component; a missing `<span>` becomes a compile error,
  not a `MissingElementError` in the browser.
- **Scoped styles and real templating** (control flow, composition,
  auto-escaping) for the server layer, replacing string concatenation in
  tagged literals.
- **SSG and SSR from the same artifact** — the render function serves the
  docs build (build-time) and any future per-request Bun server unchanged.
- **Toolchain fit.** TSRX ships first-class Bun plugins; our entire pipeline
  (build, docs, tests) is already Bun.
- **Ecosystem positioning.** Le Truc as a TSRX target alongside React, Solid,
  Vue, and Ripple is a visibility play, and TSRX's editor/LSP/Prettier
  tooling comes along for free.

### What we risk

- **TSRX maturity.** Very new, single-maintainer core, lives inside a
  fast-moving monorepo; the `@tsrx/core` AST and API can churn under us. We
  would also be the first server-side target — no prior art, and no
  guarantee upstream design decisions won't fight us.
- **Semantic mismatch as a permanent tax.** The same syntax means "reactive
  re-render" on five targets and "server-rendered, enhance in place" on
  ours. Diagnostics and docs can mitigate; they can't remove the surprise.
- **Split-compiler complexity (Phase 2+).** Binding classification, stable
  element addressing, and serialization/parser pairing (server writes the
  attribute, generated parser reads it — ADR 0003) move a whole class of
  bugs from hand-written code into a compiler we own.
- **Runtime scope creep — addressed by sequencing.** The list reconciler is
  the first data-driven DOM creation in Le Truc, a philosophy extension.
  Decision: it is justified standalone by the brittleness of the
  hand-written pattern in `module-list.ts` and gets its own ADR *before* any
  TSRX work — so it is never compiler collateral.
- **CSS scoping deviation.** We must bypass TSRX's hashed-class model for
  tag-scoped emission; if `@tsrx/core`'s CSS utilities assume hashing, we
  maintain our own printer.
- **Debugging generated code.** Authors will step through generated
  `defineComponent` code; source maps exist in `@tsrx/core` but the
  two-program split makes mapping harder.
- **Tooling ripple effects.** CEM analysis (ADR 0013), the `cem lsp`/`cem
  mcp` flows, changelog/docs skills, and the fragments pipeline all assume
  the three-file layout; each needs a `.tsrx` story.
- **Lock-in.** The docs site and component authoring format would depend on
  a 0.x language. Mitigation: Option C keeps the client part plain
  TypeScript and the compiler output identical to today's artifacts, so
  ejecting = committing the generated files and deleting the compiler.

## Open questions (to resolve in Phase 0 / ADR 0018)

1. Can `renderStylesheets` emit tag-scoped (unhashed) CSS, or do we print
   CSS ourselves from `parseStyle`'s AST?
2. How do multi-variant example files (the current `.html` files render 4–5
   usage variants) map to the format — multiple exported template functions?
3. Do docs code panels show `.tsrx` source or generated artifacts?
4. Does the `@demo` JSDoc / CEM extraction contract stay on the client
   export unchanged?
5. Escaping semantics: exact parity with `html`/`raw` in
   `server/templates/utils.ts`, including attribute-context escaping?
6. ~~Reconciler placement and signature~~ — settled; see
   PLAN-list-reconciler.md and ADR 0017.
7. `@if` inactive-branch policy: is `hidden` + disabled form controls enough,
   or do resource-heavy branches need a `<template>`-swap variant (trading
   state persistence for lazy loading)?
