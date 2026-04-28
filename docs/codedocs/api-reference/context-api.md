---
title: "Context API"
description: "Reference for typed context keys, context-request events, and the provider/consumer helpers exposed by Le Truc."
---

Import path for everything on this page:

```ts
import {
  CONTEXT_REQUEST,
  type Context,
  type ContextCallback,
  ContextRequestEvent,
  type ContextType,
  type ProvideContextsHelper,
  type RequestContextHelper,
  type UnknownContext,
} from '@zeix/le-truc'
```

Source files: `index.ts`, `src/context.ts`, `types/src/context.d.ts`.

## Constants and Classes

### `CONTEXT_REQUEST`

```ts
const CONTEXT_REQUEST = 'context-request'
```

The event name used for provider/consumer negotiation.

### `ContextRequestEvent<T>`

```ts
class ContextRequestEvent<T extends UnknownContext> extends Event {
  readonly context: T
  readonly callback: ContextCallback<ContextType<T>>
  readonly subscribe: boolean

  constructor(
    context: T,
    callback: ContextCallback<ContextType<T>>,
    subscribe?: boolean,
  )
}
```

This event bubbles and is composed, so descendants can request values from providers up the DOM tree.

### Example

```ts
const THEME_CONTEXT = 'theme' as Context<'theme', () => 'light' | 'dark'>

host.dispatchEvent(
  new ContextRequestEvent(THEME_CONTEXT, getter => {
    console.log(getter())
  }),
)
```

## Type Aliases

### `Context<K, V>`

```ts
type Context<K, V> = K & { __context__: V }
```

Use this to brand a context key so TypeScript can carry the value type through provider and consumer code.

### `UnknownContext`

```ts
type UnknownContext = Context<unknown, unknown>
```

### `ContextType<T>`

```ts
type ContextType<T extends UnknownContext> =
  T extends Context<infer _, infer V> ? V : never
```

### `ContextCallback<V>`

```ts
type ContextCallback<V> = (value: V, unsubscribe?: () => void) => void
```

### `ProvideContextsHelper<P>`

```ts
type ProvideContextsHelper<P extends ComponentProps> = (
  contexts: Array<keyof P>,
) => EffectDescriptor
```

### `RequestContextHelper`

```ts
type RequestContextHelper = <T extends {}>(
  context: Context<string, () => T>,
  fallback: T,
) => Memo<T>
```

## Usage Pattern

Provider:

```ts
const COUNT_CONTEXT = 'count' as Context<'count', () => number>

defineComponent<{ count: number }>('count-provider', ({ expose, provideContexts }) => {
  expose({ count: 0 })
  return [provideContexts(['count'])]
})
```

Consumer:

```ts
defineComponent<{ count: number }>('count-consumer', ({ expose, requestContext }) => {
  expose({
    count: requestContext(COUNT_CONTEXT, -1),
  })
})
```

Internally, `provideContexts()` listens on the host and answers requests by returning a getter over the host property. `requestContext()` dispatches the event once and wraps the resolved getter in `createMemo()`, which is why the consumed value remains reactive after the initial lookup.
