### Type Alias: FactoryContext\<P\>

> **FactoryContext**\<`P`\> = [`ElementQueries`](ElementQueries.md) & `object`

Defined in: [src/component.ts:78](https://github.com/zeixcom/le-truc/blob/f973c77449aa2054ba6f6324004d6f4dfb8706d1/src/component.ts#L78)

The context object passed to the v2.x factory function.

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

> **on**: [`OnHelper`](OnHelper.md)\<`P`\>

##### pass

> **pass**: [`PassHelper`](PassHelper.md)\<`P`\>

##### provideContexts

> **provideContexts**: [`ProvideContextsHelper`](ProvideContextsHelper.md)\<`P`\>

##### requestContext

> **requestContext**: [`RequestContextHelper`](RequestContextHelper.md)

##### watch

> **watch**: [`WatchHelper`](WatchHelper.md)\<`P`\>

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)
