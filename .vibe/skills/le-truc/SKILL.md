---
name: le-truc
description: Expert guidance for building reactive web components with the @zeix/le-truc library. Use when creating, reviewing, or debugging a Le Truc component.
user_invocable: true
---

## Purpose

This skill provides **authoritative guidance** for developing components with `@zeix/le-truc`, a reactive custom elements library. It covers the **factory form** of `defineComponent`, reactivity patterns, DOM binding, inter-component coordination, and accessibility.

**Use this skill when:**
- Creating a new Le Truc component
- Reviewing or extending an existing component
- Debugging unexpected reactive behavior

**For library development itself**, use the project's own documentation in `src/`, `ARCHITECTURE.md`, `REQUIREMENTS.md`, and `CONTEXT.md`.

**For signal-level questions**, `@zeix/cause-effect` is re-exported by le-truc — no separate install needed.

---

## Core Principles

### Component Definition

**One form:** the factory form of `defineComponent`:

```typescript
defineComponent<MyProps>('my-component', ({ expose, first, host, on, watch }) => {
  const button = first('button', 'Add a native <button>.')
  expose({ disabled: asBoolean() })
  return [
    on(button, 'click', () => { /* ... */ }),
    watch('disabled', bindProperty(button, 'disabled')),
  ]
})
```

### Factory Context

The factory receives a `FactoryContext` at connect time with these helpers:

| Helper | Purpose |
|---|---|
| `first(selector, required?)` | Query single descendant; throws if `required` string given and no match |
| `all(selector, required?)` | Return `Memo<E[]>` backed by lazy `MutationObserver` |
| `host` | Component host element, typed as `HTMLElement & P` |
| `expose(props)` | Declare reactive properties — call **once**, imperatively |
| `watch(source, handler)` | Create reactive effect descriptor |
| `on(target, type, handler, options?)` | Create event listener descriptor |
| `pass(target, props)` | Create slot-swap descriptor for Le Truc child |
| `provideContexts(contexts)` | Create context-provider descriptor |
| `requestContext(context, fallback)` | Return `Memo<T>` for use inside `expose()` |

### Reactivity Flow

```
attribute at connect time → parser
                              ↓
event / property set → host.prop (signal)
                              ↓
                 watch(source, handler) re-runs
                              ↓
                      DOM update via bind*
                              ↓
            on(el, type, handler) → { prop: value }
                              ↓
                signal updated → watch re-runs
```

**Key constraint:** `host` is the **only external interface**. Components read/write state through `host.propName`. No querying outside the host's subtree, no direct property access on child components.

### DOM Binding

Binding helpers connect signals to DOM properties/attributes:

| Helper | Purpose |
|---|---|
| `bindText(el)` | Set text content |
| `bindProperty(el, key)` | Set DOM property |
| `bindAttribute(el, name)` | Set/remove attribute with security validation |
| `bindClass(el, token)` | Toggle CSS class |
| `bindStyle(el, prop)` | Set/remove inline style |
| `bindVisible(el)` | Control `hidden` attribute |

### Inter-Component Coordination

| Relationship | Mechanism |
|---|---|
| Parent → Le Truc child | `pass(target, props)` — slot-swap |
| Ancestor → descendant (any depth) | `provideContexts` / `requestContext` |
| Parent → bubbled events | `on(host, type, handler)` |
| Parent → dynamic descendants | `all(selector)` + `each()` |
| Sibling → sibling | **Not supported** — lift to common ancestor |

---

## Domain Vocabulary

| Term | Meaning | Avoid |
|---|---|---|
| **Module** | ESM file in `src/` containing component definitions | component (file), library |
| **Component** | Web Component instance in DOM, managed by Le Truc | module (instance), element |
| **Custom Element** | DOM element defined via `customElements.define()` | Web Component (API), tag |
| **Factory** | Function passed to `defineComponent()` | builder, constructor |
| **Factory Context** | Object passed to factory with helpers | component context |
| **Effect Descriptor** | Thunk returned by `watch()`, `on()`, `pass()` | effect, reaction |
| **Signal** | Reactive primitive from `@zeix/cause-effect` | state, observable |
| **Slot** | Wrapper enabling signal swapping for `pass()` | container, wrapper |
| **Parser** | Transforms HTML attribute string to typed value | converter, decoder |
| **Binding** | One-way signal→DOM connection via `bind*` | link, sync, pass |
| **Pass** | Zero-overhead signal sharing between Le Truc components | forward, share, bind |

---

## Task Routing

**What kind of task is this?**

1. **Build** — create a new component (TypeScript, HTML, CSS, documentation)
2. **Review** — review or extend an existing component
3. **Debug** — trace broken or unexpected reactive behavior

| Response | Workflow |
|---|---|
| 1, "build", "create", "new", "add", "write" | `workflows/build.md` |
| 2, "review", "extend", "refactor", "improve", "check" | `workflows/review.md` |
| 3, "debug", "fix", "broken", "not working", "wrong", "unexpected" | `workflows/debug.md` |

**Intent-based routing:** If the user provides clear context without selecting, route based on intent.

---

## Reference Index

All references in `references/`:

| File | Contents |
|---|---|
| `component-model.md` | `defineComponent` args, reactivity flow, re-exported signal API |
| `effects.md` | Which `bind*` helper / effect to use when |
| `parsers.md` | Initializers for `expose()`: `asBoolean`, `asInteger`, `asString`, `defineMethod`, etc. |
| `coordination.md` | `pass()`, `provideContexts`/`requestContext`, `on()` on host, `all()` |
| `markup.md` | HTML structure: progressive enhancement, semantic nesting, variants |
| `styling.md` | CSS: host scoping, nesting, custom properties, variant classes |
| `documentation.md` | What to document and how: property tables, descendant tables |
| `testing.md` | Framework-agnostic testing patterns |
| `anti-patterns.md` | What to avoid: TypeScript, HTML, CSS, documentation |
| `accessibility.md` | ARIA roles, native semantics, ARIA APG patterns |

---

## Workflow Index

| Workflow | Purpose |
|---|---|
| `workflows/build.md` | Create a new component (all four files) |
| `workflows/review.md` | Review or extend an existing component |
| `workflows/debug.md` | Diagnose and fix unexpected reactive behavior |

---

## Authority

**Always verify against:**
- Source: `src/` — the real implementation
- `ARCHITECTURE.md` — mental model and constraints
- `REQUIREMENTS.md` — functional and non-functional requirements
- `CONTEXT.md` — precise domain vocabulary

**When in doubt, the source code is authoritative.**
