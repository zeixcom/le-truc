### Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/context.ts:33](https://github.com/zeixcom/le-truc/blob/29beeda732ab654fc5e6eab73c276e5a5367d43a/src/context.ts#L33)

A helper type which can extract a Context value type from a Context type

#### Type Parameters

##### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
