# Le Truc — Requirements

> This document is the north star for Le Truc's design and development. It captures the problem, the users, the constraints, and the success criteria from which all architectural decisions should be derived. It is not a changelog or a roadmap — it describes _what_ and _why_, not _when_.

**Scope note (2026-09-04).** v3.0 is a two-track release. Track 1 is the committed library contract ([M1](#m1-component-definition-via-a-single-function)–[M16](#m16-security-validation-in-setattribute), shipped through 2.x). Track 2 is the isomorphic authoring and build-time server-evaluation program defined by [ADRs 0024–0035](adr/0024-adopt-tsrx-as-isomorphic-component-format.md), together with the amendments those ADRs carry in place — most recently ADR 0034's distribution and template-emission decisions and ADR 0035's simulation seam (2026-09-19). **Where a shipped 2.x contract and an unpublished v3 decision conflict, the shipped contract wins**: the build-time tooling adapts to the library, never the reverse. ADR 0025 (client-side playground) remains Proposed and is in scope only if accepted.

---

## 1. Problem Statement

### The situation

Digital agencies building content-rich websites for clients face a recurring problem: interactive frontend components are implemented with imperative JavaScript that tightly couples state mutations to DOM updates. As a project grows, any component that needs to change must know which other components depend on it and trigger their updates explicitly. Mutable state is modified in many places, often inconsistently, and async processes introduce subtle timing bugs that are hard to reproduce and expensive to fix.

The natural response — adopting a JavaScript SPA framework — solves the coupling and reactivity problems but introduces new ones:

- **Client-side rendering** (React, Vue, Svelte) means JavaScript must generate the initial HTML. For content-rich sites this hurts performance, requires hydration, and duplicates rendering logic that the backend already handles.
- **Fullstack JS frameworks** (Next.js, Nuxt, SvelteKit) solve the SSR problem but require a JavaScript layer on the backend. Most agency clients run existing CMS solutions (Java, PHP, Python, C#) that cannot and should not be replaced by a Node.js server.
- **Double data / double templates**: Any SSR-capable JS framework must ship component templates to the client _and_ render them on the server, and often serialize state as JSON to hydrate from. This is wasteful and creates synchronization complexity.
- **HTML-first libraries** (HTMX, Alpine.js) work with server-rendered markup but lack strong component boundaries and type guarantees, reproducing the same long-term maintenance problems in a different form.
- **Lit** offers web components with reactivity but is committed to client-side rendering. It re-renders component subtrees rather than applying pinpoint DOM updates.

### The core insight

Rendering HTML is a solved problem on the backend. What's missing is a _thin reactive layer in the browser_ that:

1. Accepts server-rendered HTML as the initial view
2. Defines component boundaries using the native Custom Elements API
3. Wires reactive state to fine-grained DOM updates — never re-rendering whole subtrees
4. Provides the type safety and clear data flow of a modern framework without requiring JavaScript on the server

This is SolidJS-style fine-grained reactivity, without client-side rendering, packaged as framework-agnostic Web Components.

### The v3 problem: one component, three files

The library contract above held, and a second problem grew under it. A Le Truc component is authored as three hand-maintained files — `.ts` (behavior), `.html` (markup), `.css` (styles) — whose mutual contract is checked only at runtime. A selector that no longer matches, a root tag that drifted, a style block that lost its scoping prefix: each surfaces as a `MissingElementError` or a silently unstyled page in the browser, not as a build failure. `first()` failures are the symptom; drift is the disease.

Alongside it sits a question hand authoring cannot answer systematically: **what does a reactive initial value render before JavaScript loads?** A `{signal}` text child or a `checked={() => …}` thunk has a value only once the component connects. Serving blank is honest but degrades the no-JS experience; baking in a guess ships wrong HTML. Server evaluation needs to be a designed mechanism, not a per-component judgment call.

### The v3 goal: a general-purpose framework, not repo tooling

This repository is the playground, not the product. The v3 compiler was built here against this corpus, but the goal is a general-purpose framework used across many projects by consumers of the open-source library. Two consequences follow, and both are load-bearing rather than aspirational ([ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md)).

**The compiler's output must reach non-JS backends.** The compiler emits a TypeScript server module that only a JS build can execute, so today the Folded and Simulated tiers have exactly one consumer runtime — this repo's SSG docs site. The CMS backends named above cannot run it, and the mismatch is not only language but *time*: folding happens at build time, CMS markup is produced at request time. v3.0 closes this with **template emission** ([M27](#m27-backend-neutral-template-emission)): the compiler resolves everything prop-independent and emits a partial whose holes are the component's server args, in the backend's own template language.

**Adoption is staged over three pioneer projects**, in order: a Zeix SSG project migrated from Le Truc 2.x; a Zeix Craft CMS (PHP) project; a client AEM (Java) project. Outside adoption is expected only after these three. They are the criteria's evidence base — the thesis that the compiler pays for itself is confirmed by a real project outside this repo, or not at all.

### Business impact

Without Le Truc (or an equivalent), frontend teams often face:

- High refactoring costs as project complexity grows
- Difficulty reusing components across client projects with heterogeneous backends
- Inconsistent patterns between projects, requiring each team to re-establish best practices
- Subtle bugs from imperative state management and async timing
- _(v3)_ Per-component drift between markup, behavior, and styles — the class of bug that only appears in the browser, and only after the file that caused it was edited

### Success criteria

For projects using Le Truc:

- Developer teams subjectively report increased confidence when refactoring and faster change cycles when working on Le Truc-based codebases, compared to prior approaches
- Components built for one project are reusable in other projects without modification or with only minor configuration
- No runtime exceptions attributable to state synchronization or async timing bugs in production deployments

For the library itself:

- Very few bug reports surface after 1.0 release; none of them requiring a major refactoring
- Le Truc proves it can scale well in complex web applications with 1000+ frequently updated elements
- Performance in benchmarks (js-reactivity-benchmark for Cause & Effect, js-framework-benchmark for Le Truc) is among the 5 best-in-class
- Bundle size for a minimal consumer (`defineComponent`, no extensions) remains below 9 kB gzipped; core + `formAssociated()` warns above 10 kB. Opt-in extensions (`formAssociated()`, `observedAttributes()`, ...) are tree-shaken away when unused — see the `ComponentExtension` mechanism

For the v3 authoring program (ADRs 0024–0030, 0032–0035) — repo-internal:

- The example corpus is 100% compiled — every component authored in the isomorphic single-file format, `.tsx` by default with `.tsrx` retained ([ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md)) — no hand-written component twins remain outside test and docs helpers, and every markup/selector/style contract error that used to surface as a runtime `MissingElementError` is a build failure
- The compile-warning baseline holds at zero, with the tier census and translation census reported separately and growing only when the build genuinely learns something new
- The CI equivalence audit (Folded-tier components rendered byte-identically by both evaluation mechanisms) is green
- A second locale ships end to end: per-locale pages, the reserved `i18n` parameter, and a visible translation census
- The shipped 2.x contract (M1–M16) is unchanged through v3 except the two removals scheduled by ADR 0012/0018 ([M26](#m26-v3-api-cleanup--removal-of-the-deprecated-surfaces))

For v3.0 as a released framework — these are the criteria that can fail ([ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md) s6):

- **Pioneer 1 is live**: a Zeix SSG project, migrated from Le Truc 2.x, compiling through the published `@zeix/le-truc-compiler` and in production as the release showcase. Verified through a series of pre-releases, not at the release itself
- **A measured drift-cost data point** from that migration — before/after on the same components, with the 2.x baseline captured *before* the codemod runs. Without the number the drift-cost thesis stays an assertion
- **Pioneer 2 verifies template emission**: a Zeix Craft (PHP) project consuming compiler-emitted Twig partials, with real content in the initial HTML and no JavaScript required to see it ([M27](#m27-backend-neutral-template-emission))
- **The published package installs and builds without the optional simulation substrate**, routing the affected components Static with a recorded census reason rather than failing ([M28](#m28-distribution-and-dependency-weight))

---

## 2. User Personas

### Primary: Agency frontend developer

- **Role**: Frontend developer at a digital agency
- **Technical level**: Comfortable with TypeScript; values precise type inference and compile-time error detection; familiar with modern build tooling (Vite, Bun); experienced with HTML and CSS; may have prior exposure to one JS framework
- **Environment**: Multi-project context with heterogeneous backends (Java, PHP, Python, C# CMS platforms); uses npm packages and bundles with Vite or Bun; deploys to CDN or static hosting
- **Goals**: Build interactive UI components that are reusable across projects; avoid per-project reinvention of patterns; be able to refactor with confidence; ship accessible, performant frontends
- **Pain points solved**: No more tight coupling between components; state changes propagate automatically; TypeScript catches integration errors at compile time; components are portable because they are backend-agnostic
- **(v3)** Authors components in the isomorphic single-file format — one file per component, `.tsx` by default with `.tsrx` retained where statement-context control flow reads better ([ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md)) — and debugs generated client factories with the `DEV_MODE` tooling ([ADR 0022](adr/0022-debug-extension-for-visual-and-console-instrumentation.md)) and tiered error surfacing ([ADR 0028](adr/0028-tiered-error-surfacing.md))

### Secondary: Design system / component library author

- **Role**: Developer building a reusable component system intended for consumption across multiple projects or teams
- **Technical level**: Advanced TypeScript; interested in API ergonomics and extensibility; understands custom elements lifecycle; may publish to npm
- **Environment**: Library build pipeline; consumers may use any framework or no framework
- **Goals**: Define behavioral contracts for components with type guarantees; ensure components work in any host environment; keep the behavioral layer separate from visual styling
- **Pain points solved**: Web Components as the distribution format means no framework lock-in; Le Truc's functional composition model supports building reusable effect and parser primitives on top of the library

---

## 3. Functional Requirements

### Must Have — library contract

#### M1. Component definition via a single function

`defineComponent(name, factory, extensions?)` is the sole entry point for defining a component. It registers a native Custom Element with no additional boilerplate. The factory receives a `FactoryContext` with element queries, `expose()` for declaring reactive properties, and helpers for creating effects.

#### M2. Reactive properties backed by signals

Component properties are signals. Reading a property inside an effect automatically tracks it as a dependency. Writing a property triggers all dependent effects. Properties must behave like normal JS object properties from the outside (`host.count++` works).

#### M3. Attribute → property initialisation via parsers

Properties declared with a `Parser` function read the corresponding HTML attribute once at connect time and transform the string value into a typed JS value. By default, `observedAttributes` is empty and `attributeChangedCallback` is never used — attributes are for server-side-authored initial configuration, not reactive state. Post-connect state changes go through event handlers, `watch()`, or direct property writes. See [X1](#x1-observedattributes--attributechangedcallback-for-reactive-state) for the opt-in escape hatch and its rationale.

#### M4. Type-safe DOM queries

`first(selector)` and `all(selector)` must infer the correct `HTMLElement` subtype from the CSS selector string at compile time. Requiredness is declared with a second literal: `first('input', 'a native button as descendant')` is required and throws a typed `MissingElementError` carrying that reason if missing; `first('.maybe')` is optional and resolves `undefined` without throwing. See [ADR 0021](adr/0021-root-parameterized-query-and-queryall.md) for the root-parameterized `query`/`queryAll` siblings.

#### M5. Fine-grained DOM effects

Effects are applied per-element, not per-component. Updates are targeted to the exact DOM node that needs changing. The `watch(source, handler)` helper drives any DOM update from an explicit reactive source. The following built-in DOM binding helpers are required: `bindText`, `bindAttribute`, `bindClass`, `bindProperty`, `bindState`, `bindStyle`, `bindVisible`, `bindAria` (shipped 2.6, [ADR 0026](adr/0026-aria-reflection-via-elementinternals-and-bindaria.md)), `dangerouslyBindInnerHTML`. Event handling and inter-component binding are covered by `on()` and `pass()` respectively.

#### M6. Automatic dependency tracking

Effects must automatically re-run when their reactive dependencies change, with no manual subscription management. Effects must clean up after themselves when the component disconnects.

#### M7. Dynamic element collections via `all()`

`all()` must return a live `Memo<Element[]>` backed by a `MutationObserver`. When elements are added or removed from the DOM, the memo updates and dependent effects re-run. Spurious invalidations from mutations _inside_ matched elements must be filtered out.

#### M8. Dependency resolution for nested custom elements

If a component queries child custom elements that are not yet defined, initialization must wait for their definition before running effects. Timeout must be graceful: log the error and proceed rather than blocking indefinitely.

#### M9. ~~Event-driven sensors~~ — removed in v2.0

`createEventsSensor` was removed: its implicit event delegation (events from child elements also triggered it) and lazy listener setup caused real bugs and didn't match developers' mental model of a plain event listener. The equivalent pattern — `createState` + `on()`, exposing only the getter for write-protection — is a few lines more but explicit about timing and dependencies. `createSensor` (re-exported from Cause & Effect) remains available for the cases that genuinely need a setup-owned lazy value. See the [removal writeup](docs-src/pages/blog/2026-04-12-removing-createeventssensor.md).

#### M10. Context protocol

`provideContexts` and `requestContext` must implement the Web Components Community Protocol for Context, enabling ancestor-to-descendant reactive value sharing without prop drilling or direct component coupling.

#### M11. Signal injection between components via `pass()`

A parent component must be able to inject its own reactive signal directly into a child component's property slot, creating a live reactive binding. The child must have no knowledge of the parent. Writes are mediated: read-only by thunk, parent-intercepted by `{ get, set }` descriptor ([ADR 0012](adr/0012-deprecate-unrestricted-write-short-forms-in-pass.md)).

#### M12. Async task signals

`createTask` must support async operations with: automatic re-run when reactive dependencies change, cancellation of in-flight requests (AbortSignal), pending/ok/error state tracking, and initial value before resolution.

#### M13. TypeScript types exported and accurate

All public API must be fully typed. Type inference must work without explicit type annotations in the common case. Errors from incorrect usage (wrong property name, type mismatch) must surface at compile time, not runtime.

#### M14. Tree-shakeable exports

Unused effects, parsers, and utilities must be eliminable by a bundler. No side effects at module load time except `customElements.define()` triggered by `defineComponent`.

#### M15. No-build CDN usage supported

The library must be consumable via a `<script type="module">` tag from a CDN without a build step, for teams not using a bundler.

#### M16. Security validation in `setAttribute`

`setAttribute` must block `on*` event handler attributes and reject URLs with unsafe protocols (`javascript:`, `data:`, etc.) to prevent XSS via attribute injection.

### Must Have — v3: isomorphic authoring and build-time server evaluation

#### M17. Single-file isomorphic authoring format

A component is authored once, as a single isomorphic source file containing server args, signals, `expose()` calls, markup, event handlers, and scoped styles ([ADR 0024](adr/0024-adopt-tsrx-as-isomorphic-component-format.md)): **`.tsx` is the default authored surface; `.tsrx` remains a supported surface** where its statement-context control flow (`@if`/`@for`/`@try`) is the better ergonomics ([ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md)). Both surfaces are first-class inputs to one machinery layer and compile to the same artifacts — the idiomatic `defineComponent()` client module, the server render module, and verbatim tag-scoped CSS. The hand-written trio is not a coexisting format — the isomorphic format is the only authoring format, and authored sources stay honest TypeScript by construction (real exports imported explicitly, FactoryContext vocabulary ambient).

#### M18. Compile-time contract checking

The compiler checks the template contract at build time: root-tag match, selector uniqueness and required-reference resolution against the owned template, extension config validation against the known bundled extensions, and import placement. Every runtime check that is statically decidable has a compiler rule ([ADR 0028](adr/0028-tiered-error-surfacing.md)) — a drifted selector is a build failure, never a browser surprise.

#### M19. Tiered server evaluation

Every component's reactive initial values are resolved server-side by the cheapest mechanism that can actually answer them, decided statically at compile time ([ADR 0029](adr/0029-tiered-server-evaluation.md)): the **Folded** tier (DOM-less value harness), the **Simulated** tier (Server Simulation, [M20](#m20-server-simulation-realm)), and the **Static** tier (skeleton only; the client corrects). Unresolvability is a per-expression property — an expression no phase can answer (layout geometry, stubbed internals surfaces, wall clock, RNG, runtime-default locale) is omitted in every tier, and the client supplies it at connect. No serialized state payload ever ships; the served HTML is corrected, never hydrated.

#### M20. Server Simulation realm

The Simulated tier renders initial HTML by executing the generated client module against a jsdom realm ([ADR 0027](adr/0027-server-simulation.md)): hermetic IO (a fetching component never settles), a fixed-point gate proving enhancement is idempotent over its own output, and per-component containment so one throwing component never fails the build. The realm's `ElementInternals` posture is capability-scoped ([ADR 0026](adr/0026-aria-reflection-via-elementinternals-and-bindaria.md) §2, amended 2026-09-04): ARIA reflection falls back to content attributes so the served HTML carries `role`/`aria-*` initial values; form association degrades globally where the substrate cannot support it, because an incomplete stub is worse than none.

The tier is an **SSG capability** ([ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s2): a simulated component's output is computed by executing code against concrete arguments and concrete parsed markup, so it cannot be expressed as a template with holes and never travels through [M27](#m27-backend-neutral-template-emission). CMS consumers receive a Static partial for such components. The realm's second consumer is the CI equivalence audit ([ADR 0029](adr/0029-tiered-server-evaluation.md) s7), which renders every **Folded**-tier component through it and is that tier's only hydration-boundary check. The realm is reached through a **DOM-free, package-shaped seam** — no substrate type crosses it, classification and the build report are substrate-free — which is what makes [M28](#m28-distribution-and-dependency-weight)'s opt-out implementable and a later `@zeix/le-truc-simulation` split non-breaking (s3–s4). Any future substrate must first pass the sanitizer criterion: a consumer's `sanitize` hook must behave inside it as it does in a browser (s6).

#### M21. Composition and interop

Compiled components compose: PascalCase invocation with typed server args at the boundary, `class`/`id` discriminators that reach the served DOM, a reserved `children` parameter for content insertion, and `truc:pass={{ … }}` as the sole channel for client-side signal interop with a custom-element target ([ADR 0024](adr/0024-adopt-tsrx-as-isomorphic-component-format.md) s10). A composed child declares its pass surface on its own args type (`'truc:pass'?: { … }`), so a parent's pass checks against the child's real shape ([ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md) s3). Reaching into a sub-component's owned markup is a compile-checked ownership violation — composition goes through the child's declared public interface (`server/compiler/HOST_PROFILE.md`, the data account).

#### M22. Tiered error surfacing

Failures route to the cheapest channel that can carry them ([ADR 0028](adr/0028-tiered-error-surfacing.md)): compile-time diagnostics for everything statically decidable (**Prevented**); unconditional containment inside `connectedCallback` with one attributed `console.error` per failure (**Contained**), degrading to the already-correct server markup; and escape reserved for definition-time failures and security-boundary violations (**Escalated**). Degradation is DOM-is-truth — there is no fallback UI to author.

#### M23. Census reporting, zero-warning baseline

The compile-warning channel stays author-fixable-only, with a zero target. Findings that are not author-fixable — the tier census ([ADR 0029](adr/0029-tiered-server-evaluation.md) s6) and the translation census ([ADR 0030](adr/0030-internationalization-as-build-time-server-data.md) s5) — are build-report records, not warnings, and carry their own regression signals.

#### M24. Build-time internationalization

Locale and translations are build-time server data ([ADR 0030](adr/0030-internationalization-as-build-time-server-data.md)): a reserved compiler-supplied `i18n` parameter (`lang`, `t`, `timeZone`, `currency`, `dir`); an authored `lang` arg overriding the record; explicit keys with source strings declared inline in the authored source, either surface; additive per-locale catalog files with no override stack; a missing key falling back to the source locale and recorded in the translation census.

**Message values are ICU MessageFormat 1 patterns**, parsed at build time — so interpolation, plurals, `select` and inline number/date/currency formatting are expressible in the format translation tooling already speaks, and argument mismatches are compile-time diagnostics. A message whose arguments are all server-known folds into the markup and ships no catalog; only a message with client-reactive arguments reaches the browser, as a parsed pattern on the component's own root plus a compiler-inlined evaluator — never the catalog, never a third-party runtime.

**Locale is a parameter of the render boundary.** One SSG page per locale, with the locale fixed before rendering begins, is the docs-site path and what the build implements; rendering per request at a per-user locale — the §1 CMS targets' model — is the same render function called with a different `lang`, and must not be foreclosed.

#### M25. Tooling continuity

Custom Elements Manifest generation continues through the migration (analyzer + plugin now; compiler-emitted fragments once the last hand-written component is gone) ([ADR 0024](adr/0024-adopt-tsrx-as-isomorphic-component-format.md) s9, [ADR 0013](adr/0013-cem-plugin-for-le-truc-factory-pattern.md)). The compiler is browser-pure (CI smoke test) so it can run in a browser bundle. Type flow is emit-then-check over the compiler's span table — remapping `tsc` diagnostics to source positions — for generated modules and `.tsrx` sources; authored `.tsx` sources are type-checked directly, with no remapping step ([ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md) s3).

#### M26. v3 API cleanup — removal of the deprecated surfaces

The two removals scheduled by ADR and declared in ROADMAP land in v3.0, before the corpus migration completes: the `pass()` unrestricted-write short forms ([ADR 0012](adr/0012-deprecate-unrestricted-write-short-forms-in-pass.md)) are removed, leaving the thunk (read-only) and `{ get, set }` descriptor (mediated) forms; and the explicit factory return contract ([ADR 0018](adr/0018-implicit-effect-collection-via-ambient-context.md)) is removed — helpers register effects implicitly and return `void`, `FactoryResult`/`EffectDescriptor` leave the public return contract, and `watch(() => true, descriptor)` is the only registration path for a hand-authored descriptor.

#### M27. Backend-neutral template emission

The compiler emits, alongside the client module and the CSS, a **partial with holes** for consumption by a non-JS backend ([ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md) s3): every prop-independent expression folded, every server arg emitted as a variable in a target template language. **Twig is the v3.0 target**; HTL (AEM) follows. Each target owns an explicit escaping contract — the emitter places the target language's escaping at every hole, and a hole in a position the target cannot escape safely is a compile-time diagnostic ([M22](#m22-tiered-error-surfacing), Prevented), never a silently unsafe emit.

This obliges a standing invariant on every design from here forward, emitter or not: **a component's folded output may depend only on its own props and a closed, enumerable set of page-ambient values** — today the reserved `i18n` parameter's `lang`, `t`, `timeZone`, `currency`, `dir` ([M24](#m24-build-time-internationalization)). A design that lets the fold read arbitrary page context forecloses template emission and the CMS persona with it.

#### M28. Distribution and dependency weight

The compiler ships as **`@zeix/le-truc-compiler`**, separate from the browser-only `@zeix/le-truc` client layer ([ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md) s1). v3.0 publishes the **`.tsx` front end only**; `.tsrx` remains a first-class repo-internal surface under the ADR 0032 parity contract and publishes in a later 3.x, gated on `@tsrx/core` reaching 1.0 (s2).

A published compiler's dependencies are a consumer-visible cost, so every build dependency carries a stated justification and, where it serves an opt-in capability, an opt-out. jsdom is an **optional peer dependency**: present, the Simulated tier is available; absent, components that would route Simulated route Static and record an `unavailable substrate` reason in the tier census — a census row, not a warning ([M23](#m23-census-reporting-zero-warning-baseline)), and never a failed build (s5).

That opt-out has a **prerequisite**, and it ships before the policy does ([ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s3, s5): the compiler must classify components, print the tier census, and typecheck with no substrate present. Today it can do none of the three — the classifier reads the simulation's patch table, the build report lives inside `sim/`, and the published realm type names jsdom. The seam that cuts those couplings is specified as a **versioned package boundary**, so the substrate may later split into `@zeix/le-truc-simulation` — activation by installation rather than configuration — without a breaking change. That split is not a v3.0 deliverable (s4).

### Should Have

#### S1. Parser/Method distinction via explicit API

✅ _Resolved._ `Parser<T>` is branded via `asParser()`, detected by `isParser()` on `PARSER_BRAND` only. `MethodProducer` is branded via `defineMethod()`, detected by `isMethodProducer()` on `METHOD_BRAND` only. Both reject implicit/duck-typed detection.

#### S2. Required element error messages are actionable

✅ _Resolved._ `MissingElementError` identifies the component, the failed selector, and the developer-provided hint string.

#### S3. Development mode with enhanced diagnostics

✅ _Resolved._ When `DEV_MODE` is enabled, the library surfaces problems that are otherwise silent in production: dependency-resolution timeout warnings and extension/deprecation warnings, plus effect execution logging and per-instance visual debugging via `debug()` (see [N1](#n1-debug-flag-per-component-instance)). Actionable error messages (naming the component and selector) are not gated behind `DEV_MODE` — they're always on. See [ADR 0022](adr/0022-debug-extension-for-visual-and-console-instrumentation.md).

#### S4. Scheduler deduplication for innerHTML mutations

✅ _Resolved._ `dangerouslyBindInnerHTML` updates are deferred and deduplicated per element via `requestAnimationFrame`. Passive event handlers are separately throttled at the signal-graph input level via `throttle()`.

#### S5. Typed, throwing, root-parameterized element lookup (`query`/`queryAll`)

✅ _Resolved._ `query(root, selector, required?)` and `queryAll(root, selector, required?)` extend M4's guarantees (selector-to-type inference, throwing `MissingElementError`) to lookups relative to an arbitrary element, not just the host. `each()` and `reconcile()`'s `bindItem` callback also gained a scoped `first` parameter for the same purpose. `first()`/`all()` are now implemented in terms of `query()`/`queryAll()`, unchanged in behavior. See [ADR 0021](adr/0021-root-parameterized-query-and-queryall.md).

### Should Avoid

#### X1. `observedAttributes` / `attributeChangedCallback` for reactive state

Do not use `observedAttributes` to drive reactive property updates by default. Attribute observation couples component state to HTML attribute mutations, a weaker and more error-prone model than signal-backed properties. Properties are the default, encouraged reactive interface; attributes are for initial server-authored configuration only.

✅ _Resolved._ `observedAttributes()` is an opt-in `ComponentExtension` that re-parses a Parser-backed prop when its attribute mutates post-connect, without changing the default. See [ADR 0019](adr/0019-extension-based-dependency-injection-for-definecomponent.md).

### Nice to Have

#### N1. Debug flag per component instance

✅ _Resolved._ `host.debug = true` (auto-injected by `defineComponent()` in `DEV_MODE`, no source change required) scopes enhanced diagnostics — `on()`/`pass()`/`watch()` element highlighting via presence-only marking attributes, a pulsing `:state(debug)` host indicator, and `console.debug` logging — to a single component instance instead of every instance in the app. Not a substitute for `DEV_MODE` — like the rest of S3, it only does anything when `DEV_MODE` is also on, and neither ships in production. See [ADR 0022](adr/0022-debug-extension-for-visual-and-console-instrumentation.md).

#### N2. Compile-time selector type inference for SVG and MathML

✅ _Resolved._ `KnownTag` in `src/helpers/dom.ts` covers `SVGElementTagNameMap` and `MathMLElementTagNameMap`. Extend the CSS selector type parser to cover `SVGElementTagNameMap` and `MathMLElementTagNameMap` in addition to `HTMLElementTagNameMap`.

#### N3. Client-side TSRX playground

_Conditional._ A docs-site playground compiling components entirely in the visitor's browser ([ADR 0025](adr/0025-client-side-tsrx-playground.md) — **Proposed**, not accepted). In scope only if the ADR is accepted; it rides M25's browser-purity invariant, but commits nothing until decided.

---

## 4. Non-Functional Requirements

### Performance

- Bundle size, gzipped: minimal entry (`defineComponent`, no extensions) ≤9 kB (hard ceiling, `test/regression-bundle.test.ts`); core + `formAssociated()` warns above 10 kB; the full barrel (every export, including every bundled extension) is reported but not asserted — it is not a realistic consumer surface once extensions are opt-in
- DOM updates must be synchronous and targeted: no virtual DOM diffing, no full component re-renders
- Signal propagation must be glitch-free: no intermediate states visible to effects when multiple signals update in a single batch
- High-frequency event handlers (scroll, resize, touch) must be frame-rate-limited via the scheduler
- _(v3)_ Build-time server evaluation adds seconds, not minutes, to a full SSG pass at corpus scale (~1.1 ms per Simulated-tier occurrence measured); the tier classifier keeps the cost bounded as the corpus grows, and the tier census makes any drift visible

### Accessibility

- Le Truc does not enforce accessibility compliance, but must not make it harder to achieve
- Built-in effects must preserve existing accessibility attributes unless explicitly overridden
- Example components must demonstrate correct ARIA patterns (roles, states, properties) as the reference implementation for component authors
- `MissingElementError` hints must reference accessibility implications where relevant
- _(v3)_ ARIA on a compiled component's host defaults to the internals channel with the content attribute as the consumer-facing override channel ([ADR 0026](adr/0026-aria-reflection-via-elementinternals-and-bindaria.md)); in environments without a reflection surface the content attribute is the served channel, so the no-JS accessibility tree is never blank by mechanism

### Browser support

- Target: all evergreen browsers (Chrome, Firefox, Safari, Edge) as of Web Platform 2020 baseline
- Required APIs: Custom Elements v1, `MutationObserver`, `requestAnimationFrame`, `AbortSignal`, CSS selector matching, `customElements.whenDefined()`
- Explicitly not supported: IE11 or any non-evergreen browser
- Declarative Shadow DOM: supported but not required by the library itself; component authors may use it
- No polyfills are included or required

### Type safety

- TypeScript strict mode compatible
- No `any` in the public API surface
- Selector type inference must work in editors (VSCode, WebStorm) without additional plugins
- _(v3)_ Authored sources are valid TypeScript by construction — `.tsx` sources type-check directly against the ambient host profile; generated client and server modules are checked by `tsc` in CI with diagnostics remapped to source positions through the span table (generated modules and `.tsrx` sources)

### Reliability

- Components must clean up all effects and event listeners on disconnect — no memory leaks from connected/disconnected cycles
- Dependency resolution timeout must not block page load; it must degrade gracefully
- `createTask` cancellation must prevent stale async results from updating the DOM after component disconnect
- _(v3)_ Enhancement must be idempotent over its own output — the simulation realm's fixed-point gate proves it at build time ([ADR 0027](adr/0027-server-simulation.md) s8)
- _(v3)_ Server evaluation never depends on the network or the build machine's ambient state: the realm's IO is closed, impure-ambient reads are omitted in every tier, and `Intl` folds only over server-known locale/timeZone ([ADR 0029](adr/0029-tiered-server-evaluation.md), [ADR 0030](adr/0030-internationalization-as-build-time-server-data.md))
- _(v3)_ The build never writes tracked source files; reports are gitignored artifacts

---

## 5. Technical Constraints

### Required

- **Runtime**: `@zeix/cause-effect` is the sole reactive primitive layer. Le Truc depends on specific signal types not available in other libraries: `Slot` (swappable backing signal), lazy `Memo` with `watched` callback, `Sensor` (event-stream-derived signal), `Task` (colorless async), and `Scope` (owned effect lifecycle). The dependency is tight and intentional; the prior claim that the reactive engine could be swapped is no longer accurate.
- **Language**: TypeScript. The library is authored in TypeScript and published with full type declarations.
- **Module format**: ESM only. CommonJS is not a target.
- **Build tooling**: Bun (primary), Vite compatible. Tests run via Playwright against real browsers.
- **(v3) Compiler**: the component compiler is built in-repo with two front ends behind one shared machinery layer ([ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md)): `.tsx` parsed by the repo's `typescript` dependency, `.tsrx` on a pinned `@tsrx/core` — both parser upgrades are reviewed changes. It is build-time tooling only; jsdom is a build-time-only dependency. From v3.0 it ships as a separate package, **`@zeix/le-truc-compiler`**, publishing the `.tsx` front end only — `.tsrx` stays repo-internal until `@tsrx/core` reaches 1.0 ([ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md) s1–s2). `@zeix/le-truc` remains the backend-agnostic client layer. jsdom is an **optional peer dependency** of the compiler package ([M28](#m28-distribution-and-dependency-weight)), reached through a DOM-free seam so the compiler classifies, reports and typechecks without it ([ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s3).

### Prohibited

- No client-side rendering or templating. Le Truc must never generate initial HTML at runtime.
- No server-side rendering layer **in the library**. `@zeix/le-truc` is browser-only and never renders; server evaluation lives in the build-time compiler and simulation realm, which never ship to clients ([ADR 0024](adr/0024-adopt-tsrx-as-isomorphic-component-format.md) s7).
- No styled components or design system primitives. Le Truc provides behavioral guarantees only; visual styling is the consumer's responsibility.
- No polyfills bundled or required.
- No framework-specific integrations (React wrappers, Vue plugins, etc.) in the core library.

### Integration points

- Consumed as an npm package (`@zeix/le-truc`) via any bundler (Vite, Bun, Webpack, Rollup)
- Consumable via CDN as an ES module (no-build path)
- Must coexist with any backend rendering technology without coupling or shared protocol — server evaluation is SSG producing plain files, invisible to the client's backend

---

## 6. Assumptions & Dependencies

### Assumptions

- The browser renders the initial HTML from the server before any JavaScript executes. Le Truc components progressively enhance this markup — they do not generate it.
- Developers using Le Truc are comfortable with TypeScript and use a bundler in most projects.
- Custom Elements v1 and associated Web Platform APIs are available in all target environments without polyfills.
- Sibling-to-sibling component communication is a design smell. Components should coordinate only through their hierarchy (parent→child via `pass()`, ancestor→descendant via context) or through application-level state. Tight sibling coupling is explicitly not a supported pattern.
- The initial server-rendered HTML is the correct initial UI state. Le Truc does not need to "reconcile" its state with the server — the HTML _is_ the truth at load time.
- _(v3)_ A page's locale is a build-time constant per rendered page (ADR 0030 s1); request-time locale negotiation would forfeit the Folded tier and is out of scope.
- _(v3)_ The client environment is not guaranteed to support `ElementInternals` usable surfaces (old Safari, simulation realm); every internals-channel feature must degrade without changing what the component does once connected ([ADR 0026](adr/0026-aria-reflection-via-elementinternals-and-bindaria.md) §2, amended).

### Dependencies

- `@zeix/cause-effect` ^1.0.0 — reactive primitive layer. Le Truc and Cause & Effect are co-developed at Zeix AG and released 1.0 together.
- Playwright — browser-based integration tests
- Bun — build tooling and test runner script
- _(v3)_ `@tsrx/core` (pinned) — `.tsrx` front-end parser; `typescript` — `.tsx` front-end parser ([ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md)); jsdom (build-time only, **optional peer dependency** of the published compiler — [ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md) s5, implementable once [ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s3's seam lands; candidate for a later `@zeix/le-truc-simulation` split, s4) — simulation substrate; a replacement substrate must pass the sanitizer criterion ([ADR 0027](adr/0027-server-simulation.md) s2, amended)

---

## 7. Out of Scope

- **Client-side rendering or templating**: Le Truc will never generate initial HTML at runtime. Component authors who need client-side rendering should use a different tool or implement it themselves with template literals or `<template>` cloning.
- **Per-request server-side rendering**: initial HTML is produced at build time (SSG). A per-request runtime is anticipated but deliberately undesigned ([ADR 0029](adr/0029-tiered-server-evaluation.md) s8); the Folded and Static tiers are already per-request-cheap if it is ever wanted. A request-time JS sidecar would serve the CMS personas and would contradict the founding constraint — no JavaScript layer on the backend — so it is out of scope for all of 3.x and reconsidered no earlier than 4.0; [ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md) s3–s4 is what keeps it reachable without an authoring break. What does travel off SSG in 3.0 is emitted templates, not a runtime ([M27](#m27-backend-neutral-template-emission)). The build-time compiler itself ships as a separate package with v3.0 (`@zeix/le-truc-compiler`) — it is not part of the `@zeix/le-truc` package.
- **Internationalization runtime**: the library ships no message catalog, no translation function, and no locale resolution. Locale and translations are build-time server data handled by the compiler ([ADR 0030](adr/0030-internationalization-as-build-time-server-data.md)); at runtime a component uses the platform's own `Intl` and the `lang` the server rendered into the DOM.
- **Styled components / design system**: Visual styling is entirely the consumer's responsibility. Le Truc provides behavioral primitives only.
- **Framework adapters**: No React wrappers, Vue plugins, Angular modules, or similar.
- **Sibling-to-sibling state sharing**: Not a supported coordination pattern.
- **Accessibility enforcement**: Le Truc cannot enforce WCAG compliance. It provides patterns and primitives; correctness is the component author's responsibility.
- **Polyfills**: No legacy browser support (IE11 or non-evergreen browsers).
- **Full styled component library**: Planned as a separate project built on top of Le Truc.
