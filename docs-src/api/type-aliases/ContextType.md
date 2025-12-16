[**le-truc**](../README.md)

***

[le-truc](../globals.md) / ContextType

# Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/context.ts:34](https://github.com/zeixcom/le-truc/blob/5bd629bc02429c8193f06a75f94397faf30ed891/src/context.ts#L34)

A helper type which can extract a Context value type from a Context type

## Type Parameters

### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
