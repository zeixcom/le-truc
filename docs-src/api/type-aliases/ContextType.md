[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ContextType

# Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/context.ts:34](https://github.com/zeixcom/le-truc/blob/e2435e222ab83bf3d7406922f98523eb60eae450/src/context.ts#L34)

A helper type which can extract a Context value type from a Context type

## Type Parameters

### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
