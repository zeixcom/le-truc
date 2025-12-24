[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ContextType

# Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/context.ts:34](https://github.com/zeixcom/le-truc/blob/278ab0df3fbdca5f6b0f0436bf1688626c821080/src/context.ts#L34)

A helper type which can extract a Context value type from a Context type

## Type Parameters

### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
