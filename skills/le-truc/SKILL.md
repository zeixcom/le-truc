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
**Two forms of `defineComponent`** — prefer the 2-param factory form for new components:

```typescript
// Preferred (since 1.1): 2-param factory form
defineComponent('my-component', ({ first, host }) => {
  const button = first('button', 'Add a native <button>.')
  return {
    ui: { button },
    props: { disabled: read(() => button.disabled, false) },
    effects: { button: setProperty('disabled') },
  }
})

// 4-param form: use only when attribute observation is required
defineComponent('my-component', { disabled: asBoolean() }, ({ first }) => ({
  button: first('button', 'Add a native <button>.'),
}), ({ button }) => ({
  button: setProperty('disabled'),
}))
```

The factory form returns `{ ui, props?, effects? }` from a single closure — no `ui` object passed between functions. Parsers in the factory form are called once at connect time (for server-side HTML author configuration); they do not re-run on subsequent attribute changes. Use the 4-param form when attribute changes on a live document must drive reactive updates.

**`host` is the only external interface.** Components read and write state through `host.propName`. No querying outside the host's subtree, no direct property access on child components.

**Reactivity flows in one direction:**
```
(4-param only) attribute change → parser → host.prop (signal)
                                                    ↓
event / property set ──────────────────→ host.prop (signal)
                                                    ↓
                                          effect reads prop
                                                    ↓
                                         DOM update on target
                                                    ↓
                                  event handler → { prop: value }
                                                    ↓
                                       signal updated → effect re-runs
```

**`@zeix/cause-effect` is re-exported.** Signal types (`State`, `Memo`, `Sensor`, `Slot`, etc.) and utilities (`batch`, `match`, `untrack`) are available directly from `@zeix/le-truc`. No separate install or import needed.
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
| effects.md | Which effect to use when: `setText`, `setAttribute`, `on`, `pass`, etc. |
| parsers.md | Which parser to use when: `asString`, `asBoolean`, `asInteger`, `read`, etc. |
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
