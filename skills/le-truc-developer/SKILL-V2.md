# Le Truc Developer Skill — V2

**Knowledge: Dynamic | Instructions: Exploratory | Planning: Code-first**

---

You are an expert Le Truc developer. Le Truc is a TypeScript library for building reactive custom elements (web components). Before writing code, look up what you need from the source or documentation. Then reason about the right component structure and write the implementation directly.

---

## What Le Truc is

Le Truc wraps native custom elements in a signal-based reactive system. Each component is defined with `defineComponent`, which takes:

1. A custom element tag name (lowercase, contains a hyphen)
2. A **props** object — reactive properties backed by signals, with optional parsers for attribute sync
3. A **select** function — queries UI elements within the host's subtree
4. A **setup** function — returns effects that run reactively when signals change

The `ui` object in `setup` contains all selected elements plus `host` (the element itself). `host` is the component's only interface with the outside world. Effects declared in `setup` are cleaned up automatically when the component disconnects.

---

## Look up the API before you write

The API is frozen at v0.16. Do not guess — look things up when uncertain.

**Option A — read source files directly:**

Key source files in this repository:

| File | What it contains |
|---|---|
| `src/component.ts` | `defineComponent`, prop initializer types |
| `src/parsers/string.ts` | `asString`, `asEnum` |
| `src/parsers/number.ts` | `asNumber`, `asInteger` |
| `src/parsers/boolean.ts` | `asBoolean` |
| `src/parsers/json.ts` | `asJSON` |
| `src/parsers.ts` | `read`, `Parser`, `Reader` types |
| `src/effects/event.ts` | `on` |
| `src/effects/attribute.ts` | `setAttribute`, `toggleAttribute` |
| `src/effects/class.ts` | `toggleClass` |
| `src/effects/text.ts` | `setText` |
| `src/effects/style.ts` | `setStyle` |
| `src/effects/property.ts` | `setProperty`, `show` |
| `src/effects/html.ts` | `dangerouslySetInnerHTML` |
| `src/effects/pass.ts` | `pass` |
| `src/context.ts` | `provideContexts`, `requestContext` |
| `src/ui.ts` | `first`, `all`, `createElementsMemo` |

**Option B — use Context7** (if available or preferred by the user):
Call `resolve-library-id` with `le-truc`, then `query-docs` with a specific question.

Read what you need, then write the code. Do not fabricate signatures.

---

## Mental model

Think about how data flows before you decide on structure:

- Properties are signals. A parser (e.g. `asString()`, `asBoolean()`) makes an attribute-synced signal. A `Reader` function computes a value from the `ui` at connect time.
- Effects are reactive. They re-run when the signals they read change. An `on()` event handler can return `{ propName: newValue }` to update the host's signals.
- `pass()` replaces the backing signal of a child component's slot, so the child reacts as if it owns the value.
- `requestContext` / `provideContexts` lets a descendant get a signal getter from an ancestor without knowing the DOM depth.

---

## Decomposition philosophy

A good component boundary matches what the user perceives as one thing. Ask: *if I removed this element, would the unit still make sense?* If not, it belongs in the same component.

Some useful heuristics:
- A form field — label, control, hint, error — is one component. The form itself (with its submit logic) is another.
- A list component contains the list element and its heading. Each list item is its own component if it has its own behavior or structure.
- A context provider wrapping a data scope is its own component.
- State that is truly independent — no shared data flow, no shared DOM structure — belongs in its own component.

Avoid: packing unrelated state into one component just because the elements are nearby. Avoid: splitting so finely that components must be artificially coupled to compensate.

---

## Coordination

Le Truc components are agnostic about siblings and distant ancestors. Use the right mechanism:

- **`pass()`** — parent explicitly passes a reactive value into a child's named prop. Use when the parent owns the child and knows its element name.
- **`requestContext` / `provideContexts`** — child requests a value that a high-level ancestor provides. The child doesn't know who provides it. Good for data-fetch scopes, auth, theme, locale.
- **`on()` on `host`** — react to events that bubble up from children without knowing which child fired them.
- **`all(selector)`** — run effects on every matching element in the subtree, reactively following DOM mutations.
- **No sibling communication.** Components in different branches of the DOM should not reference each other. Lift shared state to a common ancestor.

---

## Things not to do

- Don't query outside the host's subtree. No `document.querySelector`, no accessing `parentElement` unless via `requestContext`.
- Don't touch the internal elements of a child component. Use `pass()` to give it data.
- Don't communicate between siblings. Lift state.
- Don't bundle unrelated concerns in one component to avoid writing a second one.
- Don't use `dangerouslySetInnerHTML` on untrusted content.
- Don't write custom effects without returning a cleanup function.
- Don't skip TypeScript types — parsers and the `first()`/`all()` queries are the primary type-safety mechanism.

---

## Accessibility

Apply ARIA roles, states, and properties appropriate to the component type. Use keyboard-navigable patterns from the ARIA Authoring Practices Guide where applicable. Reactive ARIA attributes (e.g. `aria-expanded`, `aria-invalid`, `aria-selected`) are a natural fit for `setAttribute` or `toggleAttribute` effects.
