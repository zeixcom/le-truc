# Coordination

**Overview:** How Le Truc components communicate. Choose **one mechanism** per relationship.

---

## Decision Guide

| Relationship | Use |
|---|---|
| Parent owns named Le Truc child, shares signal directly | `pass(target, props)` |
| Ancestor provides shared state to subtree of unknown depth | `provideContexts` / `requestContext` |
| Parent receives events that bubble from any child | `on(host, type, handler)` |
| Parent drives effects on all current/future matching descendants | `all(selector)` + `each()` |
| Two siblings need to share state | **Not possible directly** — lift to common ancestor |

---

## `pass(target, props)` — Parent Controls Le Truc Child

Replaces backing `Slot` signal of descendant Le Truc component's prop with signal from parent. Child's prop then tracks parent signal directly — zero intermediate effect. Creates and registers an `EffectDescriptor`.

```typescript
defineComponent<ParentProps>('parent-el', ({ expose, first, pass }) => {
  const child = first('child-el') as HTMLElement & ChildProps
  expose({ disabled: false })
  pass(child, {
    disabled: () => host.disabled,   // thunk — read-only
    label: readonlyMemo,             // read-only signal (Memo/Task)
    // SlotDescriptor — mediated writable (also for type conversion):
    progress: {
      get: () => host.value / host.max,             // normalize to 0-1
      set: (v: number) => { host.value = v * host.max },
    },
  })
})
```

**Deprecated short forms (removed in next major):** the property-key form (`disabled: 'disabled'`) and the bare-writable-signal form (`value: someState`) hand the child unrestricted `.set()` on the parent's signal and warn in DEV_MODE (ADR 0012). Use a thunk for read-only access or a `{ get, set }` descriptor to mediate writes.

**Scope: Le Truc components only.** For Lit, Stencil, FAST, plain custom elements, or native elements, use `watch('prop', bindProperty(el, 'key'))` instead — `pass()` bypasses external frameworks' change-detection and has no effect on them.

When parent disconnects, original signal restored to child (child regains independent state).

**Memo target:** `pass` also accepts `Memo<(HTMLElement & Q)[]>` from `all()` — per-element lifecycle handled automatically.

---

## `provideContexts` / `requestContext` — Shared Ancestor State

Implements [Community Protocol for Context](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md). Descendants do not know depth of provider.

**Provider (ancestor):**

```typescript
defineComponent<ThemeProps>('theme-provider', ({ expose, provideContexts }) => {
  expose({
    theme: asString('light'),
    locale: asString('en'),
  })
  provideContexts(['theme', 'locale'])  // registers itself, no return needed
})
```

**Consumer (descendant):**

```typescript
// Define context symbol (shared between provider and consumer)
const THEME_CONTEXT = Symbol.for('theme')

defineComponent<MyProps>('my-consumer', ({ expose, requestContext, watch }) => {
  expose({
    theme: requestContext(THEME_CONTEXT, 'light'),  // Signal<string> — fallback if no provider
  })
  watch('theme', value => { /* react to theme */ })
})
```

The returned `Signal<T>` is backed by a `Slot`: it serves `fallback` until a provider answers, and a provider that upgrades late (bundle ordering, code-splitting) is still caught by automatic re-dispatches — the consumer switches from fallback to the provided value reactively, no consumer code needed. Providers are stable single sources of truth: update the *values* they provide, don't remove or swap the provider at runtime.

Use for: data-fetch scopes, auth state, locale, theme, any value shared across unknown subtree depth.

---

## `on(host, type, handler)` — Receive Bubbled Events

`on()` descriptor keyed to `host` element receives any event of that type that bubbles from within component's subtree, regardless of which child dispatched it.

```typescript
defineComponent<Props>('parent-el', ({ expose, host, on }) => {
  expose({ selectedId: '' })
  on(host, 'item-selected', (e: CustomEvent<{ id: string }>, el) => ({
    selectedId: e.detail.id,
  }))
})
```

Use when: parent needs to respond to any child of particular type without knowing exactly which child fired.

---

## `all(selector)` + `each()` — Drive Effects on Dynamic Descendants

`all(selector, required?)` returns `Memo<E[]>` backed by lazy `MutationObserver`. If `required` is non-empty string and no elements match at query time, throws `MissingElementError`. Use with `each()` for per-element effects, or with `on()` for delegated event listeners.

```typescript
defineComponent<Props>('list-el', ({ all, expose, host, on, watch }) => {
  const items = all('[role="option"]')
  expose({ selectedId: '' })
  // Delegated click on all items
  on(items, 'click', (event, item) => ({
    selectedId: item.id,
  }))
  // Per-element reactive class with own scope
  each(items, item => {
    watch('selectedId', bindClass(item, 'selected', id => id === item.id))
  })
})
```

MutationObserver is lazy: only activates when Memo read inside reactive effect.

---

## No Sibling Communication

If two components in different branches need to share state, **lift state to common ancestor** and pass it down. Direct sibling-to-sibling communication is **not supported** and is an anti-pattern.
