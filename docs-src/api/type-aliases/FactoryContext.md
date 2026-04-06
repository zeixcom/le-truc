### Type Alias: FactoryContext\<P\>

> **FactoryContext**\<`P`\> = [`ElementQueries`](ElementQueries.md) & `object`

Defined in: [src/component.ts:240](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/component.ts#L240)

The context object passed to the v1.1 factory function.

Components destructure only what they need.

#### Type Declaration

##### expose

> **expose**: (`props`) => `void`

###### Parameters

##### props

[`Initializers`](Initializers.md)\<`P`, \{ \}\>

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
