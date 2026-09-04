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
The function passed to `defineComponent()` that receives the factory context. Factory context helpers (`watch`, `on`, `pass`, `each`, `provideContexts`) register effect descriptors into an ambient per-instance collector as they are called; as of v2.3 the factory does not need to `return` them (see [ADR 0018](adr/0018-implicit-effect-collection-via-ambient-context.md)). Explicitly returning a `FactoryResult` array is still supported for backward compatibility and is deprecated as of v3.0 (see [ADR 0007](adr/0007-effect-descriptors-with-deferred-activation.md), superseded).
_Avoid_: builder, constructor, initializer

**Factory Context**:
The object passed to a factory function containing helpers like `watch`, `on`, `pass`, `expose`, `first`, `all`, `provideContexts`.
_Avoid_: component context, element context

**Effect Descriptor**:
A thunk (function) produced internally by factory context helpers like `watch()`, `on()`, `pass()`, `each()`. Pushed into the active ambient collector when the helper is called, then activated after dependency resolution. Prior to v2.3 these were returned by the factory for explicit collection; that form still works but is deprecated as of v3.0.
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

**Binding**:
The connection between a **Signal** and a DOM property/attribute on any **HTMLElement**, established by helpers like `bindAttribute`, `bindText`, `bindProperty`. Used for one-way updates from signals to DOM. For non-Le Truc elements, this is the only available mechanism.
_Avoid_: link, connection, sync, pass

**Pass**:
The mechanism for zero-overhead live **Signal** sharing between Le Truc **Component** instances, swapping **Slot**-backed signals. Writes are mediated: the thunk form is read-only for the receiving component, and the `{ get, set }` descriptor form routes child writes through the parent. The unrestricted-write short forms are deprecated (v2.2) and removed in v3.0 ([ADR 0012](adr/0012-deprecate-unrestricted-write-short-forms-in-pass.md)). Only works between Le Truc components.
_Avoid_: forward, propagate, share, bind

**Server Arg**:
A parameter of the function a `.tsrx` **Component** declares. The server supplies its value at render time. Server args are the only channel that carries data into a **Component** from outside its own markup.
_Avoid_: prop (that is a reactive **Component** property), input, attribute

**Reserved Parameter**:
A **Server Arg** the compiler supplies instead of the caller. Two exist: `children` (a composed **Component**'s children) and `i18n` (the locale record, [ADR 0030](adr/0030-internationalization-as-build-time-server-data.md)). A **Component** receives one only if it declares it.
_Avoid_: injected arg, ambient arg, context (a **Reserved Parameter** is not the context protocol)

**Phase**:
One of the two server render steps. **Phase 1** lowers the template to markup and **Folds** what it can. **Phase 2** pre-plays the generated client module in the **Simulation Realm**. A phase is a step; an **Evaluation Tier** is the decision about which steps a **Component** runs.
_Avoid_: stage (that names ADR 0027's rollout stages), tier, pass

**Fold**:
To compute a reactive expression's initial value at build time and write the result into the rendered markup. The fold is all-or-nothing per expression. One read the compiler cannot resolve disqualifies the whole expression.
_Avoid_: evaluate (too generic), precompute, inline

**Harvest**:
To read a **Component**'s initial state back out of the server-rendered DOM at connect time. The site a value renders into is the same site the client harvests it from.
_Avoid_: hydrate, scrape, parse. "Hydrate" is correct only when describing other frameworks, which do ship a state payload; a Le Truc **Component** enhances markup and harvests from it.

**Value Harness**:
The server-side stand-in for the reactive system that the **Folded** tier runs setup against. A **Signal** is its initial value in a box: `.get()` reads once, and `.set()` does nothing. The harness has no DOM.
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

**Message Catalog**:
The per-locale translation overrides for a build ([ADR 0030](adr/0030-internationalization-as-build-time-server-data.md)). A **Component** declares each message key with its source-locale string, and the catalog supplies the other locales. The catalog never reaches a browser.
_Avoid_: dictionary, translations file, i18n bundle. "Locale data" is not a synonym — it names the whole `i18n` record, of which the catalog is one field.

## Relationships

- A **Module** (ESM file) contains one or more **Component** definitions
- A **Component** is a Web Component instance (a **Custom Element** with JS functionality) created by a **Factory** function
- A **Factory** receives a **Factory Context**, whose helpers register **Effect Descriptor** thunks into an ambient collector as they are called (explicit `return` of a descriptor array is still supported but deprecated as of v3.0)
- A **Signal** may be wrapped in a **Slot** to enable **Pass** between **Component** instances
- A **Parser** converts attribute strings to values that may back a **Signal**
- **Binding** helpers connect **Signal** values to DOM properties/attributes on any element
- **Pass** connects **Slot**-backed **Signal** instances between Le Truc **Component** instances
- A **Component** is a **Custom Element** with JavaScript-enhanced functionality (a Web Component)
- A **Component** declares **Server Args**; the compiler supplies any **Reserved Parameter** among them
- **Phase 1** **Folds** the expressions it can resolve; **Phase 2** runs the client module in the **Simulation Realm**
- A **Component** has exactly one **Evaluation Tier**, which decides the phases it runs
- An expression is **Unresolvable** or not, independently of its **Component**'s **Evaluation Tier**
- A **Routing Signal** selects an **Evaluation Tier**; a **Surfacing Tier** carries a failure; a **Census** record carries neither
- The client **Harvests** initial state from the rendered DOM in every **Evaluation Tier**

## Example Dialogue

> **Dev:** "When a **Component** is connected, how does it get its initial **Signal** values?"
> **Architect:** "The **Factory** uses **Parser** functions on the element's attributes at connect time. These create the initial **Signal** values, which are then wrapped in **Slot** if they need to support **Pass**."

> **Dev:** "Can I use **Pass** to share a non-**Slot** **Signal**?"
> **Architect:** "No — **Pass** requires **Slot**-wrapped **Signal** instances because it swaps the signal references. Regular **Signal** instances don't support this swapping mechanism. Use **Binding** helpers for one-way signal→DOM updates on non-Le Truc elements."

> **Dev:** "This component trips `TSRX004`. What did I do wrong?"
> **Architect:** "Nothing. That is a **Routing Signal**, not a diagnostic — it selects the **Simulated** tier, because the server cannot **Fold** the value and the **Simulation Realm** can. You would only act on it if the value were **Unresolvable**, which routes to the **Static** tier instead."

## Flagged Ambiguities

- **"Tier", unqualified.** Two distinct concepts carry the word: **Evaluation Tier** (Folded/Simulated/Static, ADR 0029) and **Surfacing Tier** (Prevented/Contained/Escalated, ADR 0028), and their numberings overlap — "tier 2" once meant Contained and now also means Simulated. **Resolution (owner, 2026-09-04): lead with the NAME in both, everywhere; the number survives only as an ordering inside each ADR's own defining list.** Write "the Simulated tier" or "Contained", never a bare "tier 2".
- **"Phase" against "tier".** Both carry small numbers, and they answer different questions. A **Phase** is a render step (phase 1 folds, phase 2 pre-plays). An **Evaluation Tier** decides which steps a **Component** runs. Keep the numbers on phases and the names on tiers.
- **"Fold" as verb and noun.** Both are in use: to fold an expression, and the host-derived fold. Both are correct. Do not introduce "folding" as a third form.
