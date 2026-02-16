[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ContextType

# Type Alias: ContextType\<T\>

> **ContextType**\<`T`\> = `T` *extends* [`Context`](Context.md)\<infer \_, infer V\> ? `V` : `never`

Defined in: [src/context.ts:33](https://github.com/zeixcom/le-truc/blob/c62468fd9c5d5c7240f34b9daac5034cede67a90/src/context.ts#L33)

A helper type which can extract a Context value type from a Context type

## Type Parameters

### T

`T` *extends* [`UnknownContext`](UnknownContext.md)
