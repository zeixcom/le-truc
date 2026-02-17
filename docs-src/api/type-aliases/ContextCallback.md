[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ContextCallback

# Type Alias: ContextCallback()\<V\>

> **ContextCallback**\<`V`\> = (`value`, `unsubscribe?`) => `void`

Defined in: [src/context.ts:40](https://github.com/zeixcom/le-truc/blob/29df9dc153407528423acb370c4f28ebc628bed2/src/context.ts#L40)

A callback which is provided by a context requester and is called with the value satisfying the request.
This callback can be called multiple times by context providers as the requested value is changed.

## Type Parameters

### V

`V`

## Parameters

### value

`V`

### unsubscribe?

() => `void`

## Returns

`void`
