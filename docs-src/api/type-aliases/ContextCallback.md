### Type Alias: ContextCallback\<V\>

> **ContextCallback**\<`V`\> = (`value`, `unsubscribe?`) => `void`

Defined in: [src/context.ts:38](https://github.com/zeixcom/le-truc/blob/7a98a8d7ad80e12df149892b5920ff3839211b70/src/context.ts#L38)

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
