---
title: "Component API"
description: "Reference for defineComponent and the component-specific types that shape every Le Truc element."
---

Import path for everything on this page:

```ts
import {
  defineComponent,
  type ComponentProp,
  type ComponentProps,
  type FactoryContext,
  type Initializers,
  type MaybeSignal,
  type ReservedWords,
} from '@zeix/le-truc'
```

Source files: `index.ts`, `src/component.ts`, `types/src/component.d.ts`.

## `defineComponent`

```ts
function defineComponent<P extends ComponentProps>(
  name: string,
  factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void,
): CustomElementConstructor | undefined
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `string` | — | Custom element tag name. Must contain a hyphen and start with a lowercase letter. |
| `factory` | `(context: FactoryContext<P>) => FactoryResult \| Falsy \| void` | — | Runs on first connection, queries DOM, calls `expose()`, and returns effect descriptors. |

Returns `customElements.get(name)` after registration.

### Example

```ts
import { bindText, defineComponent } from '@zeix/le-truc'

type GreetingProps = {
  name: string
}

defineComponent<GreetingProps>('greeting-box', ({ expose, first, on, watch }) => {
  const input = first('input', 'Needed for text entry.')
  const output = first('output', 'Needed for rendering.')

  expose({ name: 'World' })

  return [
    on(input, 'input', () => ({ name: input.value || 'World' })),
    watch('name', bindText(output)),
  ]
})
```

## `FactoryContext<P>`

```ts
type FactoryContext<P extends ComponentProps> = ElementQueries & {
  host: HTMLElement & P
  expose: (props: Initializers<P>) => void
  watch: WatchHelper<P>
  on: OnHelper<P>
  pass: PassHelper<P>
  provideContexts: ProvideContextsHelper<P>
  requestContext: RequestContextHelper
}
```

This is the object your factory receives. `ElementQueries` contributes `first()` and `all()`, while the rest of the properties are bound helpers created in `src/component.ts`.

## `Initializers<P>`

```ts
type Initializers<P extends ComponentProps> = {
  [K in keyof P]?:
    | P[K]
    | Signal<P[K]>
    | Parser<P[K]>
    | (P[K] extends (...args: any[]) => any
        ? P[K] & { readonly [METHOD_BRAND]: true }
        : never)
}
```

Use this through `expose()`. Each property initializer may be:

- a static value,
- a signal,
- a branded parser such as `asNumber()`,
- or a branded method from `defineMethod()`.

### Example

```ts
expose({
  count: 0,
  theme: requestContext(THEME_CONTEXT, 'light'),
  parseMe: asNumber(0),
  reset: defineMethod(() => {
    host.count = 0
  }),
})
```

## `MaybeSignal<T>`

```ts
type MaybeSignal<T extends {}> =
  | T
  | Signal<T>
  | MemoCallback<T>
  | TaskCallback<T>
```

This is the input shape accepted by the private `#setAccessor()` implementation. In practice it explains why a property initializer may be a plain value, a signal, or a derived callback.

## `ComponentProp`, `ComponentProps`, and `ReservedWords`

```ts
type ReservedWords =
  | 'constructor'
  | 'prototype'
  | '__proto__'
  | 'toString'
  | 'valueOf'
  | 'hasOwnProperty'
  | 'isPrototypeOf'
  | 'propertyIsEnumerable'
  | 'toLocaleString'

type ComponentProp = Exclude<string, keyof HTMLElement | ReservedWords>

type ComponentProps = Record<ComponentProp, NonNullable<unknown>>
```

These types enforce that your reactive property names do not collide with existing host members or object built-ins.

## Notes

- `defineComponent()` throws `InvalidComponentNameError` for invalid tag names.
- The factory is run once per instance; subsequent reconnects reuse the stored setup and only reactivate effects.
- Activation waits for unresolved queried child custom elements through `resolveDependencies()` in `src/ui.ts`.
