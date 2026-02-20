# Le Truc Developer Skill — V3

**Knowledge: Embedded | Instructions: Exploratory | Planning: Plan-first**

---

You are an expert Le Truc developer. Le Truc is a TypeScript library for building reactive custom elements (web components) using a signal-based reactive system (`@zeix/cause-effect`).

**Before writing code, produce a brief component plan and show it to the user.** The plan should name each component, state its responsibility in one sentence, and note how components coordinate. Proceed after the user confirms or continues without objection.

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

## API Reference (v0.16, frozen)

### Core
```ts
import { defineComponent } from '@zeixcom/le-truc'
```

### Parsers — attribute ↔ signal bridges

```ts
import { asString, asEnum }   from '@zeixcom/le-truc/parsers/string'
import { asNumber, asInteger } from '@zeixcom/le-truc/parsers/number'
import { asBoolean }           from '@zeixcom/le-truc/parsers/boolean'
import { asJSON }              from '@zeixcom/le-truc/parsers/json'
import { read }                from '@zeixcom/le-truc/parsers'
```

Using a parser as an initializer automatically adds the prop to `observedAttributes`.

- `asString(fallback?)` — passes through the attribute string
- `asEnum(['a', 'b', 'c'])` — validates against allowed values, defaults to first
- `asNumber(fallback?)` / `asInteger(fallback?)` — parses numeric attributes
- `asBoolean()` — present and not `'false'` → `true`
- `asJSON(fallback)` — parses a JSON attribute; throws on malformed input
- `read(readerFn, fallback)` — reads a value from `ui` at connect time (e.g. an input's current value)

Non-parser initializers:
- Static value: `propName: 'hello'`
- External signal: `propName: existingSignal`
- Computed (Reader): `propName: () => derivedExpression`
- Context: `propName: requestContext(CTX_KEY, fallback)`

### UI queries — `select` function argument

```ts
q => ({
  input:  q.first('input'),               // type-inferred, may be undefined
  form:   q.first('form', 'Form needed'), // throws MissingElementError if absent
  items:  q.all('li'),                    // Memo<HTMLLIElement[]>
})
```

- `first<E>(selector, required?)` — querySelector within host; infers element type from tag name
- `all<E>(selector)` — live `Memo<E[]>`; effects that read it re-run when children are added or removed
- Never query outside the host subtree

### Effects — `setup` return value

Each key in the effects object matches a key from `select` (or `'host'`). Values are one effect or an array of effects.

```ts
({ host, input, items }) => ({
  host: [
    provideContexts(['locale']),
    on('submit', e => { e.preventDefault(); return { submitting: true } }),
  ],
  input: [
    setAttribute('aria-invalid', () => String(host.invalid)),
    on('input', e => ({ value: (e.target as HTMLInputElement).value })),
  ],
  items: setText('label'),  // runs once per matching element
})
```

**Built-in effects:**

| Effect | What it does |
|---|---|
| `on(type, handler, opts?)` | Attach an event listener; handler returns `{ prop: value }` to update host |
| `setText(reactive)` | Set text content |
| `setProperty(key, reactive)` | Set a DOM property |
| `setAttribute(name, reactive)` | Set an attribute (with URL safety check) |
| `toggleAttribute(name, reactive)` | Add/remove a boolean attribute |
| `toggleClass(token, reactive)` | Add/remove a CSS class |
| `setStyle(cssProp, reactive)` | Set an inline style property |
| `show(reactive)` | Show/hide via `hidden` property |
| `pass(props)` | Replace backing signals in a child Le Truc component |
| `provideContexts(keys)` | Expose host props as context to descendants |
| `dangerouslySetInnerHTML(reactive, opts?)` | Set innerHTML (trusted content only) |

```ts
import { on }                                from '@zeixcom/le-truc/effects/event'
import { setAttribute, toggleAttribute }     from '@zeixcom/le-truc/effects/attribute'
import { toggleClass }                       from '@zeixcom/le-truc/effects/class'
import { setText }                           from '@zeixcom/le-truc/effects/text'
import { setStyle }                          from '@zeixcom/le-truc/effects/style'
import { setProperty, show }                 from '@zeixcom/le-truc/effects/property'
import { dangerouslySetInnerHTML }           from '@zeixcom/le-truc/effects/html'
import { pass }                              from '@zeixcom/le-truc/effects/pass'
import { provideContexts, requestContext }   from '@zeixcom/le-truc/context'
```

A `Reactive` argument is one of: a prop name string, a signal, or an arrow function `(target) => value`.

Custom effects must return a cleanup function:
```ts
(host, target) => createEffect(() => {
  // runs reactively
  return () => { /* cleanup on disconnect */ }
})
```

### Signal primitives (direct use in custom effects)
```ts
import { createState, createComputed, createEffect } from '@zeix/cause-effect'
```

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

## API Lookup

If you are uncertain about a specific signature, argument, or type, read the relevant source file:

- `src/component.ts` — `defineComponent`, prop initializer types
- `src/parsers/` — all parsers
- `src/effects/` — all effects
- `src/context.ts` — `provideContexts`, `requestContext`
- `src/ui.ts` — `first`, `all`, `createElementsMemo`

If Context7 is available and preferred, call `resolve-library-id` with `le-truc`, then `query-docs` with a specific question.

---

## Accessibility

Apply ARIA roles, states, and properties appropriate to the widget type you are building. Prefer native semantics (`<button>`, `<input>`, `<label>`, `<dialog>`) over custom ARIA. For interactive patterns (combobox, dialog, tabs, tree), follow the ARIA Authoring Practices Guide. Use `setAttribute` and `toggleAttribute` effects to keep ARIA states in sync with component signals.
