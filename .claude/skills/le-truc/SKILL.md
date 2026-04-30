---
name: le-truc
description: >
  Expert guidance for building reactive web components with the @zeix/le-truc library.
  Use when creating, reviewing, or debugging a Le Truc component.
user_invocable: true
---

<scope>
This skill is for **developers building components** with the `@zeix/le-truc` public API.

For development work on the le-truc library itself, use the `le-truc-dev` skill instead.
For deep signal-level questions, use the `cause-effect` skill — `@zeix/cause-effect` is re-exported by le-truc, no separate install needed.
</scope>

<essential_principles>
**One form of `defineComponent`** — the factory form:

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

The factory receives a `FactoryContext` at connect time. Call `expose({ ... })` to declare reactive props. Return an array of effect descriptors created by `watch()`, `on()`, `pass()`, `each()`, and `provideContexts()`. Nested arrays are flattened. Falsy guards (`element && watch(...)`) are filtered out — use this for optional descendants.

**`host` is the only external interface.** Components read and write state through `host.propName`. No querying outside the host's subtree, no direct property access on child components.

**Reactivity flows in one direction:**
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

**`@zeix/cause-effect` is re-exported.** Signal types (`State`, `Memo`, `Sensor`, `Slot`, etc.) and utilities (`batch`, `match`, `untrack`) are available directly from `@zeix/le-truc`. No separate install or import needed.

**Run the full test suite after every change.** Check `package.json` for the test command.
</essential_principles>

<intake>
What kind of task is this?

1. **Build** — create a new component (TypeScript, HTML, CSS, documentation)
2. **Review** — review or extend an existing component
3. **Debug** — trace broken or unexpected reactive behavior

**Wait for response before proceeding.**
</intake>

<routing>
| Response | Workflow |
|---|---|
| 1, "build", "create", "new", "add", "write" | workflows/build.md |
| 2, "review", "extend", "refactor", "improve", "check" | workflows/review.md |
| 3, "debug", "fix", "broken", "not working", "wrong", "unexpected" | workflows/debug.md |

**Intent-based routing** (if the user provides clear context without selecting):
- Describes a component to create → workflows/build.md
- Describes an existing component to change or check → workflows/review.md
- Describes something behaving unexpectedly → workflows/debug.md

**After identifying the workflow, read it and follow it exactly.**
</routing>

<reference_index>
All in `references/`:

| File | Contents |
|---|---|
| component-model.md | `defineComponent` args, reactivity flow, re-exported signal API |
| effects.md | Which bind* helper / effect to use when: `bindText`, `bindProperty`, `watch`, `on`, `pass`, `each`, etc. |
| parsers.md | Which initializer to use in `expose()`: `asString`, `asBoolean`, `asInteger`, `defineMethod`, `state.get`, etc. |
| coordination.md | `pass()`, `provideContexts`/`requestContext`, `on()` on host, `all()` |
| markup.md | HTML structure: progressive enhancement, semantic nesting, variant examples |
| styling.md | CSS: host scoping, nesting, custom properties, variant modifier classes |
| documentation.md | What to document and how: property tables, descendant tables, standard Markdown |
| testing.md | Framework-agnostic testing patterns for Le Truc components |
| anti-patterns.md | What to avoid: TypeScript, HTML, CSS, and documentation anti-patterns |
| accessibility.md | ARIA roles, native semantics, ARIA APG patterns |
</reference_index>

<workflows_index>
All in `workflows/`:

| Workflow | Purpose |
|---|---|
| build.md | Create a new component (all four files) |
| review.md | Review or extend an existing component |
| debug.md | Diagnose and fix unexpected reactive behavior |
</workflows_index>
