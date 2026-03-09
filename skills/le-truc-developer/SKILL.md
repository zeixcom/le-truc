---
name: le-truc
description: Write or review Le Truc reactive web components. Use when asked to build, extend, or debug a Le Truc component.
user_invocable: true
---

# Le Truc Developer Skill

You are an expert Le Truc developer. Le Truc is a TypeScript library for building reactive custom elements (web components) using a signal-based reactive system (`@zeix/cause-effect`).

**Before writing code, produce a brief component plan and show it to the user.** The plan should name each component, state its responsibility in one sentence, and note how components coordinate. Proceed after the user confirms or continues without objection.

---

## Authoritative sources

Read these before writing or reviewing code. They are the ground truth — do not infer from memory when the source is available.

| Source | What it contains |
|---|---|
| `README.md` | Project overview and a worked quick-start example |
| `ARCHITECTURE.md` | File map, component lifecycle, effect system, UI query system, parser system, context protocol |
| `src/component.ts` | `defineComponent` — the single entry point; prop initializer types |
| `src/parsers/` | All parsers (`asString`, `asEnum`, `asNumber`, `asInteger`, `asBoolean`, `asJSON`, `read`) |
| `src/effects/` | All effects (`on`, `setAttribute`, `toggleAttribute`, `toggleClass`, `setText`, `setStyle`, `setProperty`, `show`, `dangerouslySetInnerHTML`, `pass`) |
| `src/context.ts` | `provideContexts`, `requestContext`, `ContextRequestEvent` |
| `src/ui.ts` | `first`, `all`, `createElementsMemo`, UI query types |
| `types/` | TypeScript declarations for all public exports |
| `docs-src/pages/` | Narrative documentation: getting started, components, data flow, styling, examples |

If Context7 is available, call `resolve-library-id` with `le-truc`, then `query-docs` with a specific question.

---

## The Le Truc model

A component is defined with four arguments to `defineComponent`:

```
name    — tag name: lowercase, must contain a hyphen
props   — reactive properties: signals, parsers, readers, or static values
select  — UI map: named queries into the host's subtree
setup   — effects: reactive functions that update the DOM when signals change
```

The `ui` object passed to `setup` holds everything from `select` plus `host` (the element itself). `host` is the only legal interface between a component and the outside world, unless the component explicitly requests context from an ancestor.

**Reactivity flow:**

```
attribute change → parser → host.prop (signal)
                                  ↓
                            effect reads prop
                                  ↓
                         DOM update on target
                                  ↓
                     event handler → { prop: value }
                                  ↓
                          signal updated → effect re-runs
```

---

## Deciding on component structure

The right structure emerges from thinking about user perception and data flow together. A component should represent one thing a user recognises as a coherent unit. A form field (label + input + hint + error) is one unit. A list and its items are two levels of units. A chart with its title, axes, and tooltip is one unit.

Split components when:
- Two pieces of state are truly independent — no shared data flow, no shared DOM ancestry that gives them meaning together.
- A sub-element recurs (list items, table rows) or is reused in a different location.

Don't split when:
- The only motivation is keeping file size small.
- The split would require artificial coordination to put back what belongs together.

Context wrapper components — those that manage server synchronisation or provide shared state to a subtree — are their own components. Their descendants request context from them and are agnostic about who provides it.

---

## Component coordination

Choose one mechanism per relationship:

**`pass()`** — parent controls a named child component by replacing the backing signal of one of its props. Use when the parent owns the child and knows its element name and prop.

**`provideContexts` / `requestContext`** — a descendant requests a value from any ancestor that chooses to provide it. The descendant doesn't know the depth. Use for data-fetch scopes, auth state, locale, theme. In the ancestor's setup, return `provideContexts(['propName'])` on `host`. In the descendant's props, use `requestContext(CTX_KEY, fallback)`.

**`on(type, handler)` on `host`** — receive events that bubble up from children without knowing their exact source.

**`all(selector)`** — run effects on every current and future element matching a selector within the host. The returned `Memo<E[]>` stays current via a lazy `MutationObserver`.

**No sibling communication.** If two components in different branches of the DOM need to share state, lift it to a common ancestor and use `pass()` or context.

---

## Anti-patterns

Avoid these regardless of how a component is structured:

- Querying outside the host's subtree (`document.querySelector`, `parentElement`, etc.)
- Directly reading or writing properties on inner elements of a child component — use `pass()` instead
- Sibling communication — lift shared state to a common ancestor
- Overloading one component with unrelated state just to avoid creating a second one
- `dangerouslySetInnerHTML` on untrusted or user-generated content
- Custom effects that don't return a cleanup function
- Missing TypeScript types on props and the `select` return — parsers and UI queries are the main type-safety mechanism

---

## Accessibility

Apply ARIA roles, states, and properties appropriate to the widget type you are building. Prefer native semantics (`<button>`, `<input>`, `<label>`, `<dialog>`) over custom ARIA. For interactive patterns (combobox, dialog, tabs, tree), follow the ARIA Authoring Practices Guide. Use `setAttribute` and `toggleAttribute` effects to keep ARIA states in sync with component signals.
