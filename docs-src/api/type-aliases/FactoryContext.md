### Type Alias: FactoryContext\<P\>

> **FactoryContext**\<`P`\> = [`ElementQueries`](ElementQueries.md) & `object`

Defined in: [src/component.ts:104](https://github.com/zeixcom/le-truc/blob/95e5c3ab97d0cd1430adbe5ee92d9bdf2b5d274c/src/component.ts#L104)

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
