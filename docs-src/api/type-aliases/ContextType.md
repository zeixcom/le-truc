### Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/context.ts:31](https://github.com/zeixcom/le-truc/blob/56101c7b29abec1b313b7eb357a8db22a4da0ef6/src/context.ts#L31)

A helper type which can extract a Context value type from a Context type

#### Type Parameters

##### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
