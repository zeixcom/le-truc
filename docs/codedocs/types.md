---
title: "Types"
description: "Reference for the exported TypeScript types that define Le Truc’s component model, helper signatures, and selector inference."
---

This page focuses on the Le Truc-specific exported types. They all import from the package root:

```ts
import type {
  ComponentProp,
  ComponentProps,
  Context,
  ContextCallback,
  ContextType,
  DangerouslyBindInnerHTMLOptions,
  EffectDescriptor,
  ElementFromSelector,
  ElementQueries,
  EventType,
  FactoryContext,
  FactoryResult,
  Falsy,
  Initializers,
  MaybeSignal,
  MethodProducer,
  OnEventHandler,
  OnHelper,
  Parser,
  PassHelper,
  PassedProps,
  ProvideContextsHelper,
  Reactive,
  RequestContextHelper,
  ReservedWords,
  WatchHelper,
} from '@zeix/le-truc'
```

## Component Model Types

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

type Initializers<P extends ComponentProps> = {
  [K in keyof P]?:
    | P[K]
    | Signal<P[K]>
    | Parser<P[K]>
    | (P[K] extends (...args: any[]) => any
        ? P[K] & { readonly [METHOD_BRAND]: true }
        : never)
}

type MaybeSignal<T extends {}> =
  | T
  | Signal<T>
  | MemoCallback<T>
  | TaskCallback<T>
```

These types define what a component prop may be called and how it can be initialized.

## Factory and Effect Types

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

type Falsy = false | null | undefined | '' | 0 | 0n
type EffectDescriptor = () => MaybeCleanup
type FactoryResult = Array<EffectDescriptor | FactoryResult | Falsy>
type Reactive<T, P extends ComponentProps> =
  | keyof P
  | Signal<T & {}>
  | (() => T | Promise<T> | null | undefined)

type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
  [K in keyof Q & string]?: Reactive<Q[K], P> | SlotDescriptor<Q[K] & {}>
}
```

These are the types behind `return [watch(...), on(...)]` and `pass(child, { value: 'count' })`.

## Event and Context Types

```ts
type EventType<K extends string> =
  K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event

type OnEventHandler<P extends ComponentProps, Evt extends Event, E extends Element> = (
  event: Evt,
  element: E,
) => { [K in keyof P]?: P[K] } | Falsy | void | Promise<void>

type Context<K, V> = K & { __context__: V }
type ContextCallback<V> = (value: V, unsubscribe?: () => void) => void
type ContextType<T extends UnknownContext> =
  T extends Context<infer _, infer V> ? V : never
```

These types let context keys and event handlers stay specific without requiring any runtime annotations.

## Selector Inference Types

```ts
type ElementQueries = {
  first: FirstElement
  all: AllElements
}

type ElementFromSelector<S extends string> =
  S extends `${string},${string}`
    ? ElementsFromSelectorArray<SplitByComma<S>>
    : ElementFromSingleSelector<S>
```

The full selector utility family also includes `SplitByComma`, `TrimWhitespace`, `ExtractRightmostSelector`, `ExtractTag`, `ExtractTagFromSimpleSelector`, `KnownTag`, `ElementFromSingleSelector`, and `ElementsFromSelectorArray`. Together they make selector strings part of the type contract instead of anonymous `Element` lookups.

## Helper-Specific Types

```ts
type Parser<T extends {}> = (value: string | null | undefined) => T

type MethodProducer = ((...args: any[]) => void) & {
  readonly [METHOD_BRAND]: true
}

type DangerouslyBindInnerHTMLOptions = {
  shadowRootMode?: ShadowRootMode
  allowScripts?: boolean
}
```

## How to Use This Page

- Use the [Component API](/docs/api-reference/component-api) page when you need signatures and examples for `defineComponent()`.
- Use the [Effects API](/docs/api-reference/effects-api) and [Events API](/docs/api-reference/events-api) pages for the callable helper overloads.
- Use the [Reactivity Re-exports](/docs/api-reference/reactivity-reexports) page for the upstream `@zeix/cause-effect` types that Le Truc forwards unchanged.
