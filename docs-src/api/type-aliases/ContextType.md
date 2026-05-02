### Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/helpers/context.ts:30](https://github.com/zeixcom/le-truc/blob/157db2ea6a0d3aea197ee178eec89f5cb4064479/src/helpers/context.ts#L30)

A helper type which can extract a Context value type from a Context type

#### Type Parameters

##### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
