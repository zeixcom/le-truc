<overview>
How Le Truc components communicate. Choose one mechanism per relationship.
</overview>

## Decision guide

| Relationship | Use |
|---|---|
| Parent owns a named Le Truc child, shares a signal directly | `pass()` |
| Ancestor provides shared state to a subtree of unknown depth | `provideContexts` / `requestContext` |
| Parent receives events that bubble from any child | `on(type, handler)` on `host` |
| Parent drives effects on all current and future matching descendants | `all(selector)` |
| Two siblings need to share state | **Not possible directly** — lift state to a common ancestor |

## `pass(props)` — parent controls a Le Truc child

Replaces the backing `Slot` signal of a descendant Le Truc component's prop with a signal from the parent. The child's prop then tracks the parent signal directly — zero intermediate effect.

```typescript
// In the parent's setup function:
({ host }) => ({
  'child-component': pass({ disabled: () => host.disabled }),
})
```

`pass()` is an Effect: it belongs in the `setup` return, keyed to the child's selector or a UI map key that resolves to the child element.

**Scope: Le Truc components only.** For Lit, Stencil, FAST, plain custom elements, or native elements, use `setProperty()` instead — `pass()` bypasses external frameworks' change-detection and has no effect on them.

When the parent disconnects, the original signal is restored to the child (the child regains its independent state).

## `provideContexts` / `requestContext` — shared ancestor state

Implements the [W3C Community Protocol for Context](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md). Descendants do not know the depth of the provider.

**Provider** (ancestor):

```typescript
// In props, expose the properties to share
{
  theme: asString('light'),
  locale: asString('en'),
}

// In setup, return provideContexts on host
({ host }) => ({
  host: provideContexts(['theme', 'locale']),
})
```

**Consumer** (descendant):

```typescript
// In props, request the context value
{
  theme: requestContext('theme', 'light'),  // fallback if no provider
}

// No setup entry needed — the prop is a Memo<string> backed by the provider
```

Use for: data-fetch scopes, auth state, locale, theme, any value shared across an unknown subtree depth.

## `on(type, handler)` on `host` — receive bubbled events

An `on()` effect keyed to `host` receives any event of that type that bubbles from within the component's subtree, regardless of which child dispatched it.

```typescript
({ host }) => ({
  host: on('item-selected', (e: CustomEvent<{ id: string }>) => {
    host.selectedId = e.detail.id
  }),
})
```

Use when: a parent needs to respond to any child of a particular type without knowing exactly which child fired.

## `all(selector)` — drive effects on a dynamic set of descendants

`all(selector)` returns a `Memo<E[]>` backed by a lazy `MutationObserver`. When used as a UI map key, `runEffects` wraps the effect loop in a `createEffect` — effects run for every current and future matching element.

```typescript
// In select:
({ all }) => ({
  items: all('[role="option"]'),
})

// In setup:
({ host }) => ({
  items: toggleClass('selected', el => host.selectedId === el.dataset.id),
})
```

The MutationObserver is lazy: it only activates when the Memo is read inside a reactive effect. It watches attribute changes implied by the selector (class, id, `[attr]` patterns) plus `childList`/`subtree`.

## No sibling communication

If two components in different branches need to share state, lift the state to a common ancestor and use `pass()` or context downward. Direct sibling-to-sibling communication is not supported and is an anti-pattern.
