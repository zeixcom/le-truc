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
The function passed to `defineComponent()` that receives the factory context and returns effect descriptors.
_Avoid_: builder, constructor, initializer

**Factory Context**:
The object passed to a factory function containing helpers like `watch`, `on`, `pass`, `expose`, `first`, `all`, `provideContexts`.
_Avoid_: component context, element context

**Effect Descriptor**:
A thunk (function) returned by factory context helpers like `watch()`, `on()`, `pass()`. These are collected and activated after dependency resolution.
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

## Relationships

- A **Module** (ESM file) contains one or more **Component** definitions
- A **Component** is a Web Component instance (a **Custom Element** with JS functionality) created by a **Factory** function
- A **Factory** receives a **Factory Context** and returns **Effect Descriptor** thunks
- A **Signal** may be wrapped in a **Slot** to enable **Pass** between **Component** instances
- A **Parser** converts attribute strings to values that may back a **Signal**
- **Binding** helpers connect **Signal** values to DOM properties/attributes on any element
- **Pass** connects **Slot**-backed **Signal** instances between Le Truc **Component** instances
- A **Component** is a **Custom Element** with JavaScript-enhanced functionality (a Web Component)

## Example Dialogue

> **Dev:** "When a **Component** is connected, how does it get its initial **Signal** values?"
> **Architect:** "The **Factory** uses **Parser** functions on the element's attributes at connect time. These create the initial **Signal** values, which are then wrapped in **Slot** if they need to support **Pass**."

> **Dev:** "Can I use **Pass** to share a non-**Slot** **Signal**?"
> **Architect:** "No — **Pass** requires **Slot**-wrapped **Signal** instances because it swaps the signal references. Regular **Signal** instances don't support this swapping mechanism. Use **Binding** helpers for one-way signal→DOM updates on non-Le Truc elements."

## Flagged Ambiguities

None currently. Previously resolved:
- "component" was used to mean both the **Module** (ESM file) and **Component** (Web Component instance) — resolved 2025-05-XX
- "binding" was used for both DOM **Binding** and **Pass** — resolved 2025-05-XX: **Binding** is one-way signal→DOM, **Pass** is two-way signal sharing between Le Truc components
- "Web Component" vs "custom element" — resolved 2025-05-XX: **Web Component** = **Custom Element** with JS-enhanced functionality; not all custom elements are Web Components (e.g., CSS-only)
