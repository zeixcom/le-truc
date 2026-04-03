<overview>
Every document this skill maintains, with its audience, scope, what triggers an update,
and what to check in a consistency review.
</overview>

<documents>

<pages_index_md>
**Path:** `docs-src/pages/index.md`
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
</pages_index_md>

<pages_getting_started_md>
**Path:** `docs-src/pages/getting-started.md`
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
</pages_getting_started_md>

<pages_components_md>
**Path:** `docs-src/pages/components.md`
**Audience:** Developers learning to build Le Truc components
**Register:** Tutorial — walks through real code with explanation; assumes JavaScript competence
**Scope:** `defineComponent` — both the 2-param factory form (preferred, since 1.1) and the 4-param form; reactive properties (parsers, readers, static); factory vs. 4-param trade-offs (attribute reactivity); `first`, `all`; effects; `asMethod()` for imperative methods; `all()` for dynamic collections

**Update triggers:**
- `defineComponent` signature changes
- A parser is added, removed, or changes semantics
- `first()` or `all()` behavior changes
- A new property initializer kind is introduced
- The three-phase initialization order changes
- Code examples reference an API that has changed

**Consistency checks:**
- `defineComponent` call signature in all examples matches `src/component.ts`
- Parser names and signatures match `src/parsers/`
- `first()` and `all()` behavior description matches `src/ui.ts`
- `asMethod()` description matches `src/parsers.ts`
- All code examples compile against current exports in `index.ts`
</pages_components_md>

<pages_data_flow_md>
**Path:** `docs-src/pages/data-flow.md`
**Audience:** Developers building multi-component UIs
**Register:** Tutorial — builds from a concrete scenario; assumes the reader has read components.md
**Scope:** `pass()` for parent-to-child signal binding, `provideContexts`/`requestContext` for shared ancestor state, `asMethod()` for imperative APIs on dynamic lists, event delegation

**Update triggers:**
- `pass()` behavior or scope changes (e.g., Le Truc-only restriction clarified)
- `provideContexts` / `requestContext` API changes
- `asMethod()` usage changes
- `createMemo` or other signal API used in examples changes
- Code examples reference a changed API

**Consistency checks:**
- `pass()` callout about Le Truc-only scope is accurate
- `provideContexts` / `requestContext` example signatures match `src/context.ts`
- `asMethod()` branding requirement is accurately stated
- All code examples compile against current exports
</pages_data_flow_md>

<pages_styling_md>
**Path:** `docs-src/pages/styling.md`
**Audience:** Frontend developers and designers adding styles to Le Truc components
**Register:** Practical — presents two approaches with explicit trade-offs; assumes CSS competence
**Scope:** Scoping styles to the custom element name, Shadow DOM encapsulation, CSS custom properties for design tokens

**Update triggers:**
- Le Truc's approach to styling changes (e.g., if Shadow DOM support is added to `defineComponent`)
- A recommended practice changes

**Consistency checks:**
- Describes only techniques that work with current Le Truc (no Shadow DOM in `defineComponent` unless added)
</pages_styling_md>

<pages_examples_md>
**Path:** `docs-src/pages/examples.md`
**Audience:** Developers browsing example components
**Register:** Navigation — minimal prose; the `{% listnav %}` is the content
**Scope:** The `{% listnav %}` listing all example components grouped by category

**Update triggers:**
- A new example component is added to `examples/`
- An example component is removed or renamed

**Consistency checks:**
- Every directory in `examples/` that has a `.html` file is listed here
- Links follow the pattern `./examples/component-name.html`
- Groups (Basic, Card, Context, Form, Module, Section) are correct for current examples
</pages_examples_md>

<pages_api_md>
**Path:** `docs-src/pages/api.md`
**Audience:** Developers browsing the API reference
**Register:** Navigation — the `{% listnav %}` is the content; prose is minimal
**Scope:** The manually-maintained `{% listnav %}` linking to TypeDoc-generated pages in `docs-src/api/`

**Update triggers:**
- A new symbol is exported from `index.ts` (add a link in the appropriate category)
- An exported symbol is removed (remove its link)
- A symbol is renamed

**Consistency checks:**
- Every exported symbol in `index.ts` that TypeDoc generates a page for has a link here
- Links follow the pattern `./api/{category}/{SymbolName}.html`
- Categories (Functions, Classes, Variables, Type Aliases) match TypeDoc's output structure
- No links point to removed symbols
</pages_api_md>

<pages_blog>
**Path:** `docs-src/pages/blog/YYYY-MM-DD-slug.md`
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
</pages_blog>

<README_md>
**Path:** `README.md`
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
</README_md>

<ARCHITECTURE_md>
**Path:** `ARCHITECTURE.md`
**Audience:** Contributors to the library; AI agents reasoning about internals
**Register:** Technical, precise, internal-facing — implementation details expected and correct
**Scope:** File map, dependency graph, component lifecycle (`connectedCallback`, `#setAccessor`, `attributeChangedCallback`, `disconnectedCallback`), effect system (`runEffects`, `updateElement`), UI query system (`first`, `all`, dependency resolution, selector type inference), parser system, event-driven sensors, context protocol, scheduler, security

**Update triggers:**
- A source file is added to or removed from `src/`
- The component lifecycle changes (initialization order, signal creation, dependency resolution)
- `updateElement` or `runEffects` internals change
- `first()` / `all()` / dependency resolution behavior changes
- Parser detection (`isParser`, `isMethodProducer`) changes
- Context protocol implementation changes
- Security validation rules change

**Consistency checks:**
- File map matches actual files in `src/` and `src/effects/` and `src/parsers/`
- Lifecycle section matches `src/component.ts`
- Effect system built-in effects table matches effects exported in `index.ts`
- `pass()` description matches `src/effects/pass.ts`
- Parser/Reader distinction matches `src/parsers.ts`
</ARCHITECTURE_md>

<CLAUDE_md>
**Path:** `CLAUDE.md`
**Audience:** Claude (this model) at inference time
**Register:** Terse, direct, AI-optimised — every token has a cost; no explanatory padding
**Scope:** Non-obvious behaviors that a competent Le Truc developer would not predict from the public API alone; debug mode flags

**Update triggers:**
- A non-obvious behavior is introduced, changed, or resolved
- An existing entry becomes inaccurate
- A new source of subtle bugs is identified

**Consistency checks:**
- Every entry is still accurate for the current implementation
- No entry describes behavior that has since changed or been removed
- Parser branding, MethodProducer branding, `pass()` scope, `all()` laziness, `setAttribute` security, `undefined` restore, dependency timeout, debug mode, and factory-form `observedAttributes` behavior are all documented
</CLAUDE_md>

<jsdoc_in_src>
**Path:** `src/*.ts`, `src/effects/*.ts`, `src/parsers/*.ts`
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
</jsdoc_in_src>

</documents>

<change_to_document_matrix>
Quick reference for update-after-change.md:

| Change type | JSDoc | ARCH | CLAUDE | README | Pages |
|---|---|---|---|---|---|
| New exported function/type | ✓ | — | — | — | api.md nav list |
| Removed export | ✓ | ✓ if structural | ✓ if was non-obvious | — | api.md nav list |
| Changed public API signature | ✓ | — | — | ✓ if in quick-start | components.md or data-flow.md if documented |
| New/changed non-obvious behavior | — | ✓ if structural | ✓ | — | callout in relevant page if user-facing |
| Internal implementation change | — | ✓ | ✓ if tricky | — | — |
| New example component added | — | — | — | — | examples.md nav list |
| Example renamed/removed | — | — | — | — | examples.md nav list |
| Installation/package change | — | — | — | ✓ | getting-started.md |
</change_to_document_matrix>
