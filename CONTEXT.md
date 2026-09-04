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
The mechanism for zero-overhead live **Signal** sharing between Le Truc **Component** instances, swapping **Slot**-backed signals. Enables two-way synchronization between components. Only works between Le Truc components.
_Avoid_: forward, propagate, share, bind

**Evaluation Tier**:
Which server-side mechanism renders a **Component**'s reactive initial values, decided statically by the compiler ([ADR 0029](adr/0029-tiered-server-evaluation.md)). Named, not numbered: **Folded** (the DOM-less value harness), **Simulated** (pre-play in the jsdom realm), **Static** (skeleton only; the client corrects). Applies to a whole component.
_Avoid_: bare "tier 1/2" (ambiguous with **Surfacing Tier**), phase (that is the two-phase render, not the routing)

**Surfacing Tier**:
Which channel carries a failure to whoever must act on it ([ADR 0028](adr/0028-tiered-error-surfacing.md)). Named, not numbered: **Prevented** (a compile-time diagnostic exists; the build fails), **Contained** (fires at runtime, the component degrades, one attributed `console.error`), **Escalated** (escapes containment — definition-time failures and security-boundary violations only).
_Avoid_: bare "tier 1/2/3" (ambiguous with **Evaluation Tier**)

**Unresolvable**:
A property of an *expression*, not a component: no server phase can produce its value, either because every read routes through an API the simulation realm stubs (layout, `internals`, absent sensors) or because its input is not a server-side fact at all (wall clock, RNG, runtime-default locale). An unresolvable expression is omitted in **every** Evaluation Tier. The **Static** tier is the component-level case where every unresolved expression is unresolvable.
_Avoid_: "unrenderable", "not server-evaluable" (that is the narrower phase-1 predicate)

**Census**:
A per-component or per-locale record in the build report stating what the build found, without asserting anything is wrong — the *tier census* ([ADR 0029](adr/0029-tiered-server-evaluation.md)) and the *translation census* ([ADR 0030](adr/0030-internationalization-as-build-time-server-data.md)). A census entry is deliberately **not** a diagnostic and not a warning: it carries findings that are not author-fixable, which is what keeps the compile-warning target at zero.
_Avoid_: warning, diagnostic, error (all three are the channels a census exists to stay out of)

## Relationships

- A **Module** (ESM file) contains one or more **Component** definitions
- A **Component** is a Web Component instance (a **Custom Element** with JS functionality) created by a **Factory** function
- A **Factory** receives a **Factory Context**, whose helpers register **Effect Descriptor** thunks into an ambient collector as they are called (explicit `return` of a descriptor array is still supported but deprecated as of v3.0)
- A **Signal** may be wrapped in a **Slot** to enable **Pass** between **Component** instances
- A **Parser** converts attribute strings to values that may back a **Signal**
- **Binding** helpers connect **Signal** values to DOM properties/attributes on any element
- **Pass** connects **Slot**-backed **Signal** instances between Le Truc **Component** instances
- A **Component** is a **Custom Element** with JavaScript-enhanced functionality (a Web Component)
- A **Component** has exactly one **Evaluation Tier**; an *expression* within it may be **Unresolvable** regardless of that tier
- A runtime check has a **Surfacing Tier**; a **Census** record has neither, being no kind of failure

## Example Dialogue

> **Dev:** "When a **Component** is connected, how does it get its initial **Signal** values?"
> **Architect:** "The **Factory** uses **Parser** functions on the element's attributes at connect time. These create the initial **Signal** values, which are then wrapped in **Slot** if they need to support **Pass**."

> **Dev:** "Can I use **Pass** to share a non-**Slot** **Signal**?"
> **Architect:** "No — **Pass** requires **Slot**-wrapped **Signal** instances because it swaps the signal references. Regular **Signal** instances don't support this swapping mechanism. Use **Binding** helpers for one-way signal→DOM updates on non-Le Truc elements."

## Flagged Ambiguities

- **"Tier", unqualified.** Two distinct concepts carry the word: **Evaluation Tier** (Folded/Simulated/Static, ADR 0029) and **Surfacing Tier** (Prevented/Contained/Escalated, ADR 0028), and their numberings overlap — "tier 2" once meant Contained and now also means Simulated. **Resolution (owner, 2026-09-04): lead with the NAME in both, everywhere; the number survives only as an ordering inside each ADR's own defining list.** Write "the Simulated tier" or "Contained", never a bare "tier 2".
