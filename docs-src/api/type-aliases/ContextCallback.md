### Type Alias: ContextCallback\<V\>

> **ContextCallback**\<`V`\> = (`value`, `unsubscribe?`) => `void`

Defined in: [src/helpers/context.ts:37](https://github.com/zeixcom/le-truc/blob/157db2ea6a0d3aea197ee178eec89f5cb4064479/src/helpers/context.ts#L37)

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
