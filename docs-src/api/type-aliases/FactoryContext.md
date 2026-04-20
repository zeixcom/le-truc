### Type Alias: FactoryContext\<P\>

> **FactoryContext**\<`P`\> = [`ElementQueries`](ElementQueries.md) & `object`

Defined in: [src/component.ts:103](https://github.com/zeixcom/le-truc/blob/0e16726a6b6b9bb6f06cac4d48e841e3343f2b6f/src/component.ts#L103)

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
