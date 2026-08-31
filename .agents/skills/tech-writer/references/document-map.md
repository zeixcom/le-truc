# Document Map

Every document this skill maintains, with its audience, scope, what triggers an update, and what to check in a consistency review.

## Pages

### `docs-src/pages/index.md`
**Audience:** Developers evaluating Le Truc — potential adopters, comparison shoppers
**Register:** Persuasive, vision-focused, marketing-adjacent but technically grounded
**Scope:** Value proposition, philosophy (HTML-first, progressive enhancement, no client rendering), key differentiators vs. SPA frameworks and Hypermedia frameworks, bundle size

**Update triggers:**
- The library's fundamental approach changes
- A major new capability shifts the positioning
- Bundle size target changes significantly

**Do NOT update for:** individual API additions, bug fixes, internal changes.

**Consistency checks:**
- Bundle size claim (~10kB gzipped) matches current output
- Technical claims about what Le Truc does/doesn't do are accurate

### `docs-src/pages/getting-started.md`
**Audience:** New users installing Le Truc for the first time
**Register:** Instructional, step-by-step, assumes web development competence
**Scope:** CDN and package manager installation, progressive enhancement concept, first component walkthrough

**Update triggers:**
- Package name or import path changes
- Quick-start example uses an API that has changed
- Installation method added or removed (CDN URL, new package manager)
- Progressive enhancement lifecycle description becomes inaccurate

**Consistency checks:**
- CDN URL is current
- Import statement matches current package name and exports
- First component example uses current `defineComponent` API and compiles

### `docs-src/pages/components.md`
**Audience:** Developers learning to build Le Truc components
**Register:** Mixed — explanation prose around reference tables and hands-on fragments; set the dials per section (see references/tone-guide.md → Text Types). Assumes JavaScript competence
**Scope:** Chapter *Building Components*, part 1 — `defineComponent()` signature and factory form, the connect/disconnect lifecycle (including hand-authored `EffectDescriptor` with `watch(() => true, …)`), element queries (`first`, `all`, `query`, `queryAll`); embeds the `docs-lifecycle` interactive

**Update triggers:**
- `defineComponent` signature changes
- `first()` or `all()` behavior changes
- The connect/disconnect lifecycle changes
- Code examples reference an API that has changed

**Consistency checks:**
- `defineComponent` call signature in all examples matches `src/component.ts`
- `first()` and `all()` behavior description matches `src/helpers/dom.ts`
- All code examples compile against current exports in `index.ts`
- The `docs-lifecycle` demo markup matches `examples/docs/lifecycle/docs-lifecycle.html`

### `docs-src/pages/props.md`
**Audience:** Developers declaring reactive state on components
**Register:** Mixed — how-to fragments around a reference table; assumes the reader has read components.md
**Scope:** Chapter *Building Components*, part 2 — `expose()` initializers (parsers, static values, signals), signal-type table, deprecated-name migration, non-nullability, local signals, read-only properties, `defineMethod()`

**Update triggers:**
- `expose()` semantics or initializer kinds change
- A signal type is added, removed, or renamed (also update the deprecated-names section)
- `defineMethod()` behavior changes

**Consistency checks:**
- Signal-type table rows match the re-exports in `index.ts`
- Parser examples match `src/parsers/`
- Nil-behavior claims match the `bind*` table on effects.md

### `docs-src/pages/effects.md`
**Audience:** Developers wiring events and reactive DOM updates
**Register:** Mixed — how-to with reference table; assumes the reader has read props.md
**Scope:** Chapter *Building Components*, part 3 — `on()`, `watch()`, the `bind*` helper table (DOM update + nil behavior per helper), thunks, `each()`, bidirectional binding with native elements

**Update triggers:**
- A `bind*` helper is added, removed, or changes nil behavior (update the table)
- `on()` or `watch()` semantics change
- `each()` behavior changes

**Consistency checks:**
- `bind*` table matches `src/bindings.ts` (JSDoc per helper)
- `each()` description matches `src/helpers/reactive.ts`

### `docs-src/pages/extensions.md`
**Audience:** Developers opting components into form participation, attribute reactivity, or debug instrumentation
**Register:** Reference-leaning — mechanism intro plus per-extension how-tos
**Scope:** Chapter *Building Components*, part 4 — the `ComponentExtension` mechanism, `formAssociated()`, `formAssociatedCheckbox()`, `relayValidity()`, `observedAttributes()`, `debug()` instrumentation

**Update triggers:**
- An extension is added, removed, or changes its host contract
- `relayValidity()` semantics change
- Debug instrumentation behavior changes (ADR 0022)

**Consistency checks:**
- Extension table matches exports in `index.ts`
- Form-association contract matches `src/extensions/form.ts`
- `observedAttributes()` description matches `src/extensions/attributes.ts`

### `docs-src/pages/data-flow.md`
**Audience:** Developers building multi-component UIs
**Register:** Explanation built on one worked scenario (the product catalog); assumes the reader has read components.md
**Scope:** Chapter *Coordinating Components*, part 1 — the "split first, then coordinate" framing and mechanism comparison table, `pass()` for parent-to-child signal binding with the `ModuleCatalog`/`BasicButton`/`FormSpinbutton` scenario

**Update triggers:**
- `pass()` behavior or scope changes (e.g. Le Truc-only restriction clarified)
- The mechanism comparison table needs a new row or a changed coupling claim
- Code examples reference a changed API

**Consistency checks:**
- `pass()` callout about Le Truc-only scope is accurate
- Mechanism table links resolve to context.html and async.html
- Catalog example signatures match the `module-catalog` example source

### `docs-src/pages/lists.md`
**Audience:** Developers rendering dynamic keyed collections
**Register:** How-to with explanation; embeds the `docs-reconcile` interactive
**Scope:** Chapter *Coordinating Components*, part 2 — `createList()` and `keyConfig`, `reconcile()` (adoption, keyed moves, escape hatches, collector parity), add/remove mutations, the `module-list` example

**Update triggers:**
- `createList()` usage or the DOM reconciliation pattern changes
- `reconcile()` semantics change (adoption, `data-unreconciled`, `bindItem` parity)
- The `module-list` example source changes materially

**Consistency checks:**
- `reconcile()` description matches `src/helpers/reactive.ts`
- Reconciler pattern matches the `module-list` example source
- The `docs-reconcile` demo markup matches `examples/docs/reconcile/docs-reconcile.html`

### `docs-src/pages/context.md`
**Audience:** Developers sharing state across the component tree
**Register:** How-to — provider and consumer as one flow
**Scope:** Chapter *Coordinating Components*, part 3 — `createContext()`, provider components with `provideContexts()`, consumers with `requestContext()` and fallback semantics, the `context-media` example

**Update triggers:**
- `provideContexts` / `requestContext` API changes
- Fallback or late-provider behavior changes

**Consistency checks:**
- Example signatures match `src/helpers/context.ts`
- Fallback/late-provider claims match AGENTS.md context-protocol entry

### `docs-src/pages/async.md`
**Audience:** Developers loading data inside components
**Register:** Explanation with how-to fragments
**Scope:** Chapter *Coordinating Components*, part 4 — `Task` and `match()` state routing (`nil`/`err`/`stale`/`ok`), the `module-lazyload` example, `deriveList()` fetching into a reconciled list; embeds the `docs-task-states` interactive

**Update triggers:**
- Task state routing or `stale` semantics change
- `deriveList()` options change
- The `module-lazyload` example changes materially

**Consistency checks:**
- State-precedence list matches `@zeix/cause-effect` behavior
- `deriveList` example matches the `module-users` pattern and current API
- The `docs-task-states` demo markup matches `examples/docs/task-states/docs-task-states.html`

### `docs-src/pages/styling.md`
**Audience:** Frontend developers and designers adding styles to Le Truc components
**Register:** Practical — presents two approaches with explicit trade-offs; assumes CSS competence
**Scope:** Scoping styles to the custom element name, Shadow DOM encapsulation, CSS custom properties for design tokens

**Update triggers:**
- Le Truc's approach to styling changes (e.g., if Shadow DOM support is added to `defineComponent`)
- A recommended practice changes

**Consistency checks:**
- Describes only techniques that work with current Le Truc (no Shadow DOM in `defineComponent` unless added)

### `docs-src/pages/examples.md`
**Audience:** Developers browsing example components
**Register:** Navigation — minimal prose; the `{% listnav %}` is the content
**Scope:** The `{% listnav %}` listing all example components grouped by category

**Update triggers:**
- A new example component is added to `examples/` (each needs a `.md` doc for the examples effect to build its page)
- An example component is removed or renamed

**Consistency checks:**
- Every directory in `examples/` that has a `.md` and `.html` file is listed here
- Links follow the pattern `./examples/component-name.html`
- Groups (Basic, Card, Context, Docs, Form, Module) are correct for current examples

### `docs-src/pages/api.md`
**Audience:** Developers browsing the API reference
**Register:** Navigation — generated, not authored
**Scope:** The `{% listnav %}` linking to TypeDoc-generated pages in `docs-src/api/`. **`api.md` is written by `apiEffect` at build time and is gitignored — never edit it by hand.** New exports appear after `bun run build:docs`.

**Update triggers:**
- None manual — regenerate with `bun run build:docs`. To change content, update JSDoc in `src/`.

**Consistency checks:**
- The generated list includes every exported symbol TypeDoc generates a page for (if one is missing, the export may lack JSDoc or be excluded by `typedoc.json`)

### `docs-src/pages/blog/YYYY-MM-DD-slug.md`
**Audience:** Developers browsing the blog — curious about the project's history, design thinking, or how it compares to alternatives
**Register:** Plain, direct, conversational — see references/tone-guide.md `<blog>` section
**Scope:** Release announcements, design decisions, comparisons with other tools, lessons learned

**Frontmatter fields:**
- `title` — short, direct; no punctuation at the end
- `description` — one sentence; plain English summary of what the post covers
- `emoji` — single emoji that fits the topic
- `layout: blog` — always this value
- `date` — ISO format `YYYY-MM-DD`
- `author` — full name
- `tags` — comma-separated lowercase keywords

**Update triggers:**
- A new post is being written
- An existing post needs factual corrections (e.g., an API described has since changed)

**Do NOT update for:** style preferences of individual readers, minor phrasing nits in published posts.

**Consistency checks:**
- Technical claims (API names, behavior descriptions, bundle size) are accurate for the version at the time of writing
- No jargon or corporate buzzwords (see tone-guide.md `<blog>`)
- Frontmatter is complete and valid

## README.md
**Audience:** Developers discovering or evaluating the library on GitHub or npm
**Register:** Concise overview — installation, quick-start, brief feature list; links to the docs site for depth
**Scope:** What Le Truc is, installation, a minimal working example, links to documentation

**Update triggers:**
- Package name or install command changes
- Quick-start example uses a changed API
- Major new capability worth surfacing in the overview
- Docs site URL changes

**Consistency checks:**
- Install command is current
- Quick-start example compiles and demonstrates current API
- Links to docs pages resolve

## ARCHITECTURE.md
**Audience:** Contributors to the library; AI agents reasoning about internals
**Register:** Technical, precise, internal-facing — implementation details expected and correct
**Scope:** File map, dependency graph, component lifecycle (`connectedCallback`, `#setAccessor`, `#initSignals`, `disconnectedCallback`), effect system (`watch`/`makeWatch`, `on`/`makeOn`, `pass`/`makePass`, `each`, `EffectDescriptor`), `bind*` helpers, UI query system (`first`, `all`, dependency resolution, selector type inference), parser system, event-driven sensors, context protocol, scheduler, security

**Update triggers:**
- A source file is added to or removed from `src/`
- The component lifecycle changes (initialization order, signal creation, dependency resolution)
- `makeWatch`, `makeOn`, `makePass`, or `each` internals change
- `first()` / `all()` / dependency resolution behavior changes
- Parser detection (`isParser`, `isMethodProducer`) changes
- Context protocol implementation changes
- Security validation rules change

**Consistency checks:**
- File map matches actual files in `src/` and `src/parsers/`
- Lifecycle section matches `src/component.ts`
- Effect system description matches `src/helpers/reactive.ts`, `src/helpers/events.ts`, and `src/bindings.ts`
- `pass()` description matches `src/helpers/reactive.ts` (`makePass`)
- Parser/MethodProducer distinction matches `src/types.ts`

## AGENTS.md
**Audience:** AI agents at inference time
**Register:** Terse, direct, AI-optimized — every token has a cost; no explanatory padding
**Scope:** Non-obvious behaviors that a competent Le Truc developer would not predict from the public API alone; the `DEV_MODE` debug flag

**Update triggers:**
- A non-obvious behavior is introduced, changed, or resolved
- An existing entry becomes inaccurate
- A new source of subtle bugs is identified

**Consistency checks:**
- Every entry is still accurate for the current implementation
- No entry describes behavior that has since changed or been removed
- Parser branding, MethodProducer branding, `pass()` scope, `all()` laziness, `setAttribute` security, `undefined` restore, dependency timeout, debug mode, and factory-form `observedAttributes` behavior are all documented

## JSDoc in src/
**Audience:** IDE users (hover documentation); TypeDoc input for `docs-src/api/`
**Register:** Brief, typed, precise — one-line summaries; `@param`/`@returns` only
**Scope:** Public API functions and their parameters, return values, and non-obvious constraints. Internal helpers do not require JSDoc.

**Update triggers:**
- A public function's parameter is added, removed, renamed, or retyped
- A public function's return value or semantics change
- A public function is removed

**Consistency checks (spot-check):**
- `@param` names match current parameter names in the function signature
- `@returns` descriptions match current return type semantics
- No `@param` tags reference removed parameters
- No `@example` blocks use deprecated API
- `@since` tags are present on all exported functions

## Change to Document Matrix
Quick reference for update-after-change.md:

| Change type | JSDoc | ARCH | AGENTS | README | Pages |
|---|---|---|---|---|---|
| New exported function/type | ✓ | — | — | — | api.md regenerates automatically |
| Removed export | ✓ | ✓ if structural | ✓ if was non-obvious | — | api.md regenerates automatically |
| Changed public API signature | ✓ | — | — | ✓ if in quick-start | the page that documents it (see page table) |
| New/changed non-obvious behavior | — | ✓ if structural | ✓ | — | callout in relevant page if user-facing |
| Internal implementation change | — | ✓ | ✓ if tricky | — | — |
| New example component added | — | — | — | — | examples.md nav list |
| Example renamed/removed | — | — | — | — | examples.md nav list |
| Installation/package change | — | — | — | ✓ | getting-started.md |
| Guide restructured (pages added/removed/renamed) | — | — | — | ✓ docs list | update `PAGE_ORDER` + `CHAPTERS` in `server/config.ts`, `CURATED_PAGES` in `server/effects/llms-full-manifest.ts`, and document-map entries; any pipeline *code* goes to `docs-server-dev` as a `TODO.md` task (see workflows/improve-docs-architecture.md) |
