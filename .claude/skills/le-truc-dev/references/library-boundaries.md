<overview>
What belongs in @zeix/cause-effect vs. @zeix/le-truc. Both libraries are co-developed by Zeix AG.
</overview>

## The relationship

`@zeix/cause-effect` is a **primitives-only reactive state management library**. It was built to power le-truc but is intentionally framework-agnostic — it has no opinions about rendering, DOM, or component architecture.

`@zeix/le-truc` is the **component layer** that sits on top of cause-effect. It uses cause-effect's reactive graph and re-exports it entirely. Le Truc adds everything needed to build reactive custom elements: the component model, DOM effects, attribute parsers, context protocol, and accessibility-aware patterns.

## Boundary rule

> If a feature requires no browser or DOM API, it belongs in `@zeix/cause-effect`.
> If a feature manipulates the DOM or integrates with the Custom Elements API, it belongs in `@zeix/le-truc`.

## What belongs where

| Concern | Library | Rationale |
|---|---|---|
| Signal primitives (State, Sensor, Memo, Task, Slot, Store, List, Collection) | cause-effect | Reactive graph — no DOM needed |
| Dependency tracking, propagation, batching, cleanup | cause-effect | Core graph engine |
| Ownership (`createScope`) and scheduling (`batch`) | cause-effect | Graph lifecycle |
| `match()` for unset/error state handling | cause-effect | Signal utility |
| `defineComponent` / `Truc` class | le-truc | Requires `HTMLElement`, `customElements.define` |
| DOM helpers (`bindText`, `bindProperty`, `bindAttribute`, `on`, `pass`, …) | le-truc | Direct DOM manipulation |
| Attribute parsers (`asString`, `asBoolean`, `asInteger`, …) | le-truc | Attribute API is browser-only |
| `first()` / `all()` DOM queries | le-truc | Requires `querySelector`, `MutationObserver` |
| Context protocol (`provideContexts`, `requestContext`) | le-truc | Custom events, DOM event bubbling |
| `createEventsSensor` | le-truc | `addEventListener`, event delegation |
| Security validation (`setAttribute`) | le-truc | DOM-level protection |
| `rAF`-based scheduler | le-truc | `requestAnimationFrame` is browser-only |

## Non-goals of cause-effect (explicitly out of scope)

From `REQUIREMENTS.md`:
- **Rendering** — no DOM manipulation, no virtual DOM, no component model
- **Persistence** — no serialization, no local storage, no database integration
- **Framework bindings** — no React hooks, no Vue composables
- **Additional signal types** — the 9 existing types are considered complete

Do not propose adding DOM-aware features to cause-effect. If a feature needs a browser API, it belongs in le-truc (or in application code).

## Signal type set is complete

The 9 signal types in cause-effect cover every structurally distinct role in the reactive graph. Before proposing a new signal type on either side, confirm the need cannot be met by composing existing types. The bar for a new signal type is: "this pattern cannot be correctly or performantly expressed as a composition of existing types."

## Versioning and compatibility

Both libraries are stable at 1.0. Breaking changes are only acceptable if major Web Platform changes shift the optimal way to achieve the existing goals. New features are expected to be additive and non-breaking.
