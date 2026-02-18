[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ContextCallback

# Type Alias: ContextCallback()\<V\>

> **ContextCallback**\<`V`\> = (`value`, `unsubscribe?`) => `void`

Defined in: [src/context.ts:40](https://github.com/zeixcom/le-truc/blob/3cb760ea5cf00b2f369106cc51ee33852f9ce090/src/context.ts#L40)

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
