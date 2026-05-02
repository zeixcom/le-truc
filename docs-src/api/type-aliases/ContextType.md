### Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/context.ts:31](https://github.com/zeixcom/le-truc/blob/c0c7a519683b9de6742fb7ca8d71487ad2dadceb/src/context.ts#L31)

A helper type which can extract a Context value type from a Context type

#### Type Parameters

##### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
