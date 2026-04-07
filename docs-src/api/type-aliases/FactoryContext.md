### Type Alias: FactoryContext\<P\>

> **FactoryContext**\<`P`\> = [`ElementQueries`](ElementQueries.md) & `object`

Defined in: [src/component.ts:213](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/component.ts#L213)

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
