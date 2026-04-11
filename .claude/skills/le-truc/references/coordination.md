<overview>
How Le Truc components communicate. Choose one mechanism per relationship.
</overview>

## Decision guide

| Relationship | Use |
|---|---|
| Parent owns a named Le Truc child, shares a signal directly | `pass(target, props)` |
| Ancestor provides shared state to a subtree of unknown depth | `provideContexts` / `requestContext` |
| Parent receives events that bubble from any child | `on(host, type, handler)` |
| Parent drives effects on all current and future matching descendants | `all(selector)` + `each()` |
| Two siblings need to share state | **Not possible directly** — lift state to a common ancestor |

## `pass(target, props)` — parent controls a Le Truc child

Replaces the backing `Slot` signal of a descendant Le Truc component's prop with a signal from the parent. The child's prop then tracks the parent signal directly — zero intermediate effect. Returns an `EffectDescriptor`.

```typescript
defineComponent<ParentProps>('parent-el', ({ expose, first, pass }) => {
  const child = first('child-el') as HTMLElement & ChildProps
  expose({ disabled: false })
  return [
    pass(child, {
      disabled: 'disabled',            // string prop name → reads host.disabled
      label: () => host.label,         // thunk
      value: mySignal,                 // Signal
    }),
  ]
})
```

**Scope: Le Truc components only.** For Lit, Stencil, FAST, plain custom elements, or native elements, use `watch('prop', bindProperty(el, 'key'))` instead — `pass()` bypasses external frameworks' change-detection and has no effect on them.

When the parent disconnects, the original signal is restored to the child (the child regains its independent state).

**Memo target:** `pass` also accepts a `Memo<(HTMLElement & Q)[]>` from `all()` — per-element lifecycle is handled automatically.

## `provideContexts` / `requestContext` — shared ancestor state

Implements the [W3C Community Protocol for Context](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md). Descendants do not know the depth of the provider.

**Provider** (ancestor):

```typescript
defineComponent<ThemeProps>('theme-provider', ({ expose, provideContexts }) => {
  expose({
    theme: asString('light'),
    locale: asString('en'),
  })
  return [
    provideContexts(['theme', 'locale']),  // EffectDescriptor — include in return array
  ]
})
```

**Consumer** (descendant):

```typescript
defineComponent<MyProps>('my-consumer', ({ expose, requestContext, watch }) => {
  expose({
    theme: requestContext(THEME_CONTEXT, 'light'),  // Memo<string> — fallback if no provider
  })
  return [
    watch('theme', value => { /* react to theme */ }),
  ]
})
```

Use for: data-fetch scopes, auth state, locale, theme, any value shared across an unknown subtree depth.

## `on(host, type, handler)` — receive bubbled events

An `on()` descriptor keyed to the `host` element receives any event of that type that bubbles from within the component's subtree, regardless of which child dispatched it.

```typescript
defineComponent<Props>('parent-el', ({ expose, host, on }) => {
  expose({ selectedId: '' })
  return [
    on(host, 'item-selected', (e: CustomEvent<{ id: string }>, el) => ({
      selectedId: e.detail.id,
    })),
  ]
})
```

Use when: a parent needs to respond to any child of a particular type without knowing exactly which child fired.

## `all(selector)` + `each()` — drive effects on a dynamic set of descendants

`all(selector)` returns a `Memo<E[]>` backed by a lazy `MutationObserver`. Use with `each()` for per-element effects, or with `on()` for delegated event listeners.

```typescript
defineComponent<Props>('list-el', ({ all, expose, host, on, watch }) => {
  const items = all('[role="option"]')
  expose({ selectedId: '' })
  return [
    // Delegated click on all items
    on(items, 'click', (event, item) => ({
      selectedId: item.id,
    })),
    // Per-element reactive class with own scope
    each(items, item => [
      watch('selectedId', bindClass(item, 'selected', id => id === item.id)),
    ]),
  ]
})
```

The `MutationObserver` is lazy: it only activates when the Memo is read inside a reactive effect.

## No sibling communication

If two components in different branches need to share state, lift the state to a common ancestor and pass it down. Direct sibling-to-sibling communication is not supported and is an anti-pattern.
