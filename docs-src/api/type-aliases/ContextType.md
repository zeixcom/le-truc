### Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/context.ts:33](https://github.com/zeixcom/le-truc/blob/ce6fdde33897d7e14382a222c2fdd5e1804c6bd3/src/context.ts#L33)

A helper type which can extract a Context value type from a Context type

#### Type Parameters

##### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
