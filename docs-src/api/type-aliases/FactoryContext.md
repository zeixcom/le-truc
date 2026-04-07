### Type Alias: FactoryContext\<P\>

> **FactoryContext**\<`P`\> = [`ElementQueries`](ElementQueries.md) & `object`

Defined in: [src/component.ts:101](https://github.com/zeixcom/le-truc/blob/6e56893b2946c17dd4fe36c76f1a09d8d1d02488/src/component.ts#L101)

The context object passed to the v1.1 factory function.

Components destructure only what they need.

#### Type Declaration

##### expose

> **expose**: (`props`) => `void`

###### Parameters

##### props

[`Initializers`](Initializers.md)\<`P`\>

###### Returns

`void`

##### host

> **host**: `HTMLElement` & `P`

##### on

> **on**: [`FactoryOnHelper`](FactoryOnHelper.md)\<`P`\>

##### pass

> **pass**: [`FactoryPassHelper`](FactoryPassHelper.md)\<`P`\>

##### provideContexts

> **provideContexts**: [`FactoryProvideContextsHelper`](FactoryProvideContextsHelper.md)\<`P`\>

##### requestContext

> **requestContext**: [`FactoryRequestContextHelper`](FactoryRequestContextHelper.md)

##### watch

> **watch**: [`FactoryWatchHelper`](FactoryWatchHelper.md)\<`P`\>

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)
