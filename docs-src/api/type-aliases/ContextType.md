[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ContextType

# Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/context.ts:33](https://github.com/zeixcom/le-truc/blob/9067b0df4b01434796accabfb262c9896f05f14f/src/context.ts#L33)

A helper type which can extract a Context value type from a Context type

## Type Parameters

### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
