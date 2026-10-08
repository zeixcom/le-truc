# Le Truc Compiler — End-State Specification

Sep 29, 2026 · @Esther Brunner

This is the envisioned end state of `@zeix/le-truc-compiler`, a draft for the team to agree on goals before ADRs are revised and tasks are planned.

| This document is | This document is not |
| --- | --- |
| The target: what the compiler should become | A description of today's compiler — that stays `server/compiler/LE_TRUC_COMPILER.md`; Appendix B states the distance |
| The basis for the team's decision alignment | An ADR: section 13 marks each decision's status instead |

**Decision status** used throughout:

| Status | Meaning | In this round |
| --- | --- | --- |
| Ratified | An accepted ADR or owner ruling | Not up for discussion |
| Endorsed | Team endorsed (2026-10-01); not yet recorded in an ADR or authoritative document | Record, then plan |
| Proposed | Put forward for the team to endorse | Discuss and endorse or amend |
| Parked | Not adopted; needs a cost-benefit analysis before it returns | Not planned |
| Deferred | Undecided; goes to a dedicated design session | Decide there |
| Open | No answer yet (section 15) | Decide |

Sections 2–12 use MUST / SHOULD / MAY normatively.

## 1. Positioning and goals

### 1.1 What Le Truc is

Le Truc is a library for reactive web components (Custom Elements v1) with one reactive dependency, `@zeix/cause-effect`. Its runtime rests on one rule, **DOM-is-truth**: the server renders the initial HTML, and the browser library never generates initial markup.

A component **adopts** the markup it finds at connect, **harvests** its initial state from it, wires fine-grained effects, and from then on updates exactly the nodes that need it. There is no hydration, no virtual DOM, no serialized state payload, and no subtree re-rendering. Data-driven DOM creation happens only through keyed template cloning: lists (`reconcile()`, ADR 0017) and reactive-condition arms (ADR 0037).

|  | Industry default | Le Truc |
| --- | --- | --- |
| Build | Author components (TSX, SFC) | Author TSX components |
| Server | DB → a JS server renders HTML (SSR, or at build for SSG) | DB → CMS fills compiled templates, in any backend language |
| Sent to client | HTML + CSS + JS + serialized state (JSON) | HTML + CSS + JS |
| Client work | **Hydrate** (re-run components over the markup) before the page is interactive, then **re-render** on events | **Adopt** the markup and harvest state at connect, then **update** only the affected nodes |

The CMS in the Le Truc chain does not have to run JavaScript. That constraint drives everything below.

### 1.2 Where we stand, and where we want to stay

On Ryan Carniato's map of frontend architecture (navigation → client, content → server, affordances → client), Le Truc holds the **minimal-client-state, request/response** quadrant next to HTMX. It differs in one respect: affordances are first-class, typed and component-scoped rather than attribute-sprinkled behaviour over anonymous markup.

| Responsibility | Le Truc's answer |
| --- | --- |
| Navigation | Ceded to the page and the platform. Writes travel through native forms and form-associated elements. |
| Content | The compiler, evaluated at build time and emitted as HTML or as partials with holes that a CMS fills at request time, in any backend language. |
| Affordances | The library: signals driving fine-grained effects over markup the server already rendered. |

We hold this coordinate on purpose:

- **Not upward** — client-rendered content is the failure mode the runtime avoids.
- **Not rightward** — a live server connection needs a stateful JS process our CMS personas cannot run.

One admission comes with it: there is a **bounded client content-read channel**. Components fetch JSON through `Task` signals and render it through keyed cloning and named arms — never whole-page content.

### 1.3 Why TSX

TSX gives the best authoring experience because it allows local reasoning: everything about a component lives in one file.

- **One file per component.** HTML structure, server data, client state and behaviour, styles and the source-locale i18n messages sit together.
- **No drift between HTML and JS.** Reactive bindings and event listeners are attached where they act in the DOM.
- **Component-level composition.** TSX composes components; HTML only composes tags.
- **Known and mature.** Every frontend developer writes TSX, its tooling is mature, and it is built into TypeScript, which we use anyway.
- **Agent-friendly.** AI agents benefit for the same reasons as humans: locality of behaviour and styles, and a large presence in training data.

Le Truc 2.x shared the same minimal, efficient runtime, but made authors edit three separate files that could drift against each other, with tooling catching errors only at runtime.

**Alternative considered: TSRX.** It positions itself as a successor to TSX, and its statement-based control flow reads more naturally than TSX, which forces everything into expressions. We did not bet on it: its tooling gap is not closed yet, and betting fully on a pre-1.0 language seemed premature. TSRX stays supported as the reference adapter (section 4).

### 1.4 Goals

- **One authoring format, many server targets.** SSG and CMS templates (Twig first) share one IR.
- **Server-first.** HTML is the source of truth; client JS only enhances it.
- **Fine-grained client updates** through Le Truc components and Cause & Effect signals.
- **Plain TSX.** Sources are standard TSX that stock TypeScript checks without extensions, so `tsc`, LSP, highlighting and linters work unchanged.
- **Compile-time contract checking.** Every check decidable from source and template is a compiler diagnostic; the runtime is the backstop (ADR 0028).
- **One public language.** The authored dialect is also the contract third-party adapters target. Everything below it is internal.
- **Readable output.** The generated client is idiomatic Le Truc a team can eject and maintain.

### 1.5 Non-goals — and what must stay reachable

| Non-goal | Note |
| --- | --- |
| Per-request SSR as a 3.x target (ADR 0034 s7) | Not *our* primary goal, but legitimate for a third party that stacks a file-based router, a database, a bundler and a streaming server with HMR on this compiler. **No decision may close that road**; section 9.3 lists the invariants that keep it open. |
| Bundling | One ES module per component plus a manifest; chunking, inlining and critical CSS belong to the consumer's toolchain, framework or CMS. |
| Data loading and routing | Frameworks or the CMS own them; the compiler renders given server args. |
| Running React, Vue, Solid or Lit at runtime | Also no runtime framework adapters (REQUIREMENTS §7); the compiler-side exception is section 4. |
| Arbitrary server-side JS in template targets | Only the portable subset (3.8) lowers. |

### 1.6 Terms

| Term | Meaning |
| --- | --- |
| Host profile | The TSX dialect of section 3: standard TSX plus the closed `truc:` vocabulary, typed by a shipped ambient declaration |
| Component module | One `.tsx` file exporting one component function, its styles and its source-locale messages |
| Server args | The component function's first parameter: rendered on the server, never reactive |
| Setup | The statements before the single `return` |
| Template | The returned JSX, rooted at the host element |
| Lowering | The rewrite from host-profile constructs to IR nodes |
| Reactivity class | Every template expression is `static`, `server` or `reactive` (8.2) |
| Fold | Build-time evaluation of reactive initial values (section 5) |
| Target emitter | A backend of the IR walk producing one HTML artifact kind (HTML, Twig, HTL, …) |
| Adapter | A source-to-source translator from another component format into host-profile TSX |
| Census | A build-report record that reports without asserting wrongness (tier, translation) |

## 2. Pipeline architecture

One input contract (host-profile TSX), one IR, several emitters. Every output is a function of IR, the corpus registry, catalogs and config.

&#91;embedded content: compiler pipeline · 2 inputs, front end, corpus pass, 4 emitters, diagnostics\]

The corpus pass is the one stage that sees more than one component; the dashed adapter sits outside the compiler.

**Stage contracts**

| Stage | Input | Output | Must be |
| --- | --- | --- | --- |
| Adapter | Foreign source | Host-profile TSX + source map | Outside the compiler; conformance-tested (section 4) |
| Front end | `.tsx` module, `tsconfig` | IR, message table, style table, diagnostics | Deterministic; no I/O beyond reading sources; per module, cacheable by content hash |
| Corpus pass | Every module's IR | Registry, compose-checked IR, tiers | The one stage that sees more than one component |
| Emitters | IR, registry, catalogs, config | Artifacts | Independent of each other; one IR walk with many backends |
| Diagnostics | Events from all stages | Report + censuses | Stable codes, source-mapped to the pre-adapter file |

**Outputs depend on other components.** A component's artifacts are not a function of its own source alone:

- `truc:pass` legality reads the child's registry entry.
- `@scope … to (…)` needs the tags the template renders.
- Selector exclusions read each child's rendered shapes.
- Tier contamination is a fixpoint over the compose graph.

Incremental builds therefore MUST invalidate per module **and** along compose edges. A catalog change MUST NOT re-run the front end.

**Dev loop.** The compiler SHOULD expose a per-module incremental API that watch mode and HMR build on. It is not part of the 3.0 contract; it ships later as an additive minor next to the corpus entry point (D-32). Whether Bun and Vite plugins are first-party is open (O-8).

**Engine.** v1 builds on the TypeScript 6 compiler API. TypeScript 7 shipped without a stable programmatic API (expected in 7.1). Supporting it, and native parsers after that, is a stated goal. So `ts.Node` and all TypeScript types MUST stay out of every public contract. Parser access is confined to one converter leaf (ADR 0032 s4; O-2, answered).

## 3. Authoring: the TSX host profile

### 3.1 Component module

```typescript
import { createCell, type FactoryContext } from '@zeix/le-truc'

export type MyCounterProps = { count: number }

declare global {
  interface HTMLElementTagNameMap {
    'my-counter': HTMLElement & MyCounterProps
  }
}

export function MyCounter(
  { label, start = 0 }: { label: string; start?: number },
  { expose }: FactoryContext<MyCounterProps>,
) {
  const count = createCell(start)
  const step = createCell(1)
  expose({ count })

  return (
    <my-counter>
      <button type="button" onClick={() => count.set(count.get() + step.get())}>
        {label}: <span>{count}</span>
      </button>
      <style>{css`
        @scope {
          :where(:scope) { display: inline-block }
          button { font: inherit }
        }
      `}</style>
    </my-counter>
  )
}
```

**Signature**

- A module exports **one component function**. Its first parameter is the destructured **server args**; their TypeScript type is what compose sites check against.
- The optional second parameter is the **typed factory context**: `FactoryContext<Props>`, or `FormFactoryContext<Props>` for form-associated components. When it is present, every factory name used SHOULD be destructured from it; the wide ambients remain legal for the migration period, their fate deferred (owner, 2026-09-18). `Props` is the element's public reactive surface and MUST be declared explicitly; internal signals infer their type from their initializer.
- Reserved server args the compiler supplies and callers never pass: `children` (composed content) and `i18n` (the locale record).

**Template**

- **The template's root is the host element**, spelled as its custom-element tag. That element names the component: the tag MUST be unique per corpus (LTC048). The export name is what parents import and compose as PascalCase; renaming the function is not a breaking change, renaming the root tag is. **There is no fragment root.**
- **The `<style>` block nests inside the root** — directly in light DOM mode, inside the shadow template in Shadow DOM mode (3.2). Its position is where it would sit in a shadow root.

**Setup and module level**

- **Setup** runs on the server (in the fold) and is carried verbatim into the client factory. Real `@zeix/le-truc` exports MUST be imported explicitly (LTC036); factory vocabulary MUST NOT be imported (LTC037).
- The effect machinery — `watch`, `on`, `pass`, `each`, every `bind*` — is **never authored**. Template syntax lowers to it.
- `export const i18n` (section 6), `export const config`, type declarations and the `HTMLElementTagNameMap` entry are module-level declarations the compiler reads.

### 3.2 DOM mode

| Mode | How | Stylesheet |
| --- | --- | --- |
| Light DOM (default) | Children directly under the root | `<style>` is a direct child of the root, extracted at build time (section 7) |
| Shadow DOM (opt-in) | A declarative shadow template as the root's first child | Emitted verbatim inside the shadow root; `::slotted()` becomes legal; `:global` rules move to the document stylesheet |

```tsx
<my-card>
  <template shadowrootmode="open">
    <header>{title}</header>
    {children}
    <style>{css`@scope { :where(:scope) { display: block } }`}</style>
  </template>
</my-card>
```

The stylesheet is authored identically in both modes. Composed content is inserted at `{children}`, as in light DOM mode — not at `<slot>` (ADR 0024 s10); named slots would need their own ADR. In shadow mode, authors design for harvest that stops at the boundary, and ID references that do not cross it. Declarative Shadow DOM is Baseline 2024: the component either ships a connect-time fallback or documents that minimum.

### 3.3 Bindings: what runs where

Reactivity is author-declared, never marked (ADR 0024 s4). For an attribute the spelling decides: only a function-valued attribute is reactive. For a text child, what the expression reads decides:

| Spelling | Class | Meaning |
| --- | --- | --- |
| `attr="literal"`, literal text | `static` | Known at build |
| `attr={expr}` (whatever it reads), `{expr}` child over server args only | `server` | Rendered once; never updates |
| `attr={() => expr}` | `reactive` | Rendered at its initial value, then `watch()`-bound |
| `{expr}` child that reads a signal or `host.<prop>` (`{count}`, `{host.label}`), or `{() => expr}` | `reactive` | Text binding; initial value rendered |
| `on<Event>={handler}` | — | `on()` listener; never serialized to HTML |

- **Reactive attributes MUST be arrow thunks.** A bare expression is a `server` value, even if it reads a signal. The rule is a little more verbose, but it is the only spelling that expresses a derived binding (`class={() => (isPending(d) ? 'pending' : null)}`), and it keeps what is evaluated on the server versus the client readable at a glance.
- `null` / `false` removes an attribute; a boolean toggles it.
- The compiler picks the DOM channel: a `host.<prop>` mirror or a dirty-flag IDL attribute (`value`, `checked`, `selected`) binds as a property, everything else as an attribute. There is no `prop:` prefix.
- **Reactive text MUST own its element's whole text content.** The text binding writes the element's `textContent`, and a hole inside mixed content (`<span>Total: {count}</span>`) is not addressable on its own: the first write would erase the static text and any child elements. A reactive child sharing an element with other content is therefore an error (LTC005); wrap the reactive part in an element of the author's choice. The alternative — the generated binding recomputing the whole text (`span.textContent = 'Total: ' + count.get()`) — is not built.
- A per-document `id` in a template belongs to whoever instantiates it: it MUST come from a server arg (LTC042).

### 3.4 The closed `truc:` vocabulary

A compiler-consumed construct gets a `truc:` name only when its JavaScript spelling would misstate its meaning, it needs no generic type parameter, and it joins this closed list (ADR 0041). Growth goes through that gate, which under section 4 is also the adapter-facing API gate.

| Construct | Form | Semantics |
| --- | --- | --- |
| Boundary | `<truc:try pending={…} catch={e => …}>` | Error boundary with `catch` only; async boundary with `pending`. Three arms, no stale arm; the winning arm renders live, the others as inert templates (ADR 0037 s4). The in-flight state is the reactive `isPending(signal)` idiom beside it |
| Signal pass | `truc:pass={{ key: () => …, other: { get, set } }}` on a composed child | Replaces the child's Slot-backed signal (`pass()`); read-only thunk or mediated descriptor only. Legality is checked against the child's registry entry |
| Dynamic HTML | `truc:html={expr \| () => expr}` | Inner HTML through the application's sanitize policy (3.7) |
| Dynamic tag | `<truc:element tag={expr}>` | A **server-known** expression naming an **HTML** element (never a custom element — composition stays statically resolvable). Built when a migration needs it |

### 3.5 Control flow

Whatever JSX expresses stays JSX. There are no `truc:if` / `truc:for` tags.

| Authored shape | Lowers to |
| --- | --- |
| `{cond ? <a/> : <b/>}`, `{cond && <a/>}` | Conditional |
| An IIFE whose body is a `switch` returning JSX per arm | Switch |
| `{items.map(item => …)}` over server data | `each()` over the server-rendered items |
| `{list.map(item => …)}` over a declared `createList` | Keyed `reconcile()`; the key comes from the list |
| `{xs.length === 0 ? <empty/> : xs.map(…)}` | Loop with an empty arm |

- **Server-known conditions** render only the winning arm; no client construct.
- **Reactive conditions** (reading a signal) render the initial winner live beside inert arm templates keyed by compile-time names (`then`/`else`, `case:` + the literal's JSON — value-typed, so `case:1` and `case:"1"` are distinct while `1` and `1.0` share a key — plus `default`) and switch through `reconcile()` over the current arm key (ADR 0037). Arms own their effects; re-entry re-clones. A losing arm's template bakes client-written sites (lazy text, reactive attributes, class/style maps) empty — the arm's mount writes them on enter; the live winner keeps its values.
- A reactive loop MUST iterate a `createList` (LTC001). A `key` on a server-data loop is an error (LTC052).
- Every branch arm MUST return JSX. Statements live in setup.

### 3.6 Element references

- An author declares `const el = first(selector, reason?)` / `all(selector)` only when the factory reads the element. Selector literals type through `HTMLElementTagNameMap`.
- One literal is optional (guarded effects); a second literal makes it required, with the reason flowing into the runtime `MissingElementError`.
- A composed child is addressed by its tag plus the compose site's own `class` / `id` / `data-*` discriminator (`first('form-spinbutton.lightness')`). Those attributes reach the served DOM.
- There is no `ref={}`.

### 3.7 Dynamic HTML and trust

`truc:html` never assigns raw. The library ships no sanitizer; the **application provides one policy**, configured once and applied by every target:

- the server fold;
- template targets, through the backend's implementation of the same policy;
- the client (`dangerouslyBindInnerHTML`, Trusted Types-shaped, ADR 0010).

Two sanitizers with different allowlists would be a hydration diff in the one place where a diff is a security question. Without a configured policy, `truc:html` fails closed: the client's `sanitizeHtml` falls back to `escapeHTML` (ADR 0010 s6), and a template target's unregistered sanitizer hook fails at render (ADR 0043 s3).

### 3.8 The portable subset and closed fold inputs

Two independent restrictions make template emission possible:

| Restriction | Rule |
| --- | --- |
| **Closed inputs** (the partial-readiness invariant, ADR 0034 s4) | Anything the server evaluates may read only the component's own server args and the reserved `i18n` record's declared members (`lang`, `t`, `timeZone`, `currency`, `dir`). A page-context read (`document`, `window`, `navigator`, …) in a server-evaluated position is an error (LTC054). Widening the set is a reviewed act. |
| **Portable expressions** | `server`-class expressions that must survive into a template target (they read server args, so they become holes) MUST lie in the closed hole grammar every target must translate (ADR 0043 s1): static member paths over args and loop items, literals, `!`, strict equality, numeric comparison, `&&` / `\|\|` / `??`, the ternary, and message calls; a template literal lowers to a segment list. Calls to arbitrary functions are outside the subset, so emittability is target-independent. Anything else is allowed for SSG; when a template target is configured, a non-portable `server` expression is an error and a non-portable reactive initial value routes the partial Static (ADR 0043 s2). |

## 4. Input adapters

Adapters let other component formats author for Le Truc. The seam is **source-to-source**.

**Contract**

- An adapter translates its format into **host-profile TSX for a declared profile version** (`hostProfile: "1.x"`), together with a **source map** back to its input, and hands both to the one public entry point: `compileComponentTsx(source, { sourceMap })`.
- Diagnostics on the emitted TSX are remapped through the source map, so an author sees their own file. They are worded in the host dialect.
- Only components an adapter translated with **no error** may be mixed with native components in one tree.
- No plugin machinery: no registry, discovery or lifecycle hooks. An adapter is a package that emits files a human can read, diff and check in.
- The engineering risk of tracking a framework's releases transfers with ownership. Connectors for React, Vue or Solid semantics are third-party by name.

**Translate and refuse; never emulate.** A construct whose meaning cannot be stated as *server-rendered markup + connect-time effects + keyed cloning as the only data-driven creation* MUST be refused with a diagnostic that names why.

| Kind | Meaning | Permanence |
| --- | --- | --- |
| Foreign-model refusal | The meaning lives in another runtime's execution model (VDOM identity, mixin chains, compiler-coupled reactivity) | Permanent |
| Invariant-crossing refusal | It needs something ratified away (a hydration payload, client render as the primary act, reaching into another component's owned markup) | Permanent unless the owner revises the invariant |
| Machinery gap | Not yet expressible | Machinery gets built |

Refusals happen in two layers: adapter-side in the adapter's own channel, before any TSX exists; compiler-side through the closed `LTC` vocabulary. Adapters never mint compiler codes and never produce routing signals — tier routing is the compiler's, on the emitted TSX.

**Reference adapter.** *(D-04 is parked, 2026-10-01: until its cost-benefit analysis, `.tsrx` stays a first-class authored surface under ADR 0032, and which adapter becomes the reference is open.)* In the proposal, `.tsrx` is the first-party reference adapter and the conformance baseline: it translates the TSRX directive grammar into host-profile TSX. The conformance run is a toy adapter that emits TSX plus a source map, compiles through every tier, and proves that errors remap to the toy source.

**Timing.** The seam ships **experimental** at 3.0 and becomes stable once template emission has landed and one real adapter exists.

Appendix A sketches how the major component models would fare.

## 5. Composition and server evaluation

### 5.1 The data account

Binding on every component, compiled or hand-written:

1. **Compiled server components receive all data as server args.** The server composes declarations; it never inspects DOM.
2. **A client component may place server-known initial data anywhere in its owned markup** and harvest it there. It should not demand as a host attribute what its children already carry.
3. **Reaching into a child's owned markup is forbidden** — for parents on the server and the client alike. Composition goes through the child's public props, methods and declared boundary attributes. If the contract cannot express what a parent needs, fix the child.
4. **One site, three roles.** A harvested prop renders into its site from the server arg, harvests back out of that site at connect, and rebinds it afterwards. Rendering the same value through a second channel is the duplication smell (LTC039). `formAssociated()`'s attribute (reset baseline) versus the control's value (current value) is a sanctioned exception.
5. **Formatted values keep a raw source.** Text formatted for display (`1’234 articles`) does not parse back. A formatted reactive value MUST have a canonical raw value source: `value`, `valuenow` or `datetime` on an owned descendant (`<data value>`, `<time datetime>`), or a host attribute.

Pass write-ownership follows from (3): a read-only pass makes every child-side write throw, so form children prefer push-down plus commit-on-change over `truc:pass`.

### 5.2 Evaluation tiers

What a reactive expression renders before JavaScript loads is resolved by the cheapest phase that can answer it, decided statically and conservatively (ADR 0029):

| Tier | Mechanism | When |
| --- | --- | --- |
| **Folded** | DOM-less value harness: a signal is its initial value in a box | Every reactive initial value resolves from server args, initializers over them, `i18n`, or Parser-backed `host.<prop>` reads |
| **Simulated** | The generated client executes against a simulated DOM, and the resulting HTML is serialized (ADR 0027) | Folding is incomplete **and** the realm can plausibly answer. **SSG only** (ADR 0035) |
| **Static** | Skeleton only; the client corrects at connect | Nothing the realm could answer |

- **Unresolvability is per expression; tier is per component.** An expression is unresolvable when it reads a stubbed API (layout, `internals.states`, sensors) or is not a server fact at all (wall clock, RNG, runtime-default locale). It is **omitted in every tier**: a build-time timestamp is a stale value served for the life of the page, not a flash the client corrects.
- A shape the fold cannot follow is **not an author error**; it routes. The tier census records it.
- **Composition contaminates on reads, not containment.** Embedding a Simulated child keeps the parent's tier; addressing it with `first()` or `truc:pass` does not.
- In every tier the client is ground truth, and **no framework-synthesized hydration payload ever ships**. Serialized data is a matter of scope and authorship, not a ban (REQUIREMENTS M19): where serialization is genuinely unavoidable, a component-local payload on one of the component's own attributes, parsed by `asJSON`, stays legal.
- **The emitted markup is byte-identical across tiers**, and CI renders every Folded component through the realm as well and requires identical output.
- The simulation substrate (jsdom) is an **optional peer**; without it Simulated components route Static and record it in the census. The simulation seam is DOM-free and designed as a package boundary.

### 5.3 Context

`requestContext(Context, fallback)` is a signal constructor: the fallback MUST be server-known and is what the server renders; the client resolves the provider at connect. `provideContexts([...])` is client-only and renders nothing.

## 6. Internationalization

Locale is **build-time server data** (ADR 0030). It reaches a component as the reserved `i18n` server arg, which callers never pass.

### 6.1 Declaring messages

```tsx
export const i18n = {
  done: 'Well done, all done!',
  tasks: '{count, plural, one {# task} other {# tasks}} remaining',
} as const

export function MyTodo(
  { count, i18n: { t } }: { count: number; i18n: I18n<typeof i18n> },
  { expose }: FactoryContext<{ count: number }>,
) {
  const remaining = createCell(count)
  expose({ count: remaining })

  return (
    <my-todo>
      <p class="none" hidden={() => remaining.get() !== 0}>{t.done}</p>
      <p class="some">{() => t.tasks({ count: remaining.get() })}</p>
    </my-todo>
  )
}
```

- Source-locale messages live in the component module as an object literal of string literals. There is no sibling catalog file for the source locale.
- Every value MUST be an **ICU MessageFormat 1** pattern. `t.<key>` is a string for an argument-less pattern and a function of its arguments otherwise; argument types derive from the pattern (`plural` → `number`, `select` → string union, `date` → `Date`). Calls are checked against the pattern (LTC055).
- Keys are namespaced by tag at build (`my-todo.tasks`). There are no shared site-wide messages.
- Literal prose in a component that declares `i18n` warns (LTC047).

### 6.2 Catalogs

- One file per locale, component-namespaced (`i18n/de.json`); no tiering and no override stack — a key resolves in exactly one place.
- The **translation census** checks both directions (missing, orphaned), each translation's argument set, `plural` arm coverage against the locale's CLDR categories, and staleness against a committed per-key source-hash manifest.
- A missing translation falls back to the source string and is **censused, not diagnosed** — it is the translator's work, not the author's. An explicit `i18n:sync` script, never the build, writes placeholders, prunes orphans and refreshes the manifest.

### 6.3 Locale and emission

Locale precedence at a render boundary, first match wins:

1. An explicit `lang` arg at the compose site
2. The parent's effective locale
3. The component's authored default
4. The page locale

The effective locale renders onto the root `lang` attribute; the client materializes it at connect.

- The locale is a build-time constant, so `Intl` calls fold: i18n makes a component cheaper to render, not more expensive.
- SSG pages are per locale: template dimensionality is locale × component.
- **The catalog never reaches the browser.** A message with a client-reactive argument is recomputed, not selected: the server renders the keys the client needs into a per-instance `i18n` attribute (per locale, as parsed patterns), and the generated client inlines an evaluator narrowed to the constructs those patterns use. There are no per-language client builds.
- **Template targets** emit one partial per locale, with no locale hole (ADR 0043 s6). Everything argument-independent folds at build; a message whose arguments read server args emits a formatter call over the already-localized pattern literal (PHP `MessageFormatter`, ICU4J), so no catalog reaches the CMS. `Intl` formatting over a hole is refused in favour of the equivalent ICU pattern. An ICU equivalence corpus checks our evaluator against the backend's (ADR 0043 s8).
- The MF2 exit stays pinned by a round-trip suite, so a later move to MessageFormat 2 is mechanical.

## 7. Styling

A compiled stylesheet is **platform CSS** (ADR 0033): it means what the same sheet would mean as an inline `<style>` in its host. Scoping is authored with native `@scope`, and the compiler adds no limits of its own.

**Authoring**

- Style content MUST be static: a `css`-tagged template literal without substitutions. Dynamic values go through custom properties set by bindings.
- The sheet is parsed (`lightningcss`); a parse error is an error.
- `@scope { … }`, with optional author-written `to (<limits>)`, is scoped to the host: `:scope` is the host, bare selectors are its descendants. The idiom roots host rules at `:where(:scope)`, writes descendants bare (relative, `> p`, only where bare would also match deeper own markup) and lists a limit per composed child (ADR 0033 s1).
- A top-level rule led by the component's own tag emits verbatim (the 2.x convention). Any other top-level rule emits verbatim and applies page-wide. `@keyframes`, `@font-face` and `@property` emit verbatim.

**Light DOM emission** gives the sheet the meaning it would have inline in the host:

| Emission | Output |
| --- | --- |
| Native | The sheet as authored. A prelude-less `@scope` gains the explicit root, `@scope (my-el) to (<authored limits>) { … }` |
| Lowered, for CSS targets without `@scope` | Each component `@scope` block unwraps into flat selectors: the root leads as `:where(my-el)`, `:where(:scope)` is that lead, a bare `:scope` becomes the root compound padded to its (0,1,0) specificity, and each authored limit becomes a zero-specificity guard that re-includes a nested own-tag instance below the limit or matched by it |
| Top-level rules outside `@scope` | Verbatim in both emissions |

- The CSS target is `cssTargets` (browserslist-style), defaulting to Baseline widely available; it decides native versus lowered emission and feeds `lightningcss`'s own lowering.
- In light DOM mode `<style>` never reaches the HTML or the client bundle. In Shadow DOM mode the `@scope` block unwraps into each declarative shadow root (`:scope` becomes `:host`, the limits drop), so components are styled at first paint without JS.
- **Hash classes are not used**, in CSS or in locators.

**Errors** (compiler, Prevented):

- a rule inside `@scope` led by the component's own tag (fix-it: `:where(:scope)`);
- `:host` anywhere in a light-mode sheet (fix-it: `:where(:scope)`; `:host(X)` is `:where(:scope)X`);
- `::slotted()` in light mode;
- `:host-context()`;
- `:global` anywhere (fix-it: remove the wrapper, write a top-level rule);
- a selector whose subject an authored limit always excludes (a dead rule);
- a `@scope` form the lowering cannot express, on a lowered CSS target.

**Warnings** (compiler, Contained; LT-502): a downward leak (a scoped rule that can match what a composed child renders, with no limit excluding it) and an unscoped top-level rule.

**Checks over the parsed sheet** (ADR 0042, still Proposed): dead-rule detection (warning); typed custom-property registration where a signal drives `bindStyle`; the typed class handle (`const theme = <style>…</style>`, `class={theme.dark}`).

**Documented differences from the platform**, fixture-pinned:

- page CSS can still reach a light-DOM component's internals;
- the lowered form has no scope proximity: a nested instance of the same component is reached by the outer instance's rules too.

## 8. Intermediate representation

### 8.1 Shape

The IR is the **lowering**: the one place that interprets JSX as a template. The template becomes a closed union of owned nodes; setup statements stay verbatim slices with source positions.

| Node | Carries | Client meaning |
| --- | --- | --- |
| `Element` | Tag, attributes, children | None if fully static |
| `Text` | Static string or expression | Text binding if reactive |
| `Attribute` | Name, class (`static`/`server`/`reactive`), channel | Attribute or property effect |
| `Event` | Event name, handler | `on()` listener |
| `Conditional` / `Switch` | Test, arms, arm keys | Nothing if server-known; keyed arm switch if reactive |
| `Loop` | Source kind (server data / `createList`), item template, empty arm | `each()` or keyed `reconcile()` |
| `Try` | Children, `pending`, `catch` | Keyed `ok`/`nil`/`err` arms |
| `Compose` | Child component, args, pass entries, discriminators | Child custom element |
| `RawHtml` | Expression, policy | Sanitized inner HTML |
| `DynamicElement` | Server-known tag expression | None |

Messages are expressions (`t.<key>` reads and calls), not a separate node.

### 8.2 Annotations

Every expression carries a **reactivity class** plus its dependency closure. Emitters read the class directly:

| Class | Emitted as |
| --- | --- |
| `static` | Literal |
| `server` | Rendered value, or a template hole |
| `reactive` | Rendered initial value plus a client binding |

Routing signals ride alongside for the tier classifier.

### 8.3 Invariants

- **The IR is internal.** It may change in any release. `ts.Node` never appears in a public contract.
- Lowering preserves source positions on every node; verbatim slices are never rewritten, only reindented, which keeps the span tables — and the source maps adapters chain onto — sound.
- No lowered node depends on a specific target.
- **Template emission's interface** may need a published, narrower shape — the emitter-facing serialized form of the owned nodes and portable expressions — if third-party targets (for example a PHP-side emitter) are wanted. That is distinct from the internal IR and is open (O-3).

## 9. Output: HTML

All HTML targets serialize the same template walk; they differ in when `server`-class expressions are evaluated and in what syntax.

### 9.1 Targets

| Target | `server` expressions | Emits | Scope |
| --- | --- | --- | --- |
| SSG | At build, per page × locale | `.html` pages, via `render<Name>(args)` modules | 3.0 |
| Template | By the CMS at request time | A partial with holes per component and locale (ADR 0043 s6) | Twig at 3.0; HTL next |
| SSR | Per request, by a third-party stack | — (the render module is the building block) | Not ours; kept reachable (9.3) |

### 9.2 Template emitter contract

- A target emitter is **a backend of the same IR walk** as the SSG render, never a sibling interpretation. The shared walk owns every decision — hole classification, escaping contexts, refused positions, tier — and a target owns only syntax: it maps a closed set of emission operations to its language and never sees IR nodes (ADR 0043). A backend that cannot translate the whole operation set does not qualify as a target.
- The fold resolves everything independent of server args; **every server arg becomes a hole**. Simulated-tier components emit their Static skeleton in template targets (the Simulated tier is SSG-only).
- **The escaping contract is a security boundary.** Escaping contexts are a closed union assigned by the shared walk; each target implements every context, and every hole gets one. Refused positions are decided in the shared walk and are compile-time errors, never a silent unsafe emit (ADR 0043 s3). Per-target escaping corpora, including negative cases, are part of each target.
- Initial reactive values are never serialized separately: the client harvests them from the nodes they were rendered into.
- Equivalence: rendering a partial with given args MUST match the SSG fold for the same args.

**Required mappings**

| IR | Template output |
| --- | --- |
| `server` `Text` / `Attribute` | Escaped variable output |
| Server-known `Conditional` / `Loop` | The backend's native `if` / `for` |
| Reactive `Conditional` | The prop-dependent initial winner as a backend conditional, plus the inert arm templates |
| `Compose` | Include or macro call with args |
| Message calls | Translation calls (6.3) |
| `RawHtml` | The backend's implementation of the application's policy |
| `Try` | Rendered from an **error shape the CMS supplies** (`{ error: { code, message } }`), `catch` arm on error — deferred (D-28): ADR 0043 has no boundary operation yet |

### 9.3 Keeping SSR reachable

Per-request SSR is out of scope for 3.x, but these invariants keep it one integration away for a third party:

| Invariant | Guaranteed by |
| --- | --- |
| `render<Name>(args, locale)` is a **pure function** of args and locale | Closed fold inputs (3.8) |
| Render modules run on Node, Deno, Bun and edge workers | **Web-standard APIs only**, no runtime-specific imports (ADR 0038 s1: emitted files are runtime-neutral standard output) |
| A streaming server can flush in order without our help | Boundaries render in document order; a `pending` arm is a complete answer the client resolves |
| Any server links exactly the modules and styles a page uses | The manifest (11.1) |

Out-of-order streaming, data loading and routing stay outside the compiler.

## 10. Output: client JS

Each component with at least one reactive binding or event handler compiles to one Le Truc module that adopts server HTML. Fully static components ship no JS.

```ts
import { asNumber, bindText, createCell, defineComponent } from '@zeix/le-truc'

export default defineComponent<MyCounterProps>('my-counter', ({ expose, first, on, watch }) => {
  const span = first('span', 'my-counter: span missing')
  const button = first('button', 'my-counter: button missing')
  const count = createCell(asNumber()(span.textContent)) // harvested, not recomputed
  const step = createCell(1)
  expose({ count })
  on(button, 'click', () => count.set(count.get() + step.get()))
  watch(count, bindText(span))
})
```

- Output MUST be **readable and ejectable**: idiomatic Le Truc, source names, JSDoc and comments preserved.
- **Initial state is harvested** from the server-rendered DOM (formatted values from their raw source, 5.1), never recomputed. The first effect run MUST NOT change the DOM; connect is a fixed point.
- **Locators are generated**, with uniqueness proven structurally against the template the compiler renders: role → bare tag → `type` / `class` / `data-*` discriminator. A candidate a composed child could match gets a `:not(<child-tag> *)` exclusion. An ambiguous author selector is an error (LTC027). No hash classes; ejected code depends only on authored markup.
- One effect per binding site; lists and reactive arms clone from `<template>` skeletons.
- Props reach composed children as properties or `pass()`, never as stringified attributes.
- One module per component; `@zeix/le-truc` is an external peer import. Registration is eager.
- **Versioning.** The compiler declares the runtime as a peer range. Raising the floor is a compiler minor; the browser baseline belongs to the runtime major.

## 11. Output: CSS, manifest and diagnostics

### 11.1 CSS and manifest

- One stylesheet per light-DOM component; `:global` rules are emitted with it, outside the scope.
- The compiler emits a manifest `{ tag → client module, stylesheet, render module, templates }` so SSG, SSR stacks and template targets link only what a page uses. Critical CSS, bundling and minification are left to the consumer.

### 11.2 Diagnostics

Every stage reports into one stream. **Errors fail the build.** Warnings are author-fixable, and the baseline target is zero. Censuses (tier, translation) are separate records that report without asserting wrongness.

| Field | Type | Notes |
| --- | --- | --- |
| `code` | `LTC###` | Closed vocabulary; public API from first publish; a number is never reused |
| `severity` | `'error' \| 'warning'` | Follows the tiering decision recorded with each rule |
| `message` | `string` | Copy follows `writer` → error-messages |
| `location` | `{ file, start, end }` | Source-mapped to the pre-adapter file |
| `related` | `location[]` | E.g. the catalog entry for a mismatched argument |
| `fix` | `{ description, edits }?` | Machine-applicable where safe |

- **Tiered surfacing** (ADR 0028): every runtime check decidable from source and template MUST have a compiler rule (Prevented). The runtime stays the Contained backstop for hand-written components, foreign markup and DOM changed after render; only definition-time failures and the Trusted Types re-throw escalate.
- Formats: terminal, JSON, and SARIF for CI. A TypeScript language-service plugin may follow.
- Authored `.tsx` is checked by plain `tsc` against the host profile; generated modules are checked emit-then-check, with positions remapped to the authored source.

## 12. Public contract

Emitted bytes are not contract. Everything else under the compiler is internal.

| Published | Role |
| --- | --- |
| The host-profile TSX dialect, versioned | What authors write and adapters target; grows only through the ADR 0041 gate |
| The corpus entry point (`compileCorpus(config)`) | The one entry point: compiles a whole corpus and writes the artifacts to `outDir` |
| The corpus result, `RegistryEntry` (public projection) | The consumer half: diagnostics and the registry the run wrote |
| `CompileDiagnostic`, `DiagnosticCode`, `DiagnosticLocation`, `DiagnosticFix`, `DiagnosticEdit` | Diagnostics (ADR 0044) |
| `le-truc.config.json` and its type | The configuration surface (ADR 0036) |
| The generated-module API | `render<Name>`, the client module's default export, the `i18n` module's shape, the `registry.json` schema |

**The entry point is the corpus, not the file** (D-32, owner 2026-10-06). A component's artifacts depend on other components (section 2): compose legality, tier contamination over the compose graph, variant sets. A per-file entry point would hand every consumer that orchestration to rebuild, and one that skips the contamination fixpoint ships wrong tiers without an error. So the published entry point runs both corpus passes and writes the artifacts, `registry.json` and the `i18n` modules to the configured `outDir`. It returns the diagnostics and a summary; the artifacts are files, not return values. `compileComponentTsx`, the per-file front end, stays internal. The incremental API (section 2, O-8) is not part of 3.0; when it ships it is an additive minor.

**`RegistryEntry` is narrowed, not widened.** The public type carries the fields a consumer reads: the tag, the component name, the module paths, the CSS path, the props type, `exposedProps`, the tier and the composed tags. The fields only the compiler reads (`renderedShapes`, `suppressedSites`, `composeReadTags`, `routingSignals`) stay on an internal type, so `RenderedShape` (an IR type, D-25) and `SuppressedSite` (behind the simulation seam, ADR 0035) never become public. The public projection is also the `registry.json` schema.

**The generated-module API is under semver** (ADR 0034 s8 stands). It covers names and signatures, never bytes: `render<Name>` in each `*.server.ts`, the client module's default export, the `i18n` module's shape and the `registry.json` schema. A rename, a removal or a tightened signature is a major. `argsFromAttrs` is internal: only the compiler's own composition and audit code calls it. Making it public later is a minor.

**The input source map for adapters needs no new public signature.** An adapter writes host-profile `.tsx` with a `.tsx.map` sidecar next to it, and the corpus entry point picks the sidecar up (LT-376).

## 13. Decision log

33 decisions, after the team review of 2026-10-01: 30 Ratified (D-16 and D-23 superseded by ADR 0043 while Proposed; nine more endorsed and recorded the same day; D-32 at its design session on 2026-10-06), 1 Endorsed (D-01, whose REQUIREMENTS wording waits for O-9), 1 Parked (D-04) and 1 Deferred to a design session (D-28). Open questions are in section 15.

| # | Decision | Status | Source | § |
| --- | --- | --- | --- | --- |
| D-01 | Hold the minimal-client-state, request/response coordinate | Endorsed — amended: authored component-local payloads stay legal (REQUIREMENTS M19 as written) | PROPOSAL §1; team 2026-10-01 | 1.2, 5.2 |
| D-02 | Per-request SSR not a 3.x target; never blocked | Ratified | ADR 0034 s7; owner 2026-09-29 | 1.5, 9.3 |
| D-03 | Bundling, data loading, routing delegated | Ratified | ADR 0034; draft Q-1, Q-24 | 1.5 |
| D-04 | One authored surface, `.tsx`; `.tsrx` becomes a reference adapter | Parked — needs a cost-benefit analysis; `.tsrx` stays a first-class surface (ADR 0032) | PROPOSAL D1; team 2026-10-01 | 3, 4 |
| D-05 | Standard TSX, `truc:` closed vocabulary, ADR 0041 gate | Ratified | ADR 0032, 0041 | 3.4 |
| D-06 | Function component: server args + typed factory context | Ratified | LT-209 | 3.1 |
| D-07 | Template root is the host element; no fragment; `<style>` nests inside | Ratified | owner 2026-09-29; ADR 0032 s1 | 3.1 |
| D-08 | Light DOM default; Shadow DOM via a declarative shadow template as the root's first child | Ratified — endorsed 2026-10-01 and recorded; composed content stays `{children}`, named slots need their own ADR | ADR 0033 s8 | 3.2 |
| D-09 | Reactive attributes are arrow thunks; a text child is reactive by what it reads | Ratified | ADR 0024 s4 | 3.3 |
| D-10 | Reactive text owns its element's whole text content | Ratified | LTC005 | 3.3 |
| D-11 | Control flow as JSX expressions; reactive conditions as template-cloned arms | Ratified | ADR 0037 | 3.5 |
| D-12 | Reactive loops over `createList`, keyed by the list | Ratified | ADR 0017; LTC001/052 | 3.5 |
| D-13 | `first()`/`all()` references, structural selectors, no `ref` | Ratified | ADR 0024 s11; LT-127 | 3.6 |
| D-14 | One application-provided sanitize policy for every target | Ratified — endorsed 2026-10-01 as amended: an unconfigured policy fails closed, not a diagnostic | ADR 0010 s6, ADR 0043 s3 | 3.7 |
| D-15 | Closed fold inputs (partial-readiness invariant) | Ratified | ADR 0034 s4 | 3.8 |
| D-16 | Portable expression subset for template targets | Ratified — superseded by ADR 0043 s1–s2 (no pure calls; emittability target-independent) | ADR 0043 | 3.8 |
| D-17 | Source-to-source adapter seam; translate and refuse | Ratified — endorsed 2026-10-01 and recorded; experimental until a first-class reference adapter ships | ADR 0032 s6 | 4 |
| D-18 | Only error-free adapted components mix with native ones | Ratified — endorsed 2026-10-01 and recorded with D-17 | ADR 0032 s6 | 4 |
| D-19 | The data account | Ratified | LT-112/113 | 5.1 |
| D-20 | Formatted reactive values keep a raw value source | Ratified — endorsed 2026-10-01 and recorded in the data account | HOST_PROFILE bullet 6 | 5.1 |
| D-21 | Tiered evaluation; unresolvable omitted everywhere; no synthesized hydration payload | Ratified | ADR 0027, 0029, 0035; REQUIREMENTS M19 | 5.2 |
| D-22 | i18n as build-time server data; ICU MF1; catalog never shipped | Ratified | ADR 0030 | 6 |
| D-23 | Template targets format messages through backend ICU | Ratified — superseded by ADR 0043 s6 (`MessageFormatter` over the localized pattern; one partial per locale, no locale hole) | ADR 0043 | 6.3 |
| D-24 | Platform CSS: authored `@scope`, native or `:where()` lowering, no hash classes | Ratified | ADR 0033; owner 2026-09-29 | 7 |
| D-25 | IR is the lowering, internal, one walk with many emitters | Ratified — endorsed 2026-10-01 and recorded | ADR 0034 s8, ADR 0040 | 8 |
| D-26 | Reactivity class annotation on every expression | Ratified — endorsed 2026-10-01 and recorded | ADR 0040 s7 | 8.2 |
| D-27 | Template emission: holes, escaping as a security boundary | Ratified | ADR 0034 s3, ADR 0043 | 9.2 |
| D-28 | Template `Try` renders from a CMS-supplied error shape | Deferred — design session to amend ADR 0043; without `Try` a whole class of use cases is unsupported | draft Q-23; team 2026-10-01 | 9.2 |
| D-29 | Readable, ejectable client; harvested state; connect is a fixed point | Ratified | ADR 0024, 0027 | 10 |
| D-30 | Structured, source-mapped diagnostics; JSON and SARIF | Ratified — endorsed 2026-10-01 and recorded | ADR 0044 | 11.2 |
| D-31 | Compiler first, runtime backstop (tiered surfacing) | Ratified | ADR 0028 | 11.2 |
| D-32 | Public contract = dialect + one entry point + consumer half | Ratified — the one entry point is the corpus pass and writes to `outDir`; `RegistryEntry` narrowed to a public projection; the generated-module API is under semver, `argsFromAttrs` excluded; incremental API deferred to a later minor (LT-471) | PROPOSAL D4; team 2026-10-01; owner 2026-10-06 | 12 |
| D-33 | TS 6 API for v1; TS types never public; TS 7.1 / native parsers a goal | Ratified — endorsed 2026-10-01 and recorded | ADR 0034 s8, ADR 0032 s4 | 2 |

## 14. Design review

### 14.1 Coherence

The stance is consistent — server HTML is the source of truth, the platform does the work where it can, everything outside compilation is delegated — but some pairs pull against each other.

| Tension | Decisions | Resolution |
| --- | --- | --- |
| Formatted values do not parse back into state | D-29, D-22 | Raw value source (D-20) |
| Structural locators can match projected or composed content | D-13, D-08 | Exclusions from the registry's rendered shapes; ambiguity is an error |
| An internal IR versus a template-emitter interface third parties may want | D-25, D-27 | Separate, narrower emitter-facing shape if needed (O-3) |
| Markup holes (named slots, CMS fragments) versus per-hole escaping | D-27, D-08 | A ratified trusted-fragment hole class, decided as a security question (O-4); slots-less v1 meanwhile |
| Two ICU evaluators (ours, the backend's) must agree | D-22, D-23 | Equivalence corpus, like the fold-versus-realm audit |
| One authored surface versus statement-context control flow | D-04 | The five `@for`/`@switch` corpus components are the test of the cost |
| Native `ts.Node` internally versus a cheap TS 7 swap | D-25, D-33 | The converter leaf (ADR 0032 s4; O-2, answered) |

Smaller frictions: eager registration of one module per component means many requests unless the consumer bundles; the Simulated tier is unavailable to CMS consumers by construction.

### 14.2 Maintenance risk

| Rank | Decision | Why costly | Mitigation |
| --- | --- | --- | --- |
| 1 | TS 6 API as the only engine (D-33) | External and time-bound; TS 7 supersedes the JS API | TS types stay internal; parser confinement behind the converter (ADR 0032 s4) |
| 2 | Template targets (D-27) | Escaping in languages we do not execute; the portable subset; error shapes; backend ICU | Twig as the first-class reference; per-target escaping corpora; equivalence to SSG |
| 3 | The Simulated tier (D-21) | A second evaluation mechanism with an optional heavyweight substrate | DOM-free seam; CI equivalence audit; SSG-only scope |
| 4 | Lowered CSS for non-`@scope` targets (D-24) | Two emission strategies must behave identically; ours to maintain | Explicit `cssTargets`; drop the lowering when the baseline moves |
| 5 | The adapter seam (D-17) | A public dialect with versioning and conformance | Experimental until one real adapter; TSRX as the baseline |
| 6 | Shadow mode (D-08) | Slots, harvest and ID references change behaviour at the boundary | Opt-in; built on demand |

### 14.3 Reversibility

| Rank | Decision | Who depends on it |
| --- | --- | --- |
| 1 | The authoring surface: root-is-host, thunks, `truc:` vocabulary, factory context (D-05–D-09) | Every component and every adapter |
| 2 | The HTML contract: harvested state, config attributes, arm keys, locator shapes (D-11, D-13, D-29) | Cached pages, CMS templates, ejected clients |
| 3 | The root tag as identity (D-07) | HTML, CSS, CMS templates, catalog keys |
| 4 | Diagnostic codes and the public contract (D-30, D-32) | CI integrations, adapter authors |
| 5 | Light DOM as the default (D-08) | Styling, harvest, locators |
| 6 | ICU MF1 (D-22) | Catalogs and translation workflows; the MF2 exit is pinned |

Cheap to reverse because delegated or internal: bundling, eager registration, in-order output, CLI-only diagnostics, manifest-only CSS, reactive message inlining, and the TS engine — as long as no TypeScript type leaks into a contract.

## 15. Open questions

| # | Question | Considerations |
| --- | --- | --- |
| O-1 | **Demand for adapters.** Is there a named persona or pioneer for third-party adapters? | If not, the seam shrinks to "document the dialect as a target and read the `.tsx.map` sidecar" (D-32), with no conformance suite until someone asks. |
| O-2 | **Parser confinement.** Should the machinery hold native `ts.Node`, or keep parser access behind one converter leaf? | **Answered — the converter leaf** (ADR 0032 s4): `typescript` API use is confined to the TS → estree converter, which a maintained library implements (`@typescript-eslint/typescript-estree`), and the machinery walks estree, not `ts.Node`. The remaining TS 7 risk is the converter's `typescript` peer range following TypeScript (LT-254 rider; LT-377 pins that no TypeScript type is published). |
| O-3 | **Emitter-facing IR.** Are template targets first-party only (Twig, HTL), or does the emitter interface publish a serialized, versioned shape? | Publishing would let backends be written in other languages. |
| O-4 | **Trusted-fragment holes.** Named slots and CMS-supplied markup need an unescaped hole class. Accept a slots-less v1 until then? | A security ADR beside ADR 0010, with its channel and tier. Shadow mode's native `<slot>` is unaffected. |
| O-5 | **Portals.** Demand-prioritized, no shape recorded yet? |  |
| O-6 | **Backend ICU.** Twig through Symfony's ICU, or one partial per locale with folded text? | **Answered — one partial per locale, no locale hole** (ADR 0043 s6). Argument-independent text folds at build; a message whose arguments read server args emits a formatter call over the already-localized pattern literal (PHP `MessageFormatter`, ICU4J), so no catalog reaches the CMS. Patterns are preserved where arguments are dynamic, so the ICU equivalence corpus stays (ADR 0043 s8). |
| O-7 | **Adapter diagnostics wording.** Host-dialect wording behind source-mapped positions, or a re-wording hook for adapters? |  |
| O-8 | **Dev loop.** First-party Bun and Vite plugins for watch and HMR, or only the incremental API? |  |
| O-9 | **Positioning.** Adopt section 1.2 as a stated position in REQUIREMENTS, including the bounded client-read rule and server-wins-on-swap? | Does a Solid adapter strengthen or blur the pitch? |
| O-10 | **Adapter type access.** May adapters query types over the shared program, or do they see only their own source? | Leaning: only their own source — no plugin machinery. |

## 16. Rejected alternatives

| Alternative | Why rejected |
| --- | --- |
| Keep two first-party surfaces | Byte-identical parity across two grammars is affordable, not free, and only `.tsx` publishes at 3.0; the second surface is purely internal cost. |
| Publish the IR as the adapter seam | Freezes the IR unions and AST vocabulary under semver exactly when template emission needs to change them. |
| Drop the IR, emit from the AST | Deletes the data structure, not the interpretation, which would multiply across every emitter and analysis pass. |
| Homomorphic SSR, no IR | Executing code yields HTML for concrete args; a template with holes needs to know which bytes depend on which arg. Kills template emission. |
| Adopt an existing isomorphic framework | Every candidate hydrates or serializes state, or needs a JavaScript backend, and none emits backend template partials. |
| Hash-class scoping and locators | A client-transform mechanism with no server counterpart; hash classes in every served byte; ejected code tied to generated names. |
| Tag derived from the function name, fragment root | Makes a function rename a public break and leaves no place for static host attributes. |
| Bare signals as reactive attributes | Cannot express derived bindings and blurs which phase evaluates what. |

## Appendix A — How the major component models fare

Illustrative, not part of any decision: a first read of each source format as a TSX-emitting adapter against the section 4 criterion.

| Source | Syntax → TSX | Code-model fit | Principal refusals |
| --- | --- | --- | --- |
| TSRX | Directive grammar; mechanical | Same host profile by construction | None beyond the dialect's own |
| Solid TSX | Native JSX, near-free | Closest: tracked expressions ≈ reactive thunks; `<Show>`/`<For>` ≈ arms/loops; `<Dynamic>` ≈ `truc:element` for HTML tags | Components owning their DOM; args/harvest conventions needed |
| Vue SFC | Own template grammar; needs a parser | `<script setup>` runs once — best code-model fit; refs/computed/`v-model` map cleanly | Slots beyond `children` (O-4), mixin chains |
| Svelte SFC | Own grammar; needs a parser | Runes map ≈ 1:1 onto signals | Transitions and actions; `{#key}` is a machinery gap |
| React / Preact TSX | Native JSX, near-free | Hooks are a model rewrite (re-run per render versus run-once factory) | Portals (O-5), render-time DOM, HOCs, VDOM identity |
| Preact Signals | Native JSX | `signal`/`computed` → `createCell`/`deriveCell` | As React for the rest |
| Lit | lit-html templates; needs a parser | Reactive properties → `expose()`; patch-over-persistent DOM is closer to our model than React's | Class inheritance and mixins |

## Appendix B — Distance from today

As of 2026-10-06, for orientation only; it ages quickly. The current architecture is described in `server/compiler/LE_TRUC_COMPILER.md`.

| § | Progress | Built | Partial or missing |
| --- | --- | --- | --- |
| 2 Pipeline | Partial | One IR, shared pipeline, two-pass corpus | Partial: the corpus pass lives in `server/`, outside the package (LT-480). Missing: incremental API (a later minor, D-32), input source maps (LT-376), output source maps (LT-247, parked), dev-loop plugins (O-8) |
| 3.1 Module shape | Done | Typed factory context; root-is-host enforced (LTC060, LT-375) |  |
| 3.2 Shadow mode | Missing |  | Missing: unbuilt, unscheduled |
| 3.3 Bindings | Done | All |  |
| 3.4 Vocabulary | Partial | `truc:try` (template-cloned arms, ADR 0037 s4), `truc:pass`, `truc:html` | Missing: `truc:element`, built when a migration needs it; the children contract (ADR 0048, track C) |
| 3.5 Control flow | Done | Server-known conditions, loops, empty arm; reactive conditions as template-cloned arm sets (ADR 0037, LT-274, LT-276); nested arm sets and reactive lists (ADR 0046) |  |
| 3.7 Trust | Partial |  | Partial: server sanitizer configurable; one shared policy blocked on TypeScript's DOM lib |
| 3.8 Fold inputs / portable subset | Partial | LTC054 | Missing: portable subset |
| 4 Adapters | Missing |  | Missing: no adapter seam (LT-376, P7; its input map rides a `.tsx.map` sidecar, D-32); `.tsrx` is a second first-party front end with variant sets and parity suites |
| 5 Evaluation | Done | Three tiers, simulation seam, census; jsdom an optional peer dependency (M28) |  |
| 6 i18n | Partial | MF1, per-key types, client message channel, censuses, MF2 exit pin | Missing: template-target translation |
| 7 Styling | Partial | Scoped CSS: native `@scope` or the flat-selector lowering (LT-268, LT-304, LT-306) | Missing: ADR 0042 checks (LT-214 and LT-269 gated on need, LT-270 open); children style scope (ADR 0048) |
| 8 IR | Partial | Internal (D-25); typed unions (LT-287, LT-289) | Missing: no reactivity-class annotation as such |
| 9 HTML | Partial | SSG | Missing: template emission (LT-257, release-gating) |
| 10 Client | Done | All |  |
| 11 Diagnostics | Partial | ~77 codes; record is `{ code, severity, message, location, related, fix? }` (ADR 0044 s1, LT-371) | Partial: terminal only |
| 12 Public contract | Partial | Ruled (D-32, 2026-10-06) | Missing: the contract reshape (LT-480), then the publish (LT-254) |
