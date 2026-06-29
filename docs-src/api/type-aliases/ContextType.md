### Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/helpers/context.ts:31](https://github.com/zeixcom/le-truc/blob/ef4f71291ed328572278d97a47b2febefecb314e/src/helpers/context.ts#L31)

A helper type which can extract a Context value type from a Context type

#### Type Parameters

##### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
