# Le Truc — Requirements

> This document is the north star for Le Truc's design and development. It captures the problem, the users, the constraints, and the success criteria from which all architectural decisions should be derived. It is not a changelog or a roadmap — it describes *what* and *why*, not *when*.

---

## 1. Problem Statement

### The situation

Digital agencies building content-rich websites for clients face a recurring problem: interactive frontend components are implemented with imperative JavaScript that tightly couples state mutations to DOM updates. As a project grows, any component that needs to change must know which other components depend on it and trigger their updates explicitly. Mutable state is modified in many places, often inconsistently, and async processes introduce subtle timing bugs that are hard to reproduce and expensive to fix.

The natural response — adopting a JavaScript SPA framework — solves the coupling and reactivity problems but introduces new ones:

- **Client-side rendering** (React, Vue, Svelte) means JavaScript must generate the initial HTML. For content-rich sites this hurts performance, requires hydration, and duplicates rendering logic that the backend already handles.
- **Fullstack JS frameworks** (Next.js, Nuxt, SvelteKit) solve the SSR problem but require a JavaScript layer on the backend. Most agency clients run existing CMS solutions (Java, PHP, Python, C#) that cannot and should not be replaced by a Node.js server.
- **Double data / double templates**: Any SSR-capable JS framework must ship component templates to the client *and* render them on the server, and often serialize state as JSON to hydrate from. This is wasteful and creates synchronization complexity.
- **HTML-first libraries** (HTMX, Alpine.js) work with server-rendered markup but lack strong component boundaries and type guarantees, reproducing the same long-term maintenance problems in a different form.
- **Lit** offers web components with reactivity but is committed to client-side rendering. It re-renders component subtrees rather than applying pinpoint DOM updates.

### The core insight

Rendering HTML is a solved problem on the backend. What's missing is a *thin reactive layer in the browser* that:

1. Accepts server-rendered HTML as the initial view
2. Defines component boundaries using the native Custom Elements API
3. Wires reactive state to fine-grained DOM updates — never re-rendering whole subtrees
4. Provides the type safety and clear data flow of a modern framework without requiring JavaScript on the server

This is SolidJS-style fine-grained reactivity, without client-side rendering, packaged as framework-agnostic Web Components.

### Business impact

Without Le Truc (or an equivalent), frontend teams often face:

- High refactoring costs as project complexity grows
- Difficulty reusing components across client projects with heterogeneous backends
- Inconsistent patterns between projects, requiring each team to re-establish best practices
- Subtle bugs from imperative state management and async timing

### Success criteria

For projects using Le Truc:

- Developer teams subjectively report increased confidence when refactoring and faster change cycles when working on Le Truc-based codebases, compared to prior approaches
- Components built for one project are reusable in other projects without modification or with only minor configuration
- No runtime exceptions attributable to state synchronization or async timing bugs in production deployments

For the library itself:

- Very few bug reports surface after 1.0 release; none of them requiring a major refactoring
- Le Truc proves it can scale well in complex web applications with 1000+ frequently updated elements
- Performance in benchmarks (js-reactivity-benchmark for Cause & Effect, js-framework-benchmark for Le Truc) is among the 5 best-in-class
- Bundle size remains below 14 kB gzipped (TCP segment threshold); target is ≤10 kB

---

## 2. User Personas

### Primary: Agency frontend developer

- **Role**: Frontend developer at a digital agency
- **Technical level**: Comfortable with TypeScript; values precise type inference and compile-time error detection; familiar with modern build tooling (Vite, Bun); experienced with HTML and CSS; may have prior exposure to one JS framework
- **Environment**: Multi-project context with heterogeneous backends (Java, PHP, Python, C# CMS platforms); uses npm packages and bundles with Vite or Bun; deploys to CDN or static hosting
- **Goals**: Build interactive UI components that are reusable across projects; avoid per-project reinvention of patterns; be able to refactor with confidence; ship accessible, performant frontends
- **Pain points solved**: No more tight coupling between components; state changes propagate automatically; TypeScript catches integration errors at compile time; components are portable because they are backend-agnostic

### Secondary: Design system / component library author

- **Role**: Developer building a reusable component system intended for consumption across multiple projects or teams
- **Technical level**: Advanced TypeScript; interested in API ergonomics and extensibility; understands custom elements lifecycle; may publish to npm
- **Environment**: Library build pipeline; consumers may use any framework or no framework
- **Goals**: Define behavioral contracts for components with type guarantees; ensure components work in any host environment; keep the behavioral layer separate from visual styling
- **Pain points solved**: Web Components as the distribution format means no framework lock-in; Le Truc's functional composition model supports building reusable effect and parser primitives on top of the library

---

## 3. Functional Requirements

### Must Have

**M1. Component definition via a single function**
`defineComponent(name, factory)` is the sole entry point for defining a component. It registers a native Custom Element with no additional boilerplate. The factory receives a `FactoryContext` with element queries, `expose()` for declaring reactive properties, and helpers for creating effects.

**M2. Reactive properties backed by signals**
Component properties are signals. Reading a property inside an effect automatically tracks it as a dependency. Writing a property triggers all dependent effects. Properties must behave like normal JS object properties from the outside (`host.count++` works).

**M3. Attribute → property initialisation via parsers**
Properties declared with a `Parser` function read the corresponding HTML attribute once at connect time and transform the string value into a typed JS value. Parsers are for server-side-authored initial configuration only — `observedAttributes` is always empty and `attributeChangedCallback` is never used. Post-connect state changes must go through event handlers, `watch()`, or direct property writes.

> **Design note:** Live attribute sync via `observedAttributes` was intentionally dropped in v2.0. It was the primary obstacle to simplifying the `defineComponent` signature (required the `U extends UI` generic on parsers) and the mental model (authors confused "attribute as initial config" with "attribute as reactive state"). Le Truc provides real, type-safe reactivity through properties — attribute observation is an escape hatch for interop, not a first-class pattern. If live attribute sync is needed for a specific use case, it can be added as an optional third parameter to `defineComponent` in a future release.

**M4. Type-safe DOM queries**
`first(selector)` and `all(selector)` must infer the correct `HTMLElement` subtype from the CSS selector string at compile time. Required elements must throw a typed error if missing. Optional elements must return `undefined` without throwing.

**M5. Fine-grained DOM effects**
Effects are applied per-element, not per-component. Updates are targeted to the exact DOM node that needs changing. The `watch(source, handler)` helper drives any DOM update from an explicit reactive source. The following built-in DOM binding helpers are required: `bindText`, `bindAttribute` (covers `setAttribute` and `toggleAttribute`), `bindClass`, `bindProperty`, `bindStyle`, `bindVisible` (replaces `show`), `dangerouslyBindInnerHTML`. Event handling and inter-component binding are covered by `on()` and `pass()` respectively.

**M6. Automatic dependency tracking**
Effects must automatically re-run when their reactive dependencies change, with no manual subscription management. Effects must clean up after themselves when the component disconnects.

**M7. Dynamic element collections via `all()`**
`all()` must return a live `Memo<Element[]>` backed by a `MutationObserver`. When elements are added or removed from the DOM, the memo updates and dependent effects re-run. Spurious invalidations from mutations *inside* matched elements must be filtered out.

**M8. Dependency resolution for nested custom elements**
If a component queries child custom elements that are not yet defined, initialization must wait for their definition before running effects. Timeout must be graceful: log the error and proceed rather than blocking indefinitely.

**M9. Event-driven sensors**
`createEventsSensor` must allow deriving a single reactive value from multiple DOM event types on a collection of elements, without imperative event listener management.

**M10. Context protocol**
`provideContexts` and `requestContext` must implement the Web Components Community Protocol for Context, enabling ancestor-to-descendant reactive value sharing without prop drilling or direct component coupling.

**M11. Signal injection between components via `pass()`**
A parent component must be able to inject its own reactive signal directly into a child component's property slot, creating a live reactive binding. The child must have no knowledge of the parent.

**M12. Async task signals**
`createTask` must support async operations with: automatic re-run when reactive dependencies change, cancellation of in-flight requests (AbortSignal), pending/ok/error state tracking, and initial value before resolution.

**M13. TypeScript types exported and accurate**
All public API must be fully typed. Type inference must work without explicit type annotations in the common case. Errors from incorrect usage (wrong property name, type mismatch) must surface at compile time, not runtime.

**M14. Tree-shakeable exports**
Unused effects, parsers, and utilities must be eliminable by a bundler. No side effects at module load time except `customElements.define()` triggered by `defineComponent`.

**M15. No-build CDN usage supported**
The library must be consumable via a `<script type="module">` tag from a CDN without a build step, for teams not using a bundler.

**M16. Security validation in `setAttribute`**
`setAttribute` must block `on*` event handler attributes and reject URLs with unsafe protocols (`javascript:`, `data:`, etc.) to prevent XSS via attribute injection.

### Should Have

**S1. Parser/Reader distinction replaced by explicit API** ✅ *Resolved in v2.0*
`Reader<T, U>` is removed. `Parser<T>` is branded via `asParser()`, detected by `isParser()` on `PARSER_BRAND` only — no function-length fallback. Custom parsers must use `asParser()`.

**S2. MethodProducer made explicit in the type system** ✅ *Resolved in v2.0*
`MethodProducer` is branded via `defineMethod()` and detected by `isMethodProducer()` on `METHOD_BRAND` only. No implicit function-type fallback.

**S3. Required element error messages are actionable**
When a required element is missing (`MissingElementError`), the error message must identify which component, which selector failed, and include the developer-provided hint string. Errors must name the component element.

**S4. Development mode with enhanced diagnostics**
When `DEV_MODE` is enabled: detailed error messages with component context, warnings for dependency resolution timeouts, and effect execution logging.

**S5. Scheduler deduplication for innerHTML mutations**
`dangerouslyBindInnerHTML` updates must be deferred and deduplicated via `requestAnimationFrame`. Deduplication is per element so multiple helpers targeting the same element all run, while rapid re-fires of the same helper within one frame collapse to a single write. Passive event handlers (`on()` with scroll, resize, etc.) are separately throttled at the signal-graph input level via `throttle()` to prevent upstream churn.

### Should Avoid

**X1. `observedAttributes` / `attributeChangedCallback` for reactive state**
Do not use `observedAttributes` to drive reactive property updates. Attribute observation couples component state to HTML attribute mutations, which is a weak and error-prone reactivity model compared to signal-backed properties. It was the primary obstacle to removing the `U extends UI` generic from parsers and simplifying the `defineComponent` API. Le Truc components use properties as the reactive interface; attributes are for initial server-authored configuration only (read once at connect time via parsers). If interop with attribute-mutation patterns is strictly required (e.g., for compatibility with specific CMS tooling), it may be offered as an opt-in escape hatch via an optional parameter, but it must never be the default or encouraged path.

### Nice to Have

**N1. Debug flag per component instance**
`host.debug = true` enables verbose logging for a single component instance without enabling global dev mode.

**N2. Compile-time selector type inference for SVG and MathML**
Extend the CSS selector type parser to cover `SVGElementTagNameMap` and `MathMLElementTagNameMap` in addition to `HTMLElementTagNameMap`.

---

## 4. Non-Functional Requirements

### Performance

- Bundle size: ≤10 kB gzipped; hard ceiling 14 kB (one TCP segment)
- DOM updates must be synchronous and targeted: no virtual DOM diffing, no full component re-renders
- Signal propagation must be glitch-free: no intermediate states visible to effects when multiple signals update in a single batch
- High-frequency event handlers (scroll, resize, touch) must be frame-rate-limited via the scheduler

### Accessibility

- Le Truc does not enforce accessibility compliance, but must not make it harder to achieve
- Built-in effects must preserve existing accessibility attributes unless explicitly overridden
- Example components must demonstrate correct ARIA patterns (roles, states, properties) as the reference implementation for component authors
- `MissingElementError` hints must reference accessibility implications where relevant

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

### Reliability

- Components must clean up all effects and event listeners on disconnect — no memory leaks from connected/disconnected cycles
- Dependency resolution timeout must not block page load; it must degrade gracefully
- `createTask` cancellation must prevent stale async results from updating the DOM after component disconnect

---

## 5. Technical Constraints

### Required

- **Runtime**: `@zeix/cause-effect` is the sole reactive primitive layer. Le Truc depends on specific signal types not available in other libraries: `Slot` (swappable backing signal), lazy `Memo` with `watched` callback, `Sensor` (event-stream-derived signal), `Task` (colorless async), and `Scope` (owned effect lifecycle). The dependency is tight and intentional; the prior claim that the reactive engine could be swapped is no longer accurate.
- **Language**: TypeScript. The library is authored in TypeScript and published with full type declarations.
- **Module format**: ESM only. CommonJS is not a target.
- **Build tooling**: Bun (primary), Vite compatible. Tests run via Playwright against real browsers.

### Prohibited

- No client-side rendering or templating. Le Truc must never generate initial HTML.
- No server-side rendering layer. The library is browser-only.
- No styled components or design system primitives. Le Truc provides behavioral guarantees only; visual styling is the consumer's responsibility.
- No polyfills bundled or required.
- No framework-specific integrations (React wrappers, Vue plugins, etc.) in the core library.

### Integration points

- Consumed as an npm package (`@zeix/le-truc`) via any bundler (Vite, Bun, Webpack, Rollup)
- Consumable via CDN as an ES module (no-build path)
- Must coexist with any backend rendering technology without coupling or shared protocol

---

## 6. Assumptions & Dependencies

### Assumptions

- The browser renders the initial HTML from the server before any JavaScript executes. Le Truc components progressively enhance this markup — they do not generate it.
- Developers using Le Truc are comfortable with TypeScript and use a bundler in most projects.
- Custom Elements v1 and associated Web Platform APIs are available in all target environments without polyfills.
- Sibling-to-sibling component communication is a design smell. Components should coordinate only through their hierarchy (parent→child via `pass()`, ancestor→descendant via context) or through application-level state. Tight sibling coupling is explicitly not a supported pattern.
- The initial server-rendered HTML is the correct initial UI state. Le Truc does not need to "reconcile" its state with the server — the HTML *is* the truth at load time.

### Dependencies

- `@zeix/cause-effect` ^1.0.0 — reactive primitive layer. Le Truc and Cause & Effect are co-developed at Zeix AG and released 1.0 together.
- Playwright — browser-based integration tests
- Bun — build tooling and test runner script

---

## 7. Risks & Mitigations

### R1. Parser/Reader distinction via `function.length` causes silent misclassification

**Risk**: A parser written with default parameters (`(ui, value = '') => ...`) has `length === 1` and is treated as a Reader, bypassing `observedAttributes` registration. The bug is silent.
**Mitigation**: Replace with an explicit wrapper API (see S1) before 1.0. Until then, document the constraint prominently and include a test case that catches the misclassification.

### R2. `cause-effect` upstream changes break Le Truc

**Risk**: Le Truc depends on signal types (`Slot`, `Scope`, lazy `Memo`) that may change in future Cause & Effect versions.
**Mitigation**: Le Truc and Cause & Effect are co-developed at Zeix AG. Version pinning and coordinated releases mitigate this. Both libraries target 1.0 together.

### R3. Refactoring cost benefit is hard to measure objectively

**Risk**: The primary success criterion is subjective developer experience, which is difficult to quantify. The comparison is against a hypothetical alternative, not a controlled experiment.
**Mitigation**: Use graded-transition projects (migrating existing codebases incrementally) to give developers direct comparison points. Collect qualitative feedback systematically. Accept that proof will be emergent rather than experimental.

### R4. Component portability proves harder than expected in practice

**Risk**: Components built for project A may depend on application-specific context providers or DOM structures that aren't available in project B, undermining the reuse goal.
**Mitigation**: Enforce the architecture rule that general-purpose components must not assume context or DOM structure beyond their own subtree. Reserve context and coordination patterns for explicitly "application-level" components. Document this boundary clearly.

### R5. CDN / no-build usage diverges from bundled usage

**Risk**: Tree-shaking, TypeScript types, and minification only benefit bundled consumers. CDN usage lacks these, and the gap may widen if the library grows.
**Mitigation**: Keep the CDN build as a first-class output. Cap bundle size at the TCP segment limit regardless of which features are added.

---

## 8. Out of Scope

- **Client-side rendering or templating**: Le Truc will never generate initial HTML. Component authors who need client-side rendering should use a different tool or implement it themselves with template literals or `<template>` cloning.
- **Server-side rendering**: The library is browser-only. A companion TypeScript SSR library is a separate future project, not part of Le Truc.
- **Styled components / design system**: Visual styling is entirely the consumer's responsibility. Le Truc provides behavioral primitives only.
- **Framework adapters**: No React wrappers, Vue plugins, Angular modules, or similar.
- **Sibling-to-sibling state sharing**: Not a supported coordination pattern.
- **Accessibility enforcement**: Le Truc cannot enforce WCAG compliance. It provides patterns and primitives; correctness is the component author's responsibility.
- **Polyfills**: No legacy browser support (IE11 or non-evergreen browsers).
- **Full styled component library**: Planned as a separate project built on top of Le Truc.
