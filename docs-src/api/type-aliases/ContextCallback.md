[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ContextCallback

# Type Alias: ContextCallback()\<V\>

> **ContextCallback**\<`V`\> = (`value`, `unsubscribe?`) => `void`

Defined in: [src/context.ts:40](https://github.com/zeixcom/le-truc/blob/a6eb6ebcd7352b6a07349eccb67cc61a478cd06f/src/context.ts#L40)

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
