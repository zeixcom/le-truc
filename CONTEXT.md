# Le Truc — Domain Vocabulary

Le Truc is a reactive custom elements library. This document defines the precise meaning of domain-specific terms used throughout the project.

## Language

**Module**:
An ECMAScript Module (`.ts` file in `src/`). Contains one or more **Component** definitions, plus optionally module-scope constants or helper functions.
_Avoid_: component (when referring to the file), library, package

**Component**:
A Web Component instance in the DOM, created and managed by Le Truc's factory system. A Web Component is a custom element with JavaScript-enhanced functionality. Not every custom element is a Web Component (e.g., CSS-only custom elements are valid but not Web Components). Represents a UI element with reactive behavior.
_Avoid_: module (when referring to the instance), element (too generic), custom element (use only when explicitly referring to the `customElements.define()` API)

**Custom Element**:
A DOM element defined via `customElements.define()`. May or may not have JavaScript functionality. A **Component** is a **Custom Element** that is a Web Component (has JS-enhanced functionality).
_Avoid_: Web Component (when referring to the registration API), tag (too generic)

**Page**:
A complete HTML document or route that uses Le Truc components. Not a Le Truc concept itself, but a consumer-side term.
_Avoid_: view, route, screen

**Factory**:
The function passed to `defineComponent()` that receives the factory context. Factory context helpers (`watch`, `on`, `pass`, `each`, `provideContexts`) register effect descriptors into an ambient per-instance collector as they are called and return `void` — the collector is the only registration path, and the factory returns nothing (see [ADR 0018](adr/0018-implicit-effect-collection-via-ambient-context.md), which supersedes [ADR 0007](adr/0007-effect-descriptors-with-deferred-activation.md)). Since v3.0 the explicit-return form is removed: `FactoryResult` no longer exists.
_Avoid_: builder, constructor, initializer

**Factory Context**:
The object passed to a factory function containing helpers like `watch`, `on`, `pass`, `expose`, `first`, `all`, `provideContexts`.
_Avoid_: component context, element context

**Effect Descriptor**:
A thunk (function) produced internally by factory context helpers like `watch()`, `on()`, `pass()`, `each()`. Pushed into the active ambient collector when the helper is called, then activated after dependency resolution. Prior to v3.0 these could also be returned by the factory for explicit collection; that form is removed — the collector is the only registration path.
_Avoid_: effect, reaction, subscriber

**Signal**:
A reactive primitive from `@zeix/cause-effect` that holds state and notifies dependents of changes. Backs Le Truc properties.
_Avoid_: state, observable, store

**Slot**:
A wrapper around mutable signals that enables signal swapping for inter-component binding via `pass()`.
_Avoid_: container, wrapper, holder

**Parser**:
A function that transforms HTML attribute strings to typed values (e.g., `asBoolean`, `asInteger`). Called once at connect time.
_Avoid_: converter, transformer, decoder

**Pre-Connect Write**:
A plain own data property left on a host by a write before its connect-time initialization (e.g. a parent factory writing a child's prop — parent-first `connectedCallback` order). Captured at connect as the initial **Signal** value; the accessor installs anyway (ADR 0031).
_Avoid_: early write, pre-upgrade assignment, DOM value

**Binding**:
The connection between a **Signal** and a DOM property/attribute on any **HTMLElement**, established by helpers like `bindAttribute`, `bindText`, `bindProperty`. Used for one-way updates from signals to DOM. For non-Le Truc elements, this is the only available mechanism.
_Avoid_: link, connection, sync, pass

**Pass**:
The mechanism for zero-overhead live **Signal** sharing between Le Truc **Component** instances, swapping **Slot**-backed signals. Writes are mediated: the thunk form is read-only for the receiving component, and the `{ get, set }` descriptor form routes child writes through the parent. The unrestricted-write short forms were removed in v3.0 — deprecated in v2.2, these are the only accepted forms ([ADR 0012](adr/0012-deprecate-unrestricted-write-short-forms-in-pass.md)). Only works between Le Truc components.
_Avoid_: forward, propagate, share, bind

**Server Arg**:
A parameter of the function an authored **Component** source declares. The server supplies its value at render time. Server args are the only channel that carries data into a **Component** from outside its own markup.
_Avoid_: prop (that is a reactive **Component** property), input, attribute

**Reserved Parameter**:
A **Server Arg** the compiler supplies instead of the caller. Two exist: `children` (a composed **Component**'s children) and `i18n` (the locale record, [ADR 0030](adr/0030-internationalization-as-build-time-server-data.md)). A **Component** receives one only if it declares it.
_Avoid_: injected arg, ambient arg, context (a **Reserved Parameter** is not the context protocol)

**Children Region**:
The content a parent passes as `children` to a composed **Component**, as rendered inside it. The parent owns it ([ADR 0048](adr/0048-the-children-contract-parent-owned-content-child-declared-roles.md)): it is part of the parent's template, and the parent styles, addresses and binds it. The child's element that encloses `{children}` carries the region marker, `data-children="<owner-tag>"`. That element is the child's; its descendants form the region.
_Avoid_: slot, slotted content (a shadow-root construct), projected content, light children (that names every child node)

**Role**:
A class-named element in a **Children Region** that the child declares in its `children` type (`Children<{ tab: 'button' }>`), and the only kind of element in the region the child may address or style. A child styles a Role's own box at zero specificity, so the parent's rules win any tie.
_Avoid_: part (CSS `::part`), slot name, child element (too broad)

**Authored Surface**:
Which of the two isomorphic file formats a **Component** is authored in: `.tsx` (the default) or `.tsrx` (retained where statement-context control flow reads better) ([ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md)). Both compile through the same **Machinery** to the same artifacts.
_Avoid_: front end (that names the compiler half), format, dialect

**Front End**:
The compiler's per-surface half: parsing, setup-extraction dispatch, and template lowering for one **Authored Surface**. Two exist, sharing front-end-neutral extraction modules so a shared change cannot drift between surfaces ([ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md) s6).
_Avoid_: parser (too narrow — a front end lowers, not only parses), compiler (that includes the **Machinery**)

**Adapter**:
A tool outside the compiler that translates another component format into host-profile `.tsx`, together with a source map back to its input; the compiler remaps its diagnostics through that map ([ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md) s6). An adapter translates or refuses, never emulates. Experimental until a first-class reference adapter ships.
_Avoid_: front end (that is in-repo and produces IR, not source), plugin (there is no plugin machinery), converter (the internal TS → estree step)

**Machinery**:
The surface-independent compiler stages every **Authored Surface** shares: client analysis, both emitters, tier classification, and the simulation driver ([ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md) s5).
_Avoid_: backend, core (that names `@tsrx/core`, the `.tsrx` parser pin)

**Phase**:
One of the two server render steps. **Phase 1** lowers the template to markup and **Folds** what it can. **Phase 2** pre-plays the generated client module in the **Simulation Realm**. A phase is a step; an **Evaluation Tier** is the decision about which steps a **Component** runs.
_Avoid_: stage (that names ADR 0027's rollout stages), tier, pass

**Fold**:
To compute a reactive expression's initial value at build time and write the result into the rendered markup. The fold is all-or-nothing per expression. One read the compiler cannot resolve disqualifies the whole expression.
_Avoid_: evaluate (too generic), precompute, inline

**Harvest**:
To read a **Component**'s initial state back out of the server-rendered DOM at connect time. The site a value renders into is the same site the client harvests it from.
_Avoid_: hydrate, scrape, parse. "Hydrate" is correct only when describing other frameworks, which do ship a state payload; a Le Truc **Component** enhances markup and harvests from it.

**Compile-Time Marker**:
A call in an authored source that the compiler consumes and never runs, imported from `@zeix/le-truc-compiler/macros`: `harvest()` (a seed's parsers) and the `css` tag. Its runtime stub throws ([ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md) s1).
_Avoid_: macro (except as the subpath's name), ambient (the factory-context helpers are ambients and runtime values, not markers)

**Value Harness**:
The server-side stand-in for the reactive system that the **Folded** tier runs setup against. It follows the signal meaning of Cause & Effect, frozen at the seed ([ADR 0046](adr/0046-reactive-list-items-as-mount-scopes.md) s3). A cell is its initial value in a box: `.get()` reads once, and `.set()` does nothing. A list hands out one cell per item, keyed as the client keys the same seed. A store's fields are signals. A sensor's server value is its `{ value }` seed, and an unseeded sensor is **Unresolvable**. The harness has no DOM.
_Avoid_: shim, mock, stub (those name the **Simulation Realm**'s replacements for absent APIs)

**Simulation Realm**:
The jsdom document and custom-element registry that the driver runs a generated client module in ([ADR 0027](adr/0027-server-simulation.md)). It renders the **Simulated** tier. Nothing about the realm ships to a browser.
_Avoid_: sandbox, VM, headless browser, virtual DOM

**Evaluation Tier**:
Which server mechanism produces a **Component**'s reactive initial values ([ADR 0029](adr/0029-tiered-server-evaluation.md)). The compiler decides it statically, per **Component**. Three tiers, named rather than numbered:
- **Folded** — phase 1 only, in the **Value Harness**. No jsdom.
- **Simulated** — phase 1, then pre-play in the **Simulation Realm**.
- **Static** — the phase-1 skeleton only. The client corrects at connect.

_Avoid_: bare "tier 1/2" (ambiguous with **Surfacing Tier**), phase, mode, level

**Unresolvable**:
Said of an expression, never of a **Component**. No server phase can produce the expression's value. Two causes:
- Every read routes through an API the **Simulation Realm** stubs — layout, `internals`, an absent sensor.
- The input is not a server-side fact — the wall clock, the RNG, a runtime-default locale.

An unresolvable expression is omitted in every **Evaluation Tier**. The **Static** tier is the component-level case, where every unresolved expression is unresolvable.
_Avoid_: unrenderable, not server-evaluable (that names the narrower phase-1 predicate)

**Routing Signal**:
A compile-time finding that selects a **Component**'s **Evaluation Tier**. A routing signal reports no fault. The author wrote nothing wrong; the **Component** needs a different render mechanism.
_Avoid_: warning, error, diagnostic (a routing signal is none of the three)

**Surfacing Tier**:
Which channel carries a failure to whoever must act on it ([ADR 0028](adr/0028-tiered-error-surfacing.md)). Three tiers, named rather than numbered:
- **Prevented** — a compile-time diagnostic exists, and the build fails.
- **Contained** — the check fires at runtime, the **Component** degrades, and one attributed `console.error` names it.
- **Escalated** — the failure escapes containment. Definition-time failures and security-boundary violations only.

_Avoid_: bare "tier 1/2/3" (ambiguous with **Evaluation Tier**), severity, level

**Census**:
A build-report record of what the build found. A census entry asserts no fault, so it is neither a diagnostic nor a warning. Two exist: the tier census, per **Component**, and the translation census, per locale.
_Avoid_: warning, diagnostic, error, report (too generic)

**Hole**:
A position in an emitted template partial where the CMS renders a value at request time, because the value reads a **Server Arg** ([ADR 0043](adr/0043-the-target-emitter-interface-for-template-emission.md)). Its expression lies in the portable subset, and the shared walk assigns it an **Escaping Context**.
_Avoid_: placeholder, slot (a different construct), variable (that is the target's spelling of a hole)

**Arm**:
One alternative of a conditional (`@if`/`@switch`, a `.tsx` ternary, `&&` or switch IIFE) or of the async boundary, keyed by a compile-time **Arm Key** (`then`/`else`, `case:<literal>`, `default`; `ok`/`nil`/`err` for the boundary). When the condition is reactive, each arm ships as an inert `<template data-arms data-key>` and at most one arm, the **Live Arm**, is in the document ([ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md)). An **Arm Set** is one conditional's or boundary's templates plus its live arm.
_Avoid_: branch (for the reactive case, which suggests both alternatives exist in the document), toggled arm (the retired mechanism)

**Mount Scope**:
An element subtree with its own mount and its own `first`, bound to its root: the host (the factory), a **Live Arm** (`bindArm`) or a reactive-list item (`bindItem`). Every compiled construct emits into the mount of its nearest enclosing Mount Scope, so scopes nest by recursion ([ADR 0046](adr/0046-reactive-list-items-as-mount-scopes.md)). A selector bound in a scope is proved to match nothing in a nested scope, and may name the scope root itself.
_Avoid_: scope alone (CSS `@scope`, Cause & Effect's `createScope`), context (the Context protocol), hole (a CMS template position)

**Initial Winner**:
The arm a conditional renders live at render time, kept on the IR apart from the client's key thunk: a constant key, a portable select over **Server Args**, or a fold through the **Value Harness** ([ADR 0043](adr/0043-the-target-emitter-interface-for-template-emission.md) s4). An **Unresolvable** test has none: no arm renders live.
_Avoid_: default arm (that is the `@default` case)

**Target Emitter**:
A backend of the shared template walk that spells its emission operations in one template language (Twig first). It owns syntax, file naming and its escaping functions, never a decision: which positions are holes, which are refused, and which tier a partial takes are all decided before a target sees them.
_Avoid_: template engine (that runs the output), renderer, target (alone, ambiguous with `cssTargets`)

**Escaping Context**:
One member of the closed union that tells a **Target Emitter** how to escape a **Hole**: text, quoted attribute, URL attribute, boolean attribute, class token, style value, HTML. A position outside every context is refused by the shared walk.
_Avoid_: escaping mode, sink, filter (the target's mechanism, not the context)

**Emittability**:
Whether a **Component** can be emitted as a template partial in its **Evaluation Tier**. It is classified per expression and decided per **Component**, like the tier. A non-portable server-class expression makes the component non-emittable (a Prevented diagnostic). A non-portable reactive initial value only routes its partial Static.
_Avoid_: portability (that names the expression-level property), template-safe

**Message Catalog**:
The per-locale translation overrides for a build ([ADR 0030](adr/0030-internationalization-as-build-time-server-data.md)). A **Component** declares each message key with its source-locale string, and the catalog supplies the other locales. The catalog never reaches a browser.
_Avoid_: dictionary, translations file, i18n bundle. "Locale data" is not a synonym — it names the whole `i18n` record, of which the catalog is one field.

**Event-Time String**:
A translated string built in the browser after an interaction — a status announcement, a constraint-validation message — rather than rendered ([ADR 0030](adr/0030-internationalization-as-build-time-server-data.md) sub-design 9). It routes through `t` in a client position; the compiler ships its component's client-referenced keys per instance on the root `i18n` attribute, and the client parses that once at connect. A no-JS reader can never miss one — the interaction that produces it requires JavaScript; strings a no-JS reader must see fold into the markup or render as alternatives instead.
_Avoid_: client-side string (too broad — client code also reads folded strings), runtime string, dynamic string

**Message Pattern**:
A message key whose value contains `{placeholder}` fields, filled at use time — `t.added({ token })` ([ADR 0030](adr/0030-internationalization-as-build-time-server-data.md) sub-design 9). Declared inline in the `i18n` record like any other key; the compiler validates call sites against the declared placeholders, and a translation that drops one is a **Census** entry, not a warning.
_Avoid_: ICU message, template literal (that names the authored `` `…${x}…` `` it replaces), format string

## Relationships

- A **Module** (ESM file) contains one or more **Component** definitions
- A **Component** is a Web Component instance (a **Custom Element** with JS functionality) created by a **Factory** function
- A **Factory** receives a **Factory Context**, whose helpers register **Effect Descriptor** thunks into an ambient collector as they are called and return `void` — the factory returns nothing
- A **Signal** may be wrapped in a **Slot** to enable **Pass** between **Component** instances
- A **Parser** converts attribute strings to values that may back a **Signal**
- A **Pre-Connect Write** captured at connect time seeds the initial value of a **Signal**-backed property instead of suppressing it
- **Binding** helpers connect **Signal** values to DOM properties/attributes on any element
- **Pass** connects **Slot**-backed **Signal** instances between Le Truc **Component** instances
- A **Component** is a **Custom Element** with JavaScript-enhanced functionality (a Web Component)
- A **Component** declares **Server Args**; the compiler supplies any **Reserved Parameter** among them
- An **Event-Time String** reaches the client through the root `i18n` attribute, never through the **Message Catalog**
- An **Authored Surface** is parsed and lowered by its **Front End**; both front ends feed the same **Machinery**
- **Phase 1** **Folds** the expressions it can resolve; **Phase 2** runs the client module in the **Simulation Realm**
- A **Component** has exactly one **Evaluation Tier**, which decides the phases it runs
- An expression is **Unresolvable** or not, independently of its **Component**'s **Evaluation Tier**
- A **Routing Signal** selects an **Evaluation Tier**; a **Surfacing Tier** carries a failure; a **Census** record carries neither
- The client **Harvests** initial state from the rendered DOM in every **Evaluation Tier**
- A **Target Emitter** spells each **Hole** in its **Escaping Context**; **Emittability** decides whether a **Component** reaches a target at all, and a Static partial is still emittable

## Example Dialogue

> **Dev:** "When a **Component** is connected, how does it get its initial **Signal** values?"
> **Architect:** "The **Factory** uses **Parser** functions on the element's attributes at connect time. These create the initial **Signal** values, which are then wrapped in **Slot** if they need to support **Pass**."

> **Dev:** "Can I use **Pass** to share a non-**Slot** **Signal**?"
> **Architect:** "No — **Pass** requires **Slot**-wrapped **Signal** instances because it swaps the signal references. Regular **Signal** instances don't support this swapping mechanism. Use **Binding** helpers for one-way signal→DOM updates on non-Le Truc elements."

> **Dev:** "This component trips `LTC004`. What did I do wrong?"
> **Architect:** "Nothing. That is a **Routing Signal**, not a diagnostic — it selects the **Simulated** tier, because the server cannot **Fold** the value and the **Simulation Realm** can. You would only act on it if the value were **Unresolvable**, which routes to the **Static** tier instead."

## Flagged Ambiguities

- **"Tier", unqualified.** Two distinct concepts carry the word: **Evaluation Tier** (Folded/Simulated/Static, ADR 0029) and **Surfacing Tier** (Prevented/Contained/Escalated, ADR 0028), and their numberings overlap — "tier 2" once meant Contained and now also means Simulated. **Resolution (owner, 2026-09-04): lead with the NAME in both, everywhere; the number survives only as an ordering inside each ADR's own defining list.** Write "the Simulated tier" or "Contained", never a bare "tier 2".
- **"Phase" against "tier".** Both carry small numbers, and they answer different questions. A **Phase** is a render step (phase 1 folds, phase 2 pre-plays). An **Evaluation Tier** decides which steps a **Component** runs. Keep the numbers on phases and the names on tiers.
- **"Arm".** Three constructs carry it: the template-cloned **Arm** of a reactive conditional or boundary; `@for`'s `@empty` arm, which stays on the `hidden` toggle path (ADR 0037 s5); and an ICU `plural`/`select` arm in a **Message Pattern** (the census's `missing-arms`). Qualify the latter two ("the `@empty` arm", "a plural arm"); a bare "arm" means the first.
- **"Fold" as verb and noun.** Both are in use: to fold an expression, and the host-derived fold. Both are correct. Do not introduce "folding" as a third form.
