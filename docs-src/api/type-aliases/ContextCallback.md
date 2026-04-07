### Type Alias: ContextCallback\<V\>

> **ContextCallback**\<`V`\> = (`value`, `unsubscribe?`) => `void`

Defined in: [src/context.ts:29](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/context.ts#L29)

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
