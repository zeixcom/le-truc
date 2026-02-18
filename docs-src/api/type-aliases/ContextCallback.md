### Type Alias: ContextCallback()\<V\>

> **ContextCallback**\<`V`\> = (`value`, `unsubscribe?`) => `void`

Defined in: [src/context.ts:40](https://github.com/zeixcom/le-truc/blob/9899f5d34ea29fc1973736236835ba462d0ed87a/src/context.ts#L40)

A callback which is provided by a context requester and is called with the value satisfying the request.
This callback can be called multiple times by context providers as the requested value is changed.

#### Type Parameters

##### V

`V`

#### Parameters

##### value

`V`

##### unsubscribe?

() => `void`

#### Returns

`void`
