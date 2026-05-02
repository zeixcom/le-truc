### Type Alias: FactoryContext\<P\>

> **FactoryContext**\<`P`\> = [`ElementQueries`](ElementQueries.md) & `object`

Defined in: [src/component.ts:105](https://github.com/zeixcom/le-truc/blob/c0c7a519683b9de6742fb7ca8d71487ad2dadceb/src/component.ts#L105)

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
