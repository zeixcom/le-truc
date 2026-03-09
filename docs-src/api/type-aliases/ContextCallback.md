### Type Alias: ContextCallback()\<V\>

> **ContextCallback**\<`V`\> = (`value`, `unsubscribe?`) => `void`

Defined in: [src/context.ts:41](https://github.com/zeixcom/le-truc/blob/d8168684fc4cb8d811d0fffec6f48f3c78b3f3fb/src/context.ts#L41)

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
