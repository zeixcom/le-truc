### Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/context.ts:31](https://github.com/zeixcom/le-truc/blob/61224a1a87e995ff3784a4e2a215a09a403e4e85/src/context.ts#L31)

A helper type which can extract a Context value type from a Context type

#### Type Parameters

##### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
